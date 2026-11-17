'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-with-at-least-32-characters';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../backend/server');
const { pool } = require('../backend/config/database');
const { getAuthorizedCourse } = require('../backend/services/authorizationService');

test.after(async () => {
    await pool.end();
});

test('health incluye cabeceras seguras y no divulga la versión de PostgreSQL', async () => {
    const response = await request(app).get('/api/health').expect(200);
    assert.equal(response.headers['x-powered-by'], undefined);
    assert.ok(response.headers['x-content-type-options']);
    assert.equal(response.headers['cross-origin-embedder-policy'], 'credentialless');
    assert.equal(
        response.headers['permissions-policy'],
        'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
    );
    assert.equal(response.body.sgbd, undefined);
});

test('CORS rechaza orígenes que no están autorizados', async () => {
    const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://evil.example');
    assert.equal(response.status, 403);
});

test('CORS no bloquea las peticiones del propio origen (scripts del frontend)', async () => {
    const response = await request(app)
        .get('/api/health')
        .set('Host', 'app.codeint.test')
        .set('Origin', 'http://app.codeint.test');
    assert.equal(response.status, 200);
    const foreign = await request(app)
        .get('/api/health')
        .set('Host', 'app.codeint.test')
        .set('Origin', 'http://otro-sitio.test');
    assert.equal(foreign.status, 403);
});

test('login rechaza un payload clásico de inyección SQL sin consultar credenciales', async () => {
    const response = await request(app)
        .post('/api/auth/login')
        .send({ email: "' OR 1=1 --", password: 'cualquier-clave' });
    assert.equal(response.status, 401);
    assert.equal(response.body.message, 'Credenciales inválidas.');
});

test('registro público impide elevarse a superadministrador', async () => {
    const response = await request(app)
        .post('/api/auth/register')
        .send({
            nombre: 'Ataque',
            apellido: 'Prueba',
            email: 'ataque@example.test',
            password: 'ClaveSegura2026',
            rol: 'superadministrador',
            genero: 'femenino',
            codigo_licencia: 'CODIGO-PRUEBA'
        });
    assert.equal(response.status, 400);
});

test('identificadores manipulados se rechazan antes de llegar a PostgreSQL', async () => {
    await assert.rejects(
        getAuthorizedCourse("1' OR '1'='1", { id_usuario: 'x', rol: 'estudiante' }),
        error => error.status === 400 && error.code === 'INVALID_ID'
    );
});
