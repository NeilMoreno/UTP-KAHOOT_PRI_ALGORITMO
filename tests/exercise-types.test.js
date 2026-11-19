'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    validateTypedExercise, publicMaterial, readAnswer, gradeLocal, normalizeAnswer
} = require('../backend/services/exerciseTypes');

const predict = validateTypedExercise({
    tipo: 'predecir',
    material: { codigo: 'x = 2\nprint(x * 3)' },
    solucion: { respuesta: '6', alternativas: ['seis'] }
});
const fill = validateTypedExercise({
    tipo: 'completar',
    material: { codigo: 'for i in ___(3):\n    ___(i)' },
    solucion: { huecos: [['range'], ['print', 'imprimir']] }
});
const order = validateTypedExercise({
    tipo: 'ordenar',
    material: {},
    solucion: { lineas: ['total = 0', 'for n in [1, 2]:', '    total = total + n', 'print(total)'] }
});
const fix = validateTypedExercise({
    tipo: 'corregir',
    material: { codigo: 'def suma(a, b):\n    return a - b' },
    solucion: { debe_contener: ['return a + b'], no_debe_contener: ['return a - b'] }
});

test('la validación rechaza material o soluciones incompletos', () => {
    const invalid = (input) => assert.throws(() => validateTypedExercise(input), { code: 'INVALID_EXERCISE_TYPE' });
    invalid({ tipo: 'inventado', material: {}, solucion: {} });
    invalid({ tipo: 'predecir', material: { codigo: 'x' }, solucion: null });
    invalid({ tipo: 'completar', material: { codigo: 'sin huecos' }, solucion: { huecos: [] } });
    invalid({ tipo: 'completar', material: { codigo: 'a ___ b ___' }, solucion: { huecos: [['x']] } }, 'faltan respuestas');
    invalid({ tipo: 'ordenar', material: {}, solucion: { lineas: ['a', 'b'] } });
    invalid({ tipo: 'ordenar', material: {}, solucion: { lineas: ['a', 'a', 'a'] } });
    invalid({ tipo: 'corregir', material: { codigo: 'x' }, solucion: { debe_contener: [], no_debe_contener: [] } });
    assert.deepEqual(validateTypedExercise({ tipo: 'escribir' }), { tipo: 'escribir', material: null, solucion: null });
});

test('el material público nunca incluye la solución', () => {
    for (const exercise of [predict, fill, order, fix]) {
        const shown = publicMaterial(exercise.tipo, exercise.material, exercise.solucion);
        const json = JSON.stringify(shown);
        assert.ok(!json.includes('"respuesta"') && !json.includes('alternativas') && !json.includes('debe_contener'));
    }
    assert.deepEqual(publicMaterial('completar', fill.material, fill.solucion), { codigo: fill.material.codigo, huecos: 2 });
    const lines = publicMaterial('ordenar', order.material, order.solucion).lineas;
    assert.deepEqual([...lines].sort(), [...order.solucion.lineas].sort(), 'mismas líneas, otro orden');
    assert.notDeepEqual(lines, order.solucion.lineas);
});

test('predecir: acepta alternativas y normaliza espacios, mayúsculas y comillas', () => {
    const grade = (answer) => gradeLocal({ tipo: 'predecir', solucion: predict.solucion, answer }).puntaje;
    assert.equal(grade('6'), 100);
    assert.equal(grade('  Seis '), 100);
    assert.equal(grade('"6"'), 100);
    assert.equal(grade('7'), 0);
    assert.equal(grade(''), 0);
    assert.equal(normalizeAnswer("  'Hola   Mundo' "), 'hola mundo');
});

test('completar: puntaje proporcional y aviso de qué huecos fallaron', () => {
    const grade = (answer) => gradeLocal({ tipo: 'completar', solucion: fill.solucion, answer: JSON.stringify(answer) });
    assert.equal(grade(['range', 'print']).puntaje, 100);
    assert.equal(grade(['RANGE', 'imprimir']).puntaje, 100);
    const half = grade(['range', 'len']);
    assert.equal(half.puntaje, 50);
    assert.match(half.retroalimentacion, /hueco 2/);
    assert.equal(grade(['', '']).puntaje, 0);
    assert.equal(gradeLocal({ tipo: 'completar', solucion: fill.solucion, answer: 'no es json' }).puntaje, 0);
});

test('ordenar: solo aprueba con el orden exacto', () => {
    const lines = order.solucion.lineas;
    const grade = (answer) => gradeLocal({ tipo: 'ordenar', solucion: order.solucion, answer: JSON.stringify(answer) });
    assert.equal(grade(lines).puntaje, 100);
    const almost = grade([lines[0], lines[1], lines[3], lines[2]]);
    assert.ok(almost.puntaje < 70, 'un orden casi correcto no aprueba');
    assert.equal(almost.aciertos, 2);
    assert.equal(grade([lines[0]]).puntaje <= 69, true);
});

test('corregir: exige lo que debe aparecer y lo que debe desaparecer', () => {
    const grade = (answer) => gradeLocal({ tipo: 'corregir', solucion: fix.solucion, answer, language: 'python' });
    assert.equal(grade('def suma(a, b):\n    return a + b').puntaje, 100);
    assert.equal(grade('def suma(a,b):\n  return   a+b').puntaje, 100, 'ignora espacios');
    assert.equal(grade('def suma(a, b):\n    return a - b').puntaje, 0);
    assert.equal(grade('def suma(a, b):\n    return a + b  # antes: return a - b').puntaje, 100, 'los comentarios no cuentan');
    assert.equal(grade('def suma(a, b):\n    return a - b  # return a + b').puntaje, 0, 'escribir la respuesta en un comentario no sirve');
    const partial = grade('def suma(a, b):\n    return b');
    assert.ok(partial.puntaje <= 69);
});

test('readAnswer valida la forma de la respuesta según el tipo', () => {
    assert.equal(readAnswer('predecir', { respuesta: ' 6 ' }), '6');
    assert.equal(readAnswer('completar', { respuesta: ['a', 'b'] }), '["a","b"]');
    assert.throws(() => readAnswer('predecir', {}), { code: 'ANSWER_REQUIRED' });
    assert.throws(() => readAnswer('completar', { respuesta: 'texto' }), { code: 'ANSWER_REQUIRED' });
    assert.throws(() => readAnswer('ordenar', { respuesta: new Array(40).fill('x') }), { code: 'ANSWER_REQUIRED' });
    assert.equal(readAnswer('ordenar', { respuesta: [1, 'x'] }), '["","x"]', 'los elementos que no son texto se anulan');
});

test('toda corrección devuelve una evaluación válida para guardar', () => {
    const sample = gradeLocal({ tipo: 'predecir', solucion: predict.solucion, answer: '6' });
    assert.ok(sample.retroalimentacion.length >= 10 && sample.retroalimentacion.length <= 4000);
    assert.ok(sample.eficiencia_algoritmica.length >= 1);
    assert.equal(sample.categoria_error, 'ninguno');
    assert.equal(gradeLocal({ tipo: 'predecir', solucion: predict.solucion, answer: '9' }).categoria_error, 'logica');
});
