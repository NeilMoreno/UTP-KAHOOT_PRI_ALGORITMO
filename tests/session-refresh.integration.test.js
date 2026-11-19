'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = process.env.RUN_DB_TESTS === '1';

const cookieOf = (response) => {
    const raw = [].concat(response.headers['set-cookie'] || []).find((item) => item.startsWith('codeint_refresh='));
    return raw || null;
};

test('refresco de sesión: cookie HttpOnly, renovación, cierre y revocación', { skip: !enabled }, async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    try {
        const login = await request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' });
        assert.equal(login.status, 200);
        const set = cookieOf(login);
        assert.ok(set, 'el inicio de sesión entrega la cookie de refresco');
        assert.match(set, /HttpOnly/);
        assert.match(set, /SameSite=Strict/);
        assert.match(set, /Path=\/api\/auth/);
        const cookie = set.split(';')[0];

        const none = await request(app).post('/api/auth/refresh');
        assert.equal(none.status, 401);
        assert.equal(none.body.error, 'NO_REFRESH');

        const forged = await request(app).post('/api/auth/refresh').set('Cookie', 'codeint_refresh=abc.def.ghi');
        assert.equal(forged.status, 401);

        // El token de acceso NO sirve como token de refresco (otra audiencia).
        const wrong = await request(app).post('/api/auth/refresh').set('Cookie', `codeint_refresh=${login.body.token}`);
        assert.equal(wrong.status, 401);

        const renewed = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
        assert.equal(renewed.status, 200);
        assert.ok(renewed.body.token);
        assert.ok(cookieOf(renewed), 'la ventana se desliza: se emite una cookie nueva');
        await request(app).get('/api/auth/me').set('Authorization', `Bearer ${renewed.body.token}`).expect(200);

        const out = await request(app).post('/api/auth/logout');
        assert.equal(out.status, 200);
        assert.match(cookieOf(out), /Max-Age=0/);

        // "Cerrar todas las sesiones" invalida las cookies emitidas antes (token_version).
        await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${renewed.body.token}`).expect(200);
        const revoked = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
        assert.equal(revoked.status, 401);
        assert.equal(revoked.body.error, 'SESSION_REVOKED');
    } finally {
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
