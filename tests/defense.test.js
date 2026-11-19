'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEvaluation, buildPrompt, EVALUATION_SCHEMA } = require('../backend/services/geminiService');
const { assessRisk } = require('../backend/services/integrityService');

const base = {
    puntaje: 85,
    categoria_error: 'ninguno',
    retroalimentacion: 'La solución cumple el objetivo y maneja correctamente el caso principal.',
    sugerencias: [],
    eficiencia_algoritmica: 'La complejidad temporal es lineal.',
    codigo_sugerido_mejora: '',
    intento_manipulacion: false
};

test('la pregunta de defensa válida se conserva y la incompleta se descarta sin invalidar la evaluación', () => {
    const defense = { pregunta: '¿Qué ocurre si la lista está vacía?', opciones: ['Falla', 'Devuelve 0', 'Se queda esperando', 'Imprime None'], correcta: 1 };
    assert.deepEqual(validateEvaluation({ ...base, pregunta_defensa: defense }).pregunta_defensa, defense);
    for (const broken of [
        undefined, null, { pregunta: '', opciones: [], correcta: 0 },
        { ...defense, opciones: ['a', 'b'] }, { ...defense, correcta: 4 }, { ...defense, opciones: ['a', 'b', '', 'd'] },
        { ...defense, pregunta: 'corta' }
    ]) {
        assert.equal(validateEvaluation({ ...base, pregunta_defensa: broken }).pregunta_defensa, null);
    }
});

test('el esquema pide la pregunta de defensa y el prompt explica cuándo dejarla vacía', () => {
    assert.ok(EVALUATION_SCHEMA.required.includes('pregunta_defensa'));
    const prompt = buildPrompt({ exercise: { titulo: 'Sumar', enunciado: 'Suma dos números.' }, code: 'x = 1' });
    assert.match(prompt, /pregunta_defensa/);
    assert.match(prompt, /menor a 70/);
});

const calm = { pegados: 0, chars_pegados: 0, max_pegado: 0, cambios_foco: 0, segundos_fuera: 0, copias_enunciado: 0, segundos_abierto: 300, pulsaciones: 400 };

test('fallar la defensa suma una señal: sola no alarma, con otra señal pasa a ámbar', () => {
    const quiet = assessRisk({ senales: calm, codeLength: 200, defensaFallida: true });
    assert.equal(quiet.riesgo, 'verde');
    assert.deepEqual(quiet.motivos, ['DEFENSA_FALLIDA']);
    const withFocus = assessRisk({ senales: { ...calm, cambios_foco: 6 }, codeLength: 200, defensaFallida: true });
    assert.equal(withFocus.riesgo, 'ambar');
    assert.deepEqual(withFocus.motivos, ['SALIO_DE_LA_PESTANA', 'DEFENSA_FALLIDA']);
});
