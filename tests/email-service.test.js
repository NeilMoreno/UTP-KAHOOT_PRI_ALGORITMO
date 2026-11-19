'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildInvitationUrl,
    buildPasswordResetUrl
} = require('../backend/services/emailService');

const withEnv = (name, value, callback) => {
    const previous = process.env[name];
    process.env[name] = value;
    try {
        return callback();
    } finally {
        if (previous === undefined) delete process.env[name];
        else process.env[name] = previous;
    }
};

const parseHashRoute = (url) => new URL(url.hash.slice(1), 'http://codeint.local');

test('la invitación coloca el token dentro de la ruta hash', () => {
    withEnv('FRONTEND_INVITATION_URL', 'http://localhost:3000/#/registro', () => {
        const url = new URL(buildInvitationUrl('token-123'));
        assert.equal(url.origin, 'http://localhost:3000');
        assert.equal(url.pathname, '/');
        assert.equal(url.search, '');
        const route = parseHashRoute(url);
        assert.equal(route.pathname, '/registro');
        assert.equal(route.searchParams.get('token'), 'token-123');
    });
});

test('la invitación conserva otros parámetros de la ruta hash', () => {
    withEnv('FRONTEND_INVITATION_URL', 'http://localhost:3000/#/registro?lang=es', () => {
        const route = parseHashRoute(new URL(buildInvitationUrl('token-456')));
        assert.equal(route.pathname, '/registro');
        assert.equal(route.searchParams.get('lang'), 'es');
        assert.equal(route.searchParams.get('token'), 'token-456');
    });
});

test('la invitación sigue funcionando con una URL sin hash', () => {
    withEnv('FRONTEND_INVITATION_URL', 'https://codeint.example.com/registro', () => {
        const url = new URL(buildInvitationUrl('token-789'));
        assert.equal(url.pathname, '/registro');
        assert.equal(url.hash, '');
        assert.equal(url.searchParams.get('token'), 'token-789');
    });
});

test('la recuperación coloca el token dentro de la ruta hash', () => {
    withEnv('FRONTEND_PASSWORD_RESET_URL', 'http://localhost:3000/#/restablecer-password', () => {
        const route = parseHashRoute(new URL(buildPasswordResetUrl('reset-abc')));
        assert.equal(route.pathname, '/restablecer-password');
        assert.equal(route.searchParams.get('token'), 'reset-abc');
    });
});

test('el token se codifica como parámetro seguro', () => {
    withEnv('FRONTEND_INVITATION_URL', 'http://localhost:3000/#/registro', () => {
        const token = 'a b&c=d/e';
        const route = parseHashRoute(new URL(buildInvitationUrl(token)));
        assert.equal(route.searchParams.get('token'), token);
    });
});

test('Mailtrap envía a la bandeja de pruebas con el token y reintenta ante 503', async () => {
    const { sendTransactionalEmail, EmailDeliveryError } = require('../backend/services/emailService');
    const originalFetch = global.fetch;
    const saved = ['EMAIL_PROVIDER', 'MAILTRAP_API_TOKEN', 'MAILTRAP_INBOX_ID', 'EMAIL_FROM_ADDRESS'].map((key) => [key, process.env[key]]);
    Object.assign(process.env, { EMAIL_PROVIDER: 'mailtrap', MAILTRAP_API_TOKEN: 'tok', MAILTRAP_INBOX_ID: '12345', EMAIL_FROM_ADDRESS: 'no-reply@codeint.test' });
    try {
        const calls = [];
        global.fetch = async (url, init) => {
            calls.push({ url, init });
            return calls.length === 1 ? { ok: false, status: 503 } : { ok: true, status: 200 };
        };
        const result = await sendTransactionalEmail({ to: 'alumno@utp.edu.pe', subject: 'Hola', text: 't', html: '<p>t</p>' });
        assert.deepEqual(result, { sent: true, provider: 'mailtrap' });
        assert.equal(calls.length, 2);
        assert.equal(calls[1].url, 'https://sandbox.api.mailtrap.io/api/send/12345');
        assert.equal(calls[1].init.headers.Authorization, 'Bearer tok');
        const body = JSON.parse(calls[1].init.body);
        assert.deepEqual(body.to, [{ email: 'alumno@utp.edu.pe' }]);
        assert.equal(body.from.email, 'no-reply@codeint.test');

        // Una bandeja mal configurada falla antes de llamar a la red.
        process.env.MAILTRAP_INBOX_ID = 'no-numerico';
        calls.length = 0;
        await assert.rejects(sendTransactionalEmail({ to: 'a@utp.edu.pe', subject: 's', text: 't', html: 'h' }), EmailDeliveryError);
        assert.equal(calls.length, 0);
    } finally {
        global.fetch = originalFetch;
        for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
});
