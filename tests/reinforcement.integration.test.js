'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('refuerzo: con 3 fallos de la misma categoría sugiere repaso con ejercicios automáticos pendientes', { skip: !enabled }, async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    let courseId = null;
    try {
        const teacher = await request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' });
        const student = await request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' });
        const tAuth = { Authorization: `Bearer ${teacher.body.token}` };
        const sAuth = { Authorization: `Bearer ${student.body.token}` };
        const studentId = student.body.user.id_usuario;

        const course = await request(app).post('/api/cursos').set(tAuth).send({ nombre: `Test refuerzo ${randomUUID().slice(0, 6)}`, periodo: '2026-II' });
        courseId = course.body.data.id_curso;
        await request(app).post(`/api/cursos/${courseId}/matricular`).set(tAuth).send({ email: 'estudiante.demo@utp.edu.pe' }).expect(201);
        const worlds = (await request(app).get(`/api/mundos/curso/${courseId}`).set(tAuth).expect(200)).body.data;
        const exercises = (await request(app).get(`/api/ejercicios/mundo/${worlds[0].id_mundo}`).set(tAuth).expect(200)).body.data;
        const idEnrollment = (await migrationPool.query('SELECT id_matricula FROM matricula WHERE id_curso = $1 AND id_estudiante = $2;', [courseId, studentId])).rows[0].id_matricula;

        // Sin fallos no hay refuerzo.
        const none = (await request(app).get(`/api/gamificacion/refuerzo/${courseId}`).set(sAuth).expect(200)).body.data;
        assert.equal(none.necesita_refuerzo, false);

        // Un ejercicio automático pendiente en el mundo 1 y tres fallos de lógica.
        const typed = (await request(app).post('/api/ejercicios').set(tAuth).send({
            id_mundo: worlds[0].id_mundo, orden: 90, xp_recompensa: 30, titulo: 'Predice la suma', enunciado: 'Lee el código y escribe lo que imprime.',
            tipo: 'predecir', material: { codigo: 'print(2 + 3)' }, solucion: { respuesta: '5' }
        })).body.data;
        const fail = async (category) => {
            const sent = await migrationPool.query(
                `INSERT INTO envio_ejercicio (id_matricula, id_estudiante, id_ejercicio, id_curso, codigo_pseint, sintaxis_valida, estado_evaluacion)
                 VALUES ($1, $2, $3, $4, 'Algoritmo X FinAlgoritmo', true, 'completado') RETURNING id_envio_ejercicio;`,
                [idEnrollment, studentId, exercises[0].id_ejercicio, courseId]
            );
            await migrationPool.query(
                `INSERT INTO evaluacion_ia (id_envio_ejercicio, id_estudiante, id_curso, puntaje, retroalimentacion, categoria_error)
                 VALUES ($1, $2, $3, 40, 'No cumple el enunciado del ejercicio.', $4);`,
                [sent.rows[0].id_envio_ejercicio, studentId, courseId, category]
            );
        };
        await fail('logica');
        await fail('logica');
        await fail('sintaxis');
        assert.equal((await request(app).get(`/api/gamificacion/refuerzo/${courseId}`).set(sAuth).expect(200)).body.data.necesita_refuerzo, false, '2 fallos de lógica y 1 de sintaxis no bastan');
        await fail('logica');

        const help = (await request(app).get(`/api/gamificacion/refuerzo/${courseId}`).set(sAuth).expect(200)).body.data;
        assert.equal(help.necesita_refuerzo, true);
        assert.equal(help.categoria.categoria, 'logica');
        assert.equal(help.categoria.total, 3);
        assert.equal(help.mundo.id_mundo, worlds[0].id_mundo);
        assert.deepEqual(help.ejercicios.map((item) => item.id_ejercicio), [typed.id_ejercicio]);

        // Al aprobarlo deja de recomendarse.
        const done = await request(app).post(`/api/ejercicios/${typed.id_ejercicio}/envios`).set(sAuth).set('Idempotency-Key', randomUUID()).send({ respuesta: '5' });
        assert.equal(done.status, 201, JSON.stringify(done.body));
        const after = (await request(app).get(`/api/gamificacion/refuerzo/${courseId}`).set(sAuth).expect(200)).body.data;
        assert.deepEqual(after.ejercicios, []);

        // Solo estudiantes.
        await request(app).get(`/api/gamificacion/refuerzo/${courseId}`).set(tAuth).expect(403);
    } finally {
        if (courseId) {
            await pool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = $1`, [courseId]).catch(() => {});
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = $1`, [courseId]).catch(() => {});
        }
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
