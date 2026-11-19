'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('diagnóstico de entrada: corrección local, convalidación de mundos y un solo intento', { skip: !enabled }, async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    let courseId = null;
    try {
        const teacher = await request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' });
        assert.equal(teacher.status, 200);
        const tAuth = { Authorization: `Bearer ${teacher.body.token}` };
        const student = await request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' });
        assert.equal(student.status, 200);
        const sAuth = { Authorization: `Bearer ${student.body.token}` };

        const course = await request(app).post('/api/cursos').set(tAuth).send({ nombre: `Test diag ${randomUUID().slice(0, 6)}`, periodo: '2026-II' });
        assert.equal(course.status, 201);
        courseId = course.body.data.id_curso;
        await request(app).post(`/api/cursos/${courseId}/matricular`).set(tAuth).send({ email: 'estudiante.demo@utp.edu.pe' }).expect(201);

        // Sin banco de preguntas no hay diagnóstico.
        const none = await request(app).get(`/api/cursos/${courseId}/diagnostico`).set(sAuth).expect(200);
        assert.equal(none.body.data.disponible, false);

        // Banco: una pregunta (correcta = "B") en cada uno de los tres primeros mundos.
        const worlds = (await request(app).get(`/api/mundos/curso/${courseId}`).set(tAuth).expect(200)).body.data;
        for (const world of worlds.slice(0, 3)) {
            const options = ['A', 'B', 'C', 'D'].map((texto) => ({ texto: `${texto}-${world.orden}`, es_correcta: texto === 'B' }));
            await migrationPool.query(
                `INSERT INTO banco_pregunta (id_curso, id_mundo, enunciado, opciones) VALUES ($1, $2, $3, $4::jsonb);`,
                [courseId, world.id_mundo, `Pregunta del mundo ${world.orden}`, JSON.stringify(options)]
            );
        }

        const quiz = (await request(app).get(`/api/cursos/${courseId}/diagnostico`).set(sAuth).expect(200)).body.data;
        assert.equal(quiz.disponible, true);
        assert.equal(quiz.preguntas.length, 3);
        assert.deepEqual(quiz.preguntas.map((q) => q.mundo_orden), [1, 2, 3]);
        assert.ok(!JSON.stringify(quiz).includes('es_correcta'), 'nunca se envía la respuesta correcta');

        // Un docente no hace el diagnóstico.
        await request(app).get(`/api/cursos/${courseId}/diagnostico`).set(tAuth).expect(403);

        // Acierta los mundos 1 y 2 y falla el 3 → 2 mundos convalidados.
        const answers = quiz.preguntas.map((q) => ({
            id_banco_pregunta: q.id_banco_pregunta,
            respuesta: `${q.mundo_orden === 3 ? 'A' : 'B'}-${q.mundo_orden}`
        }));
        const graded = await request(app).post(`/api/cursos/${courseId}/diagnostico`).set(sAuth).send({ respuestas: answers });
        assert.equal(graded.status, 200, JSON.stringify(graded.body));
        assert.equal(graded.body.data.aciertos, 2);
        assert.equal(graded.body.data.mundos_convalidados, 2);

        // Un solo intento.
        const again = await request(app).post(`/api/cursos/${courseId}/diagnostico`).set(sAuth).send({ respuestas: answers });
        assert.equal(again.status, 409);
        const done = (await request(app).get(`/api/cursos/${courseId}/diagnostico`).set(sAuth).expect(200)).body.data;
        assert.equal(done.realizado, true);
        assert.equal(done.mundos_convalidados, 2);

        // El mundo 3 queda desbloqueado y el 4 sigue bloqueado; el siguiente ejercicio es del mundo 3.
        const map = (await request(app).get(`/api/mundos/curso/${courseId}`).set(sAuth).expect(200)).body.data;
        assert.equal(map[0].convalidado, true);
        assert.equal(map[2].desbloqueado, true);
        assert.equal(map[3].desbloqueado, false);
        const next = (await request(app).get(`/api/mundos/curso/${courseId}/siguiente`).set(sAuth).expect(200)).body.data;
        assert.equal(next.orden_mundo, 3);
        await request(app).get(`/api/ejercicios/mundo/${worlds[2].id_mundo}`).set(sAuth).expect(200);
        await request(app).get(`/api/ejercicios/mundo/${worlds[3].id_mundo}`).set(sAuth).expect(403);
    } finally {
        if (courseId) {
            await pool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = $1`, [courseId]).catch(() => {});
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = $1`, [courseId]).catch(() => {});
        }
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
