'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const age = require('../backend/utils/age');

const today = { year: 2026, month: 11, day: 18 };

test('calcula años cumplidos y respeta el día del cumpleaños', () => {
    assert.equal(age.calculateAge('2010-11-18', today), 16, 'cumple años hoy');
    assert.equal(age.calculateAge('2010-11-19', today), 15, 'cumple mañana');
    assert.equal(age.calculateAge('2010-11-17', today), 16, 'cumplió ayer');
    assert.equal(age.calculateAge('2000-02-29', { year: 2026, month: 2, day: 28 }), 25, 'nacido un 29 de febrero');
    assert.equal(age.calculateAge('2000-02-29', { year: 2026, month: 3, day: 1 }), 26);
    assert.equal(age.calculateAge('2026-11-18', today), 0);
});

test('rechaza textos que no son fechas reales del calendario', () => {
    for (const value of ['2010-02-30', '2010-13-01', '2010-00-10', '10/11/2010', '2010-1-1', '', null, undefined, 20101118]) {
        assert.equal(age.parseDateParts(value), null, String(value));
        assert.equal(age.validateBirthDate(value, today).ok, false, String(value));
    }
});

test('límites de edad: mínima 10, máxima 100 y no se aceptan fechas futuras', () => {
    assert.equal(age.validateBirthDate('2016-11-18', today).ok, true, 'justo 10 años');
    assert.equal(age.validateBirthDate('2016-11-19', today).code, 'UNDER_MIN_AGE', 'a un día de cumplir 10');
    assert.equal(age.validateBirthDate('2027-01-01', today).code, 'INVALID_BIRTH_DATE');
    assert.equal(age.validateBirthDate('1926-11-18', today).ok, true, 'justo 100 años');
    assert.equal(age.validateBirthDate('1920-01-01', today).code, 'INVALID_BIRTH_DATE');
    assert.equal(age.validateBirthDate('2010-11-18', today).fecha, '2010-11-18');
});

test('los términos son obligatorios para todos los roles', () => {
    for (const rol of ['estudiante', 'docente']) {
        const result = age.validateRegistrationProfile({ rol, fecha_nacimiento: '1990-05-05', acepta_terminos: false }, today);
        assert.equal(result.code, 'TERMS_REQUIRED');
    }
    assert.equal(age.validateRegistrationProfile({ rol: 'estudiante', fecha_nacimiento: '1990-05-05', acepta_terminos: 'true' }, today).code, 'TERMS_REQUIRED');
});

test('la fecha de nacimiento es obligatoria solo para estudiantes', () => {
    const student = age.validateRegistrationProfile({ rol: 'estudiante', acepta_terminos: true }, today);
    assert.equal(student.code, 'BIRTH_DATE_REQUIRED');
    const teacher = age.validateRegistrationProfile({ rol: 'docente', acepta_terminos: true }, today);
    assert.equal(teacher.ok, true);
    assert.equal(teacher.fecha, null);
    const badTeacherDate = age.validateRegistrationProfile({ rol: 'docente', fecha_nacimiento: '2030-01-01', acepta_terminos: true }, today);
    assert.equal(badTeacherDate.ok, false, 'si un docente la envía, se valida');
});

test('los menores de 18 necesitan consentimiento de apoderado; los mayores no', () => {
    const minor = { rol: 'estudiante', fecha_nacimiento: '2010-05-05', acepta_terminos: true };
    assert.equal(age.validateRegistrationProfile(minor, today).code, 'GUARDIAN_CONSENT_REQUIRED');
    const withConsent = age.validateRegistrationProfile({ ...minor, consentimiento_tutor: true }, today);
    assert.equal(withConsent.ok, true);
    assert.equal(withConsent.tutor, true);
    const adult = age.validateRegistrationProfile({ rol: 'estudiante', fecha_nacimiento: '2008-11-18', acepta_terminos: true }, today);
    assert.equal(adult.ok, true, 'cumple 18 hoy');
    assert.equal(adult.tutor, false);
    assert.equal(age.validateRegistrationProfile({ rol: 'estudiante', fecha_nacimiento: '2008-11-19', acepta_terminos: true }, today).code, 'GUARDIAN_CONSENT_REQUIRED', 'cumple 18 mañana');
});

test('los rangos de edad cubren todas las edades sin solaparse', () => {
    assert.equal(age.ageBucket(10), 'lt12');
    assert.equal(age.ageBucket(11), 'lt12');
    assert.equal(age.ageBucket(12), '12_14');
    assert.equal(age.ageBucket(14), '12_14');
    assert.equal(age.ageBucket(15), '15_17');
    assert.equal(age.ageBucket(17), '15_17');
    assert.equal(age.ageBucket(18), '18_24');
    assert.equal(age.ageBucket(24), '18_24');
    assert.equal(age.ageBucket(25), '25_34');
    assert.equal(age.ageBucket(35), '35_plus');
    assert.equal(age.ageBucket(99), '35_plus');
    assert.equal(age.ageBucket(null), 'sin_dato');
    assert.equal(age.ageBucket(-1), 'sin_dato');
    for (let value = 0; value <= 110; value += 1) {
        assert.equal(age.BUCKETS.filter((bucket) => value >= bucket.min && value <= bucket.max).length, 1, `edad ${value}`);
    }
});

test('el frontend y el backend calculan igual la edad y comparten constantes', async () => {
    const path = require('node:path');
    const { pathToFileURL } = require('node:url');
    const front = await import(pathToFileURL(path.resolve(__dirname, '../frontend/js/age.js')).href);
    assert.equal(front.MIN_REGISTRATION_AGE, age.MIN_REGISTRATION_AGE);
    assert.equal(front.MAX_REGISTRATION_AGE, age.MAX_REGISTRATION_AGE);
    assert.equal(front.ADULT_AGE, age.ADULT_AGE);
    assert.equal(front.TERMS_VERSION, age.TERMS_VERSION);
    const dates = ['2010-11-18', '2010-11-19', '2000-02-29', '2016-11-18', '2016-11-19', '1926-11-18', '1920-01-01', '2027-01-01', '2010-02-30', 'abc', ''];
    for (const value of dates) {
        assert.equal(front.calculateAge(value, today), age.calculateAge(value, today), value);
        const backend = age.validateBirthDate(value, today);
        const client = front.checkBirthDate(value, today);
        if (value) assert.equal(client.ok, backend.ok, `validez de ${value}`);
    }
    const limits = front.birthDateLimits(today);
    assert.equal(limits.max, '2016-11-18', 'el más joven permitido cumple 10 hoy');
    assert.equal(front.checkBirthDate(limits.max, today).ok, true);
    assert.equal(front.checkBirthDate(limits.min, today).ok, true);
});
