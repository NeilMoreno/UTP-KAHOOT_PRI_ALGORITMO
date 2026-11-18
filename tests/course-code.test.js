'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCourseCode, isValidCourseCode, baseCode } = require('../backend/utils/courseCode');

test('usa las iniciales de las palabras significativas y conserva el nivel', () => {
    assert.equal(baseCode('Estructuras de Datos II'), 'ED2');
    assert.equal(baseCode('Algoritmos y Lógica de Programación'), 'ALP');
    assert.equal(baseCode('Base de Datos 3'), 'BD3');
    assert.equal(baseCode('Introducción a la Ingeniería de Software'), 'IIS');
});

test('una sola palabra usa sus 4 primeras letras y se ignoran tildes', () => {
    assert.equal(baseCode('Programación'), 'PROG');
    assert.equal(baseCode('Cálculo'), 'CALC');
});

test('un nombre sin letras utilizables no genera código', () => {
    assert.equal(generateCourseCode('   ', []), null);
    assert.equal(generateCourseCode('!!', []), null);
});

test('si el código ya existe en la institución y periodo añade un sufijo', () => {
    assert.equal(generateCourseCode('Estructuras de Datos II', []), 'ED2');
    assert.equal(generateCourseCode('Estructuras de Datos II', ['ED2']), 'ED2-2');
    assert.equal(generateCourseCode('Estructuras de Datos II', ['ed2', 'ED2-2']), 'ED2-3');
});

test('el código generado siempre cumple el formato permitido', () => {
    for (const nombre of ['Estructuras de Datos II', 'Programación', 'Cálculo Diferencial e Integral IV', 'A B C D E F G H']) {
        assert.ok(isValidCourseCode(generateCourseCode(nombre, [])), nombre);
    }
    assert.equal(isValidCourseCode('ab cd'), false);
    assert.equal(isValidCourseCode('X'), false);
});

test('los números romanos y arábigos finales se tratan igual', () => {
    assert.equal(baseCode('Física II'), 'FISI2');
    assert.equal(baseCode('Física 2'), 'FISI2');
});
