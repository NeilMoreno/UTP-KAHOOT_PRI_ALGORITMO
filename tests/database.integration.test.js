'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = process.env.RUN_DB_TESTS === '1';

test('login real y perfil autenticado contra PostgreSQL', { skip: !enabled }, async () => {
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');

    try {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' })
            .expect(200);

        assert.ok(login.body.token);
        assert.equal(login.body.user.rol, 'estudiante');
        assert.ok(login.body.user.genero);
        assert.match(login.body.message, /bienvenid/i);

        const me = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${login.body.token}`)
            .expect(200);

        assert.equal(me.body.user.id_usuario, login.body.user.id_usuario);
        assert.equal(me.body.user.email, 'estudiante.demo@utp.edu.pe');
    } finally {
        await pool.end();
    }
});
