'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeDomain,
    getEmailDomain
} = require('../backend/utils/validation');
const {
    generateOpaqueToken,
    hashOpaqueToken,
    isOpaqueToken
} = require('../backend/utils/securityTokens');

test('normaliza dominios institucionales sin aceptar URLs, arrobas internas ni inyección', () => {
    assert.equal(normalizeDomain(' @UTP.EDU.PE '), 'utp.edu.pe');
    assert.equal(normalizeDomain('https://utp.edu.pe'), null);
    assert.equal(normalizeDomain('utp.edu.pe/path'), null);
    assert.equal(normalizeDomain("utp.edu.pe' OR 1=1 --"), null);
    assert.equal(normalizeDomain('usuario@utp.edu.pe'), null);
});

test('extrae el dominio solamente desde correos sintácticamente válidos', () => {
    assert.equal(getEmailDomain('Alumno@UTP.EDU.PE'), 'utp.edu.pe');
    assert.equal(getEmailDomain('correo-sin-arroba.local'), null);
});

test('los tokens opacos son aleatorios y se persisten únicamente como SHA-256', () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();
    assert.equal(isOpaqueToken(first), true);
    assert.equal(isOpaqueToken(second), true);
    assert.notEqual(first, second);
    assert.match(hashOpaqueToken(first), /^[0-9a-f]{64}$/);
    assert.notEqual(hashOpaqueToken(first), first);
});
