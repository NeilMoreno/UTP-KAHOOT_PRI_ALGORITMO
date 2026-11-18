'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const databasePath = require.resolve('../backend/config/database');
const tokenServicePath = require.resolve('../backend/services/tokenService');
const auditServicePath = require.resolve('../backend/services/securityAuditService');
const controllerPath = require.resolve('../backend/controllers/identityController');

const loadController = ({ query, getClient, auditCalls = [] }) => {
    require.cache[databasePath] = {
        id: databasePath,
        filename: databasePath,
        loaded: true,
        exports: { query, getClient }
    };
    require.cache[tokenServicePath] = {
        id: tokenServicePath,
        filename: tokenServicePath,
        loaded: true,
        exports: { generateToken: () => 'jwt-de-prueba' }
    };
    require.cache[auditServicePath] = {
        id: auditServicePath,
        filename: auditServicePath,
        loaded: true,
        exports: {
            getRequestIp: () => '127.0.0.1',
            recordSecurityEvent: async (_executor, event) => { auditCalls.push(event); }
        }
    };
    delete require.cache[controllerPath];
    return require(controllerPath);
};

const makeResponse = () => {
    const state = { statusCode: 200, body: null };
    return {
        state,
        res: {
            status(code) { state.statusCode = code; return this; },
            json(body) { state.body = body; return this; }
        }
    };
};

test('el registro rechaza rol e institución enviados por el cliente antes de consultar PostgreSQL', async () => {
    let clientRequested = false;
    const { registerByInvitation } = loadController({
        query: async () => { throw new Error('No debe consultar'); },
        getClient: async () => { clientRequested = true; throw new Error('No debe solicitar cliente'); }
    });
    const { state, res } = makeResponse();

    await registerByInvitation({
        body: {
            invitation_token: 'A'.repeat(43),
            nombre: 'Prueba',
            apellido: 'Seguridad',
            password: 'ClaveSegura2026',
            genero: 'femenino',
            rol: 'superadministrador'
        }
    }, res, error => { throw error; });

    assert.equal(state.statusCode, 400);
    assert.equal(clientRequested, false);
});

test('la consulta de invitación usa únicamente el hash parametrizado, nunca el token original', async () => {
    const calls = [];
    const token = 'B'.repeat(43);
    const { inspectInvitation } = loadController({
        query: async (sql, params) => {
            calls.push({ sql, params });
            return { rowCount: 0, rows: [] };
        },
        getClient: async () => { throw new Error('No debe solicitar cliente'); }
    });
    const { state, res } = makeResponse();

    await inspectInvitation({ body: { invitation_token: token } }, res, error => { throw error; });

    assert.equal(state.statusCode, 404);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sql.includes(token), false);
    assert.deepEqual(calls[0].params, [crypto.createHash('sha256').update(token).digest('hex')]);
});

test('el alta deriva correo, rol e institución de una invitación bloqueada y parametrizada', async () => {
    process.env.BCRYPT_ROUNDS = '10';
    const token = 'C'.repeat(43);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const calls = [];
    const auditCalls = [];
    let released = false;
    const client = {
        async query(sql, params = []) {
            calls.push({ sql, params });
            if (/FROM invitacion_usuario inv/.test(sql)) {
                return {
                    rowCount: 1,
                    rows: [{
                        id_invitacion_usuario: '11111111-1111-4111-8111-111111111111',
                        id_institucion: '22222222-2222-4222-8222-222222222222',
                        email: 'invitado@utp.edu.pe',
                        rol: 'docente',
                        estado: 'pendiente',
                        expira_en: new Date(Date.now() + 60_000).toISOString(),
                        creada_por: '33333333-3333-4333-8333-333333333333',
                        institucion_nombre: 'UTP',
                        institucion_estado: 'activa'
                    }]
                };
            }
            if (/FROM institucion_dominio/.test(sql)) return { rowCount: 1, rows: [{ exists: 1 }] };
            if (/INSERT INTO usuario/.test(sql)) {
                return {
                    rowCount: 1,
                    rows: [{
                        id_usuario: '44444444-4444-4444-8444-444444444444',
                        id_institucion: params[0],
                        nombre: params[1],
                        apellido: params[2],
                        email: params[3],
                        rol: params[5],
                        genero: params[6],
                        estado: 'activo',
                        correo_verificado: true,
                        token_version: 0
                    }]
                };
            }
            return { rowCount: 1, rows: [] };
        },
        release() { released = true; }
    };
    const { registerByInvitation } = loadController({
        query: async () => { throw new Error('Debe usar la transacción'); },
        getClient: async () => client,
        auditCalls
    });
    const { state, res } = makeResponse();

    await registerByInvitation({
        body: {
            invitation_token: token,
            nombre: 'Docente',
            apellido: 'Seguro',
            email: 'atacante@evil.example',
            password: 'ClaveSegura2026',
            genero: 'masculino',
            acepta_terminos: true,
            fecha_nacimiento: '1985-03-10'
        }
    }, res, error => { throw error; });

    const invitationSelect = calls.find(call => /FROM invitacion_usuario inv/.test(call.sql));
    const insert = calls.find(call => /INSERT INTO usuario/.test(call.sql));
    assert.equal(state.statusCode, 201);
    assert.equal(state.body.token, 'jwt-de-prueba');
    assert.deepEqual(invitationSelect.params, [tokenHash]);
    assert.equal(invitationSelect.sql.includes(token), false);
    assert.equal(insert.params[0], '22222222-2222-4222-8222-222222222222');
    assert.equal(insert.params[3], 'invitado@utp.edu.pe');
    assert.equal(insert.params[5], 'docente');
    assert.equal(insert.params[6], 'masculino');
    assert.equal(insert.params.includes('atacante@evil.example'), false);
    // Datos de perfil: fecha parametrizada, versión de términos vigente y sin consentimiento de tutor (adulto).
    assert.equal(insert.params[7], '1985-03-10');
    assert.equal(insert.params[8], '2026-11');
    assert.equal(insert.params[9], false);
    assert.equal(/\$8::date/.test(insert.sql), true, 'la fecha viaja como parámetro, nunca concatenada');
    assert.equal(auditCalls[0].action, 'REGISTRO_POR_INVITACION');
    assert.equal(released, true);
});