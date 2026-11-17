'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateRoomPin, calculateKahootScore } = require('../backend/utils/kahootScoring');

test('generateRoomPin produce cadenas de exactamente 6 dígitos numéricos', () => {
    for (let i = 0; i < 50; i++) {
        const pin = generateRoomPin();
        assert.equal(typeof pin, 'string');
        assert.equal(pin.length, 6);
        assert.match(pin, /^\d{6}$/);
        const num = parseInt(pin, 10);
        assert.ok(num >= 100000 && num <= 999999);
    }
});

test('calculateKahootScore devuelve 0 si la respuesta no es correcta', () => {
    const score = calculateKahootScore({
        isCorrect: false,
        tiempoRespuestaSeg: 2,
        tiempoLimiteSeg: 30,
        puntosBase: 1000
    });
    assert.equal(score, 0);
});

test('calculateKahootScore otorga el máximo de puntos (1000) si el tiempo es 0', () => {
    const score = calculateKahootScore({
        isCorrect: true,
        tiempoRespuestaSeg: 0,
        tiempoLimiteSeg: 30,
        puntosBase: 1000
    });
    assert.equal(score, 1000);
});

test('calculateKahootScore otorga el 50% de puntos (500) si se responde exactamente en el límite', () => {
    const score = calculateKahootScore({
        isCorrect: true,
        tiempoRespuestaSeg: 30,
        tiempoLimiteSeg: 30,
        puntosBase: 1000
    });
    // round(1000 * (1 - 30 / (2 * 30))) = round(1000 * 0.5) = 500
    assert.equal(score, 500);
});

test('calculateKahootScore devuelve 0 si se responde después del tiempo límite', () => {
    const score = calculateKahootScore({
        isCorrect: true,
        tiempoRespuestaSeg: 31,
        tiempoLimiteSeg: 30,
        puntosBase: 1000
    });
    assert.equal(score, 0);
});

test('calculateKahootScore calcula valores intermedios precisos con tiempos decimales', () => {
    // tiempo = 15 seg en límite 30 -> ratio = 15 / 60 = 0.25 -> 1 - 0.25 = 0.75 -> 750 pts
    const score = calculateKahootScore({
        isCorrect: true,
        tiempoRespuestaSeg: 15,
        tiempoLimiteSeg: 30,
        puntosBase: 1000
    });
    assert.equal(score, 750);

    // tiempo = 6 seg en límite 30 -> ratio = 6 / 60 = 0.1 -> 1 - 0.1 = 0.9 -> 900 pts
    const scoreFast = calculateKahootScore({
        isCorrect: true,
        tiempoRespuestaSeg: 6,
        tiempoLimiteSeg: 30,
        puntosBase: 1000
    });
    assert.equal(scoreFast, 900);
});
