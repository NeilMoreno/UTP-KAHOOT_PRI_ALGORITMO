'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('defensa del código: la pregunta sale sin respuesta, se corrige en el servidor y suma señal si falla', { skip: !enabled }, async () => {
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

        const course = await request(app).post('/api/cursos').set(tAuth).send({ nombre: `Test defensa ${randomUUID().slice(0, 6)}`, periodo: '2026-II' });
        courseId = course.body.data.id_curso;
        await request(app).post(`/api/cursos/${courseId}/matricular`).set(tAuth).send({ email: 'estudiante.demo@utp.edu.pe' }).expect(201);
        const worlds = (await request(app).get(`/api/mundos/curso/${courseId}`).set(tAuth).expect(200)).body.data;
        const exerciseId = (await request(app).get(`/api/ejercicios/mundo/${worlds[0].id_mundo}`).set(tAuth).expect(200)).body.data[0].id_ejercicio;
        const enrollment = await migrationPool.query('SELECT id_matricula FROM matricula WHERE id_curso = $1 AND id_estudiante = $2;', [courseId, student.body.user.id_usuario]);

        // Un envío ya evaluado (aprobado) con pregunta de defensa y una señal previa (salió de la pestaña).
        const defense = { pregunta: '¿Qué ocurre si la entrada es cero?', opciones: ['Falla', 'Devuelve cero', 'Se cuelga', 'Imprime texto'], correcta: 1 };
        const senales = { pegados: 0, chars_pegados: 0, max_pegado: 0, cambios_foco: 7, segundos_fuera: 30, copias_enunciado: 0, segundos_abierto: 400, pulsaciones: 300 };
        const sent = await migrationPool.query(
            `INSERT INTO envio_ejercicio (id_matricula, id_estudiante, id_ejercicio, id_curso, codigo_pseint, sintaxis_valida, estado_evaluacion, senales, riesgo, motivos_riesgo)
             VALUES ($1, $2, $3, $4, $5, true, 'completado', $6::jsonb, 'verde', '["SALIO_DE_LA_PESTANA"]'::jsonb) RETURNING id_envio_ejercicio;`,
            [enrollment.rows[0].id_matricula, student.body.user.id_usuario, exerciseId, courseId, 'Algoritmo X\n  Escribir "hola"\nFinAlgoritmo', JSON.stringify(senales)]
        );
        const envio = sent.rows[0].id_envio_ejercicio;
        await migrationPool.query(
            `INSERT INTO evaluacion_ia (id_envio_ejercicio, id_estudiante, id_curso, puntaje, retroalimentacion, categoria_error, defensa)
             VALUES ($1, $2, $3, 90, 'La solución cumple el objetivo del ejercicio.', 'ninguno', $4::jsonb);`,
            [envio, student.body.user.id_usuario, courseId, JSON.stringify(defense)]
        );

        const url = `/api/ejercicios/${exerciseId}/envios/${envio}/defensa`;
        await request(app).post(url).set(tAuth).send({ respuesta: 1 }).expect(403); // solo estudiantes
        await request(app).post(url).set(sAuth).send({ respuesta: 9 }).expect(400);
        await request(app).post(url).set(sAuth).send({ respuesta: 'b' }).expect(400);

        // Respuesta incorrecta: se corrige en el servidor, se revela la correcta y el semáforo sube a ámbar.
        const wrong = await request(app).post(url).set(sAuth).send({ respuesta: 0 });
        assert.equal(wrong.status, 200, JSON.stringify(wrong.body));
        assert.equal(wrong.body.data.correcta, false);
        assert.equal(wrong.body.data.respuesta_correcta, 1);
        await request(app).post(url).set(sAuth).send({ respuesta: 1 }).expect(409); // un solo intento

        const report = (await request(app).get(`/api/analiticas/curso/${courseId}/integridad`).set(tAuth).expect(200)).body.data;
        assert.equal(report.length, 1);
        assert.equal(report[0].riesgo, 'ambar');
        assert.ok(report[0].motivos_riesgo.includes('DEFENSA_FALLIDA'));
        assert.equal(report[0].defensa_correcta, false);

        // Un envío que no existe (o que no es suyo) da 404.
        await request(app).post(`/api/ejercicios/${exerciseId}/envios/${randomUUID()}/defensa`).set(sAuth).send({ respuesta: 1 }).expect(404);
    } finally {
        if (courseId) {
            await pool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = $1`, [courseId]).catch(() => {});
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = $1`, [courseId]).catch(() => {});
        }
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
