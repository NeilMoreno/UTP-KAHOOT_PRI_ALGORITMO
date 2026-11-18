'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizePersonName,
    normalizeEmail,
    isStrongPassword,
    normalizeGenero,
    buildGreeting,
    isUuid
} = require('../backend/utils/validation');

test('acepta nombres reales y rechaza simbolos, HTML y numeros', () => {
    assert.equal(normalizePersonName('  Maria-Jose  '), 'Maria-Jose');
    assert.equal(normalizePersonName("O'Connor"), "O'Connor");
    assert.equal(normalizePersonName('De la Cruz'), 'De la Cruz');
    assert.equal(normalizePersonName('123@'), null);
    assert.equal(normalizePersonName('**//'), null);
    assert.equal(normalizePersonName('<script>alert(1)</script>'), null);
});

test('normaliza correos válidos y rechaza entradas de inyección', () => {
    assert.equal(normalizeEmail('  Alumno@UTP.EDU.PE '), 'alumno@utp.edu.pe');
    assert.equal(normalizeEmail("' OR 1=1 --"), null);
    assert.equal(normalizeEmail({ email: 'x@y.com' }), null);
});

test('exige contraseñas de longitud y composición mínimas', () => {
    assert.equal(isStrongPassword('corta123'), false);
    assert.equal(isStrongPassword('todominusculas123'), false, 'falta una mayúscula');
    assert.equal(isStrongPassword('sinNumerosPeroLarga'), false);
    assert.equal(isStrongPassword('ClaveSegura2026'), true);
});

test('normaliza género y genera un saludo respetuoso', () => {
    assert.equal(normalizeGenero('FEMENINO'), 'femenino');
    assert.equal(normalizeGenero(undefined), null);
    assert.equal(normalizeGenero('valor_inventado'), null);
    assert.equal(normalizeGenero('no_binario'), null);
    assert.equal(buildGreeting('Ana', 'femenino'), 'Bienvenida a codeInt, Ana.');
    assert.equal(buildGreeting('Luis', 'masculino'), 'Bienvenido a codeInt, Luis.');
});

test('valida UUID antes de consultar PostgreSQL', () => {
    assert.equal(isUuid('550e8400-e29b-41d4-a716-446655440000'), true);
    assert.equal(isUuid("1' OR '1'='1"), false);
});
