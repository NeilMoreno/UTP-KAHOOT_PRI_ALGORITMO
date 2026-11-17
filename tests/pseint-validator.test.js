'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePseInt } = require('../backend/services/pseintValidator');

test('acepta un algoritmo PSeInt con estructuras anidadas', () => {
    const result = validatePseInt(`Algoritmo Promedio
    Definir nota Como Real
    Leer nota
    Si nota >= 0 Entonces
        Mientras nota > 20 Hacer
            Leer nota
        FinMientras
    Sino
        Escribir "Nota inválida"
    FinSi
FinAlgoritmo`);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});

test('acepta Proceso con comentarios que contienen palabras reservadas', () => {
    const result = validatePseInt(`Proceso Demo
    Escribir "// FinSi no es un comentario dentro del texto"
    // Si verdadero Entonces
FinProceso`);

    assert.equal(result.valid, true);
});

test('rechaza código sin programa principal', () => {
    const result = validatePseInt('Escribir "hola"');

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.code === 'PROGRAM_START_COUNT'));
    assert.ok(result.errors.some(error => error.code === 'PROGRAM_END_COUNT'));
});

test('informa la línea de una estructura sin cerrar', () => {
    const result = validatePseInt(`Algoritmo Demo
    Si Verdadero Entonces
        Escribir "hola"
FinAlgoritmo`);

    assert.equal(result.valid, false);
    assert.deepEqual(
        result.errors.find(error => error.code === 'UNCLOSED_STRUCTURE'),
        {
            code: 'UNCLOSED_STRUCTURE',
            line: 2,
            message: 'Falta FinSi para la estructura abierta en la línea 2.'
        }
    );
});

test('rechaza cierres fuera de orden', () => {
    const result = validatePseInt(`Algoritmo Demo
    Si Verdadero Entonces
        Para i <- 1 Hasta 3 Hacer
            Escribir i
        FinSi
    FinPara
FinAlgoritmo`);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.code === 'MISMATCHED_CLOSER' && error.line === 5));
});

test('rechaza código que excede el límite configurado', () => {
    const result = validatePseInt('Algoritmo Demo\nFinAlgoritmo', { maxLength: 10 });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.code === 'CODE_TOO_LONG'));
});

test('avisa cuando el programa no contiene instrucciones', () => {
    const result = validatePseInt('Algoritmo Vacio\nFinAlgoritmo');

    assert.equal(result.valid, true);
    assert.ok(result.warnings.some(warning => warning.code === 'EMPTY_PROGRAM'));
});
