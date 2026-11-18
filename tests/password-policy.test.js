'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const policy = require('../backend/utils/passwordPolicy');
const { isStrongPassword } = require('../backend/utils/validation');

const loadFrontend = () => import(pathToFileURL(path.resolve(__dirname, '../frontend/js/password-policy.js')).href);

test('acepta contraseñas que cumplen todos los requisitos', () => {
    for (const value of ['ClaveSegura2026', 'Abcdefghi1', 'Mi clave 2026 Larga', 'Ñandú2026Fuerte']) {
        assert.equal(isStrongPassword(value), true, value);
    }
});

test('rechaza cada requisito incumplido y dice cuál', () => {
    assert.deepEqual(policy.passwordProblems('Corta1a'), ['Al menos 10 caracteres']);
    assert.ok(policy.passwordProblems('minusculas123').includes('Una letra mayúscula'));
    assert.ok(policy.passwordProblems('MAYUSCULAS123').includes('Una letra minúscula'));
    assert.ok(policy.passwordProblems('SinNumerosAqui').includes('Un número'));
    assert.ok(policy.passwordProblems('A1' + 'a'.repeat(130)).includes('Máximo 128 caracteres'));
});

test('el máximo solo aparece en el checklist cuando se incumple', () => {
    const ok = policy.evaluatePassword('ClaveSegura2026');
    assert.equal(ok.find((rule) => rule.id === 'max').hidden, true);
    const long = policy.evaluatePassword('A1' + 'a'.repeat(130));
    assert.equal(long.find((rule) => rule.id === 'max').hidden, false);
});

test('rechaza contraseñas comunes aunque cumplan formato (con tildes, números o símbolos)', () => {
    for (const value of ['Password123!', 'Contraseña2026', 'Qwerty12345', 'Admin12345', 'Codeint1234', 'Bienvenido2026', 'Peru2026!!!']) {
        assert.equal(isStrongPassword(value), false, value);
    }
    assert.equal(isStrongPassword('1234567890'), false);
    assert.equal(isStrongPassword('aaaaaaaaaaA1'), true, 'una repetición con otras clases no es "un solo carácter"');
});

test('la regla de datos personales solo se evalúa con contexto', () => {
    assert.equal(isStrongPassword('NeilMoreno2026'), true);
    assert.equal(isStrongPassword('NeilMoreno2026', { nombre: 'Neil', apellido: 'Moreno' }), false);
    assert.equal(isStrongPassword('Zq9fruta2026Xx', { email: 'flujo.prueba@utp.edu.pe' }), true);
    assert.equal(isStrongPassword('MiFlujo.Prueba99', { email: 'flujo.prueba@utp.edu.pe' }), false);
    assert.equal(isStrongPassword('Ana2026Clave', { nombre: 'Ana' }), true, 'los nombres de menos de 4 letras no cuentan');
    const withoutContext = policy.evaluatePassword('ClaveSegura2026');
    assert.equal(withoutContext.find((rule) => rule.id === 'personal').hidden, true);
});

test('la fortaleza sube con longitud y símbolo, y es "Débil" si no cumple lo mínimo', () => {
    assert.deepEqual(policy.passwordStrength(''), { score: 0, label: '' });
    assert.deepEqual(policy.passwordStrength('corta'), { score: 1, label: 'Débil' });
    assert.deepEqual(policy.passwordStrength('ClaveSegura2026'), { score: 3, label: 'Buena' });
    assert.deepEqual(policy.passwordStrength('Abcdefghi1'), { score: 2, label: 'Aceptable' });
    assert.deepEqual(policy.passwordStrength('Clave-Segura-2026!'), { score: 4, label: 'Fuerte' });
});

test('el valor no-string nunca es válido', () => {
    for (const value of [undefined, null, 12345678901, {}, []]) assert.equal(isStrongPassword(value), false);
});

test('el frontend y el backend dan exactamente el mismo resultado', async () => {
    const front = await loadFrontend();
    assert.deepEqual(front.COMMON_EXACT, policy.COMMON_EXACT);
    assert.deepEqual(front.COMMON_BASES, policy.COMMON_BASES);
    assert.equal(front.MIN_LENGTH, policy.MIN_LENGTH);
    assert.equal(front.MAX_LENGTH, policy.MAX_LENGTH);
    assert.deepEqual(front.RULES.map((rule) => [rule.id, rule.text]), policy.RULES.map((rule) => [rule.id, rule.text]));

    const samples = [
        '', 'a', 'Corta1a', 'ClaveSegura2026', 'Abcdefghi1', 'Password123!', 'Contraseña2026', 'MAYUSCULAS123',
        'minusculas123', 'SinNumerosAqui', 'NeilMoreno2026', 'MiFlujo.Prueba99', 'Clave-Segura-2026!', 'Ñandú2026Fuerte',
        'A1' + 'a'.repeat(130), '1234567890', 'aaaaaaaaaaaa', 'Bienvenido2026', 'Zq9fruta2026Xx'
    ];
    const contexts = [{}, { nombre: 'Neil', apellido: 'Moreno' }, { email: 'flujo.prueba@utp.edu.pe' }];
    for (const sample of samples) {
        for (const context of contexts) {
            assert.deepEqual(front.evaluatePassword(sample, context), policy.evaluatePassword(sample, context), `${sample} ${JSON.stringify(context)}`);
            assert.deepEqual(front.passwordStrength(sample, context), policy.passwordStrength(sample, context), `fuerza ${sample}`);
            assert.equal(front.isValidPassword(sample, context), policy.isValidPassword(sample, context));
        }
    }
});
