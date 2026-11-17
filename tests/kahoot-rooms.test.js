'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateQuestions } = require('../backend/services/salaService');
const { rankParticipants, calculatePodiumXp } = require('../backend/utils/kahootScoring');

const question = (overrides = {}) => ({
    enunciado: '¿Qué comando muestra texto en PSeInt?',
    opciones: [
        { texto: 'Escribir', es_correcta: true },
        { texto: 'Leer' },
        { texto: 'Definir' }
    ],
    ...overrides
});

test('validateQuestions normaliza etiquetas, tiempos y puntos por defecto', () => {
    const [normalized] = validateQuestions([question({ opciones: [
        { etiqueta: 'Z', texto: ' Escribir ', es_correcta: true },
        { etiqueta: 'Z', texto: 'Leer' }
    ] })]);
    assert.equal(normalized.orden, 1);
    assert.equal(normalized.tiempo_limite_seg, 30);
    assert.equal(normalized.puntos_base, 1000);
    assert.deepEqual(normalized.opciones.map((o) => o.etiqueta), ['A', 'B']);
    assert.equal(normalized.opciones[0].texto, 'Escribir');
    assert.equal(normalized.opciones[1].es_correcta, false);
});

test('validateQuestions rechaza estructuras que romperían la partida', () => {
    const invalidCases = [
        [],
        'no es un arreglo',
        [question({ enunciado: '   ' })],
        [question({ opciones: [{ texto: 'Única', es_correcta: true }] })],
        [question({ opciones: Array.from({ length: 5 }, (_, i) => ({ texto: `Op ${i}`, es_correcta: i === 0 })) })],
        [question({ opciones: [{ texto: 'A' }, { texto: 'B' }] })],
        [question({ opciones: [{ texto: 'A', es_correcta: true }, { texto: 'B', es_correcta: true }] })],
        [question({ opciones: [{ texto: 'A', es_correcta: 'true' }, { texto: 'B' }] })],
        [question({ tiempo_limite_seg: 0 })],
        [question({ tiempo_limite_seg: 9999 })],
        [question({ puntos_base: -5 })],
        [question({ enunciado: 'x'.repeat(501) })],
        Array.from({ length: 51 }, () => question())
    ];
    for (const input of invalidCases) {
        assert.throws(() => validateQuestions(input), (error) => error.status === 400 && error.code === 'INVALID_QUESTIONS');
    }
});

test('rankParticipants desempata por menor tiempo total y es determinista', () => {
    const players = [
        { nombre: 'Zoe', puntajeTotal: 900, tiempoTotalMs: 5000 },
        { nombre: 'Ana', puntajeTotal: 900, tiempoTotalMs: 3000 },
        { nombre: 'Bruno', puntajeTotal: 1200, tiempoTotalMs: 9000 },
        { nombre: 'Carla', puntajeTotal: 900, tiempoTotalMs: 3000 }
    ];
    const original = [...players];
    assert.deepEqual(rankParticipants(players).map((p) => p.nombre), ['Bruno', 'Ana', 'Carla', 'Zoe']);
    assert.deepEqual(players, original, 'no debe mutar el arreglo recibido');
});

test('calculatePodiumXp premia el podio y la participación, pero no a quien no respondió', () => {
    assert.equal(calculatePodiumXp(1, 3), 150);
    assert.equal(calculatePodiumXp(2, 1), 100);
    assert.equal(calculatePodiumXp(3, 2), 50);
    assert.equal(calculatePodiumXp(4, 1), 20);
    assert.equal(calculatePodiumXp(1, 0), 0);
});
