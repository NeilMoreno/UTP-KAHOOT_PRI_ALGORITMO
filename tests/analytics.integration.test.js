'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = process.env.RUN_DB_TESTS === '1';

test('las analíticas exponen agregados del curso con permisos por rol', { skip: !enabled }, async () => {
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');

    try {
        const [teacherLogin, studentLogin, adminLogin] = await Promise.all([
            request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' }),
            request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' }),
            request(app).post('/api/auth/login').send({ email: 'admin@codeintcorp.com', password: 'codeint123' })
        ]);
        assert.equal(teacherLogin.status, 200);
        assert.equal(studentLogin.status, 200);
        assert.equal(adminLogin.status, 200);

        const teacherAuth = { Authorization: `Bearer ${teacherLogin.body.token}` };
        const studentAuth = { Authorization: `Bearer ${studentLogin.body.token}` };
        const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` };

        const summary = await request(app).get('/api/analiticas/cursos').set(teacherAuth).expect(200);
        assert.ok(summary.body.data.length >= 1);
        const course = summary.body.data[0];
        assert.ok(Number.isInteger(Number(course.total_estudiantes)));
        assert.ok(Number.isInteger(Number(course.porcentaje_avance)));

        const detail = await request(app).get(`/api/analiticas/curso/${course.id_curso}`).set(teacherAuth).expect(200);
        assert.equal(detail.body.data.curso.id_curso, course.id_curso);
        assert.ok(Array.isArray(detail.body.data.mundos));
        assert.ok(Array.isArray(detail.body.data.estudiantes));
        assert.ok(Array.isArray(detail.body.data.categorias_error));
        assert.ok(Array.isArray(detail.body.data.salas));

        if (detail.body.data.estudiantes.length > 0) {
            const student = detail.body.data.estudiantes[0];
            const studentDetail = await request(app)
                .get(`/api/analiticas/curso/${course.id_curso}/estudiante/${student.id_estudiante}`)
                .set(teacherAuth)
                .expect(200);
            assert.ok(Array.isArray(studentDetail.body.data.mundos));
            assert.ok(Array.isArray(studentDetail.body.data.envios));
        }

        await request(app).get('/api/analiticas/cursos').set(adminAuth).expect(200);
        await request(app).get('/api/analiticas/cursos').set(studentAuth).expect(403);
        await request(app).get('/api/analiticas/curso/no-es-uuid').set(teacherAuth).expect(400);
    } finally {
        await pool.end();
    }
});
