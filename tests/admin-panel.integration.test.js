'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = process.env.RUN_DB_TESTS === '1';

test('el panel administrativo lista usuarios e instituciones con permisos de superadministrador', { skip: !enabled }, async () => {
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');

    try {
        const [adminLogin, teacherLogin] = await Promise.all([
            request(app).post('/api/auth/login').send({ email: 'admin@codeintcorp.com', password: 'codeint123' }),
            request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' })
        ]);
        assert.equal(adminLogin.status, 200);
        assert.equal(teacherLogin.status, 200);

        const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` };
        const teacherAuth = { Authorization: `Bearer ${teacherLogin.body.token}` };

        const users = await request(app).get('/api/auth/usuarios').set(adminAuth).expect(200);
        assert.ok(Array.isArray(users.body.data));
        assert.ok(users.body.data.some((user) => user.email === 'docente.demo@utp.edu.pe'));
        assert.ok(users.body.data.some((user) => user.rol === 'superadministrador'));

        const teachers = await request(app).get('/api/auth/usuarios?rol=docente&estado=activo').set(adminAuth).expect(200);
        assert.ok(teachers.body.data.every((user) => user.rol === 'docente' && user.estado === 'activo'));

        const institutions = await request(app).get('/api/auth/admin/instituciones').set(adminAuth).expect(200);
        assert.ok(institutions.body.data.length >= 1);
        for (const institution of institutions.body.data) {
            assert.ok(Array.isArray(institution.dominios));
            assert.ok(Number.isInteger(Number(institution.total_usuarios)));
            assert.ok(Number.isInteger(Number(institution.total_cursos)));
        }

        await request(app).get('/api/auth/usuarios?rol=invalido').set(adminAuth).expect(400);
        await request(app).get('/api/auth/usuarios').set(teacherAuth).expect(403);
        await request(app).get('/api/auth/admin/instituciones').set(teacherAuth).expect(403);
    } finally {
        await pool.end();
    }
});
