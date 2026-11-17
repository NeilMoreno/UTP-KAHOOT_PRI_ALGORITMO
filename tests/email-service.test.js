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
