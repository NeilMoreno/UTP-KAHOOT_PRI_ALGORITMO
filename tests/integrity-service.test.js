'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeSignals, shingles, similarity, assessRisk, SIGNAL_LIMITS } = require('../backend/services/integrityService');

test('las señales se acotan y se descartan las claves desconocidas', () => {
    assert.equal(sanitizeSignals(null), null);
    assert.equal(sanitizeSignals([1, 2]), null);
    const clean = sanitizeSignals({ pegados: 3, chars_pegados: -50, max_pegado: 1e12, cambios_foco: 'x', hack: '<script>', segundos_abierto: 12.6 });
    assert.equal(clean.pegados, 3);
    assert.equal(clean.chars_pegados, 0);
    assert.equal(clean.max_pegado, SIGNAL_LIMITS.max_pegado);
    assert.equal(clean.cambios_foco, 0);
    assert.equal(clean.segundos_abierto, 13);
    assert.equal('hack' in clean, false);
    assert.deepEqual(Object.keys(clean).sort(), Object.keys(SIGNAL_LIMITS).sort());
});

const calm = { pegados: 0, chars_pegados: 0, max_pegado: 0, cambios_foco: 0, segundos_fuera: 0, copias_enunciado: 0, segundos_abierto: 300, pulsaciones: 400 };

test('un envío tranquilo es verde y las señales aisladas leves no alarman', () => {
    assert.deepEqual(assessRisk({ senales: calm, codeLength: 200 }), { riesgo: 'verde', motivos: [] });
    assert.equal(assessRisk({ senales: { ...calm, copias_enunciado: 1 }, codeLength: 200 }).riesgo, 'verde');
    assert.equal(assessRisk({ senales: { ...calm, cambios_foco: 6 }, codeLength: 200 }).riesgo, 'verde');
    assert.equal(assessRisk({ senales: null, codeLength: 200 }).riesgo, 'verde', 'sin señales no se acusa');
});

test('pegar casi todo el código es ámbar y combinado con otras señales es rojo', () => {
    const pasted = { ...calm, pegados: 1, chars_pegados: 190, max_pegado: 190 };
    const amber = assessRisk({ senales: pasted, codeLength: 200 });
    assert.equal(amber.riesgo, 'ambar');
    assert.deepEqual(amber.motivos, ['PEGADO_GRANDE']);
    const red = assessRisk({ senales: { ...pasted, cambios_foco: 8, copias_enunciado: 1 }, codeLength: 200 });
    assert.equal(red.riesgo, 'rojo');
    assert.deepEqual(red.motivos, ['PEGADO_GRANDE', 'SALIO_DE_LA_PESTANA', 'COPIO_EL_ENUNCIADO']);
});

test('código largo en pocos segundos suma, pero por sí solo no es ámbar', () => {
    assert.equal(assessRisk({ senales: { ...calm, segundos_abierto: 5 }, codeLength: 400 }).riesgo, 'verde');
    assert.equal(assessRisk({ senales: { ...calm, segundos_abierto: 5, cambios_foco: 6 }, codeLength: 400 }).riesgo, 'ambar');
});

test('la similitud alta y la manipulación elevan el riesgo', () => {
    assert.equal(assessRisk({ senales: calm, codeLength: 200, similitud: 0.9 }).riesgo, 'ambar');
    assert.equal(assessRisk({ senales: calm, codeLength: 200, similitud: 0.97 }).riesgo, 'rojo');
    const manipulation = assessRisk({ senales: calm, codeLength: 200, manipulacion: true });
    assert.equal(manipulation.riesgo, 'rojo');
    assert.deepEqual(manipulation.motivos, ['INTENTO_DE_MANIPULACION']);
});

const original = `def promedio(notas):
    total = 0
    for nota in notas:
        total = total + nota
    return total / len(notas)

datos = [14, 15, 18, 20]
print(promedio(datos))
`;

test('renombrar variables y cambiar comentarios no oculta una copia', () => {
    const disguised = `# mi solución
def calcular(valores):
    suma = 0
    for v in valores:
        suma = suma + v   # acumulo
    return suma / len(valores)

lista = [1, 2, 3, 4]
print(calcular(lista))
`;
    assert.ok(similarity(shingles(original, 'python'), shingles(disguised, 'python')) >= 0.85);
});

test('soluciones distintas no se parecen y la plantilla común no cuenta', () => {
    const different = `import statistics
def promedio(notas):
    return statistics.mean(notas)
while True:
    try:
        n = int(input())
        print(promedio([n, n + 1]))
    except ValueError:
        break
`;
    assert.ok(similarity(shingles(original, 'python'), shingles(different, 'python')) < 0.4);

    // Dos códigos que solo comparten la plantilla del ejercicio no se consideran copia.
    const template = 'def main():\n    # Tu código aquí\n    pass\n\n\nif __name__ == "__main__":\n    main()\n';
    const a = `${template}\n`;
    const b = `${template}\n`;
    assert.equal(similarity(shingles(a, 'python'), shingles(b, 'python'), shingles(template, 'python')), 0);
});

test('el código muy corto no genera similitud (no hay suficiente material propio)', () => {
    assert.equal(similarity(shingles('print(1)', 'python'), shingles('print(1)', 'python')), 0);
});
