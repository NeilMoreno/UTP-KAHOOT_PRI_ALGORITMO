'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('pistas de IA: tras un intento, 3 niveles, cuota del docente y límites', { skip: !enabled }, async () => {
    // La IA se simula (se parchea antes de cargar el servidor, igual que en las demás pruebas de IA).
    const hintService = require('../backend/services/hintService');
    const original = hintService.generateHint;
    const levels = [];
    hintService.generateHint = async ({ level, code }) => {
        levels.push({ level, code });
        return { pista: `Pista de prueba de nivel ${level} para orientarte sin darte la solución.`, tokens: 300, model: 'gemini-mock-test' };
    };

    process.env.EMAIL_PROVIDER = 'disabled';
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    let courseId = null;
    let quotaId = null;
    try {
        const admin = await request(app).post('/api/auth/login').send({ email: 'admin@codeintcorp.com', password: 'codeint123' });
        const teacher = await request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' });
        const student = await request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' });
        const tAuth = { Authorization: `Bearer ${teacher.body.token}` };
        const sAuth = { Authorization: `Bearer ${student.body.token}` };

        const course = await request(app).post('/api/cursos').set(tAuth).send({ nombre: `Test pistas ${randomUUID().slice(0, 6)}`, periodo: '2026-II' });
        courseId = course.body.data.id_curso;
        await request(app).post(`/api/cursos/${courseId}/matricular`).set(tAuth).send({ email: 'estudiante.demo@utp.edu.pe' }).expect(201);
        const worlds = (await request(app).get(`/api/mundos/curso/${courseId}`).set(tAuth).expect(200)).body.data;
        const exercises = (await request(app).get(`/api/ejercicios/mundo/${worlds[0].id_mundo}`).set(tAuth).expect(200)).body.data;
        const exerciseId = exercises[0].id_ejercicio;
        const typed = (await request(app).post('/api/ejercicios').set(tAuth).send({
            id_mundo: worlds[0].id_mundo, orden: 91, xp_recompensa: 30, titulo: 'Predice', enunciado: 'Lee el código y escribe lo que imprime.',
            tipo: 'predecir', material: { codigo: 'print(1)' }, solucion: { respuesta: '1' }
        })).body.data;
        const enrollment = (await migrationPool.query('SELECT id_matricula FROM matricula WHERE id_curso = $1 AND id_estudiante = $2;', [courseId, student.body.user.id_usuario])).rows[0].id_matricula;

        const url = `/api/ejercicios/${exerciseId}/pistas`;
        await request(app).post(url).set(tAuth).expect(403); // solo estudiantes

        // Sin intento previo no hay pista; los ejercicios automáticos no tienen pistas.
        const noAttempt = await request(app).post(url).set(sAuth);
        assert.equal(noAttempt.status, 409);
        assert.equal(noAttempt.body.error, 'HINT_NEEDS_ATTEMPT');
        assert.equal((await request(app).post(`/api/ejercicios/${typed.id_ejercicio}/pistas`).set(sAuth)).body.error, 'HINT_NOT_AVAILABLE');

        // Un intento evaluado con 40 puntos (insertado directo: no hace falta la IA de evaluación).
        const sent = await migrationPool.query(
            `INSERT INTO envio_ejercicio (id_matricula, id_estudiante, id_ejercicio, id_curso, codigo_pseint, sintaxis_valida, estado_evaluacion)
             VALUES ($1, $2, $3, $4, $5, true, 'completado') RETURNING id_envio_ejercicio;`,
            [enrollment, student.body.user.id_usuario, exerciseId, courseId, 'Algoritmo X\n  Escribir "mi intento"\nFinAlgoritmo']
        );
        await migrationPool.query(
            `INSERT INTO evaluacion_ia (id_envio_ejercicio, id_estudiante, id_curso, puntaje, retroalimentacion, categoria_error)
             VALUES ($1, $2, $3, 40, 'No cumple el enunciado del ejercicio.', 'logica');`,
            [sent.rows[0].id_envio_ejercicio, student.body.user.id_usuario, courseId]
        );

        // Sin cuota del docente no hay pista (y no se guarda nada).
        const noQuota = await request(app).post(url).set(sAuth);
        assert.equal(noQuota.status, 409);
        assert.equal(noQuota.body.error, 'AI_QUOTA_UNAVAILABLE');

        const quota = await request(app).post('/api/ia/cuotas').set({ Authorization: `Bearer ${admin.body.token}` }).send({
            id_docente: teacher.body.user.id_usuario, limite_tokens: 50000,
            fecha_inicio: new Date(Date.now() - 60000).toISOString(), fecha_fin: new Date(Date.now() + 3600000).toISOString()
        });
        assert.equal(quota.status, 201, JSON.stringify(quota.body));
        quotaId = quota.body.data.id_asignacion_tokens;

        // Tres pistas graduales; la cuarta se niega.
        for (const expected of [1, 2, 3]) {
            const hint = await request(app).post(url).set(sAuth);
            assert.equal(hint.status, 201, JSON.stringify(hint.body));
            assert.equal(hint.body.data.nivel, expected);
            assert.equal(hint.body.data.restantes, 3 - expected);
        }
        assert.deepEqual(levels.map((item) => item.level), [1, 2, 3]);
        assert.match(levels[0].code, /mi intento/, 'la pista se basa en el último envío guardado');
        const fourth = await request(app).post(url).set(sAuth);
        assert.equal(fourth.status, 409);
        assert.equal(fourth.body.error, 'HINTS_EXHAUSTED');

        const state = (await request(app).get(url).set(sAuth).expect(200)).body.data;
        assert.equal(state.pistas.length, 3);
        assert.equal(state.restantes, 0);

        // Cada pista consumió tokens de la cuota del docente.
        const used = await migrationPool.query(
            `SELECT count(*)::int AS total, COALESCE(sum(tokens_consumidos), 0)::int AS tokens FROM uso_ia WHERE id_envio_ejercicio = $1 AND estado_consumo = 'confirmado';`,
            [sent.rows[0].id_envio_ejercicio]
        );
        assert.equal(used.rows[0].total, 3);
        assert.equal(used.rows[0].tokens, 900);

        // Una vez aprobado el ejercicio ya no hay pistas.
        const other = (await migrationPool.query(
            `INSERT INTO envio_ejercicio (id_matricula, id_estudiante, id_ejercicio, id_curso, codigo_pseint, sintaxis_valida, estado_evaluacion)
             VALUES ($1, $2, $3, $4, 'Algoritmo Y FinAlgoritmo', true, 'completado') RETURNING id_envio_ejercicio;`,
            [enrollment, student.body.user.id_usuario, exercises[1].id_ejercicio, courseId]
        )).rows[0].id_envio_ejercicio;
        await migrationPool.query(
            `INSERT INTO evaluacion_ia (id_envio_ejercicio, id_estudiante, id_curso, puntaje, retroalimentacion, categoria_error)
             VALUES ($1, $2, $3, 95, 'La solución cumple el objetivo del ejercicio.', 'ninguno');`,
            [other, student.body.user.id_usuario, courseId]
        );
        assert.equal((await request(app).post(`/api/ejercicios/${exercises[1].id_ejercicio}/pistas`).set(sAuth)).body.error, 'HINT_ALREADY_PASSED');
    } finally {
        hintService.generateHint = original;
        if (courseId) {
            await migrationPool.query('DELETE FROM uso_ia WHERE id_envio_ejercicio IN (SELECT id_envio_ejercicio FROM envio_ejercicio WHERE id_curso = $1);', [courseId]).catch(() => {});
            await pool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = $1`, [courseId]).catch(() => {});
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = $1`, [courseId]).catch(() => {});
        }
        if (quotaId) await migrationPool.query('DELETE FROM asignacion_tokens WHERE id_asignacion_tokens = $1;', [quotaId]).catch(() => {});
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
