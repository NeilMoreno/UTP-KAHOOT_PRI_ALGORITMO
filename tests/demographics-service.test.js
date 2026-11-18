'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDemographics } = require('../backend/services/demographicsService');

const row = (rango, genero, total) => ({ rango, genero, total });
const byId = (result) => Object.fromEntries(result.rangos.map((range) => [range.id, range]));

test('con grupos grandes entrega conteos exactos, por género y el total', () => {
    const result = buildDemographics([row('18_24', 'femenino', 12), row('18_24', 'masculino', 8), row('12_14', 'femenino', 6), row('12_14', 'masculino', 5)]);
    const ranges = byId(result);
    assert.equal(ranges['18_24'].total, 20);
    assert.deepEqual(ranges['18_24'].por_genero, { femenino: 12, masculino: 8 });
    assert.equal(ranges['12_14'].total, 11);
    assert.equal(result.total, 31);
});

test('un rango con 1 a 4 personas se oculta y el total general ya no se entrega', () => {
    const result = buildDemographics([row('18_24', 'femenino', 30), row('lt12', 'masculino', 3)]);
    const ranges = byId(result);
    assert.equal(ranges.lt12.oculto, true);
    assert.equal(ranges.lt12.total, null);
    assert.equal(ranges.lt12.por_genero, null);
    assert.equal(result.total, null, 'sin total no se puede deducir el grupo oculto por resta');
});

test('si un género queda por debajo de 5 no se entrega el desglose del rango', () => {
    const result = buildDemographics([row('18_24', 'femenino', 20), row('18_24', 'masculino', 2)]);
    const range = byId(result)['18_24'];
    assert.equal(range.total, 22);
    assert.equal(range.por_genero, null, 'entregar 20 permitiría deducir 22 - 20 = 2');
});

test('un rango vacío muestra 0 y no cuenta como oculto', () => {
    const result = buildDemographics([row('18_24', 'femenino', 10), row('18_24', 'masculino', 10)]);
    const empty = byId(result)['35_plus'];
    assert.equal(empty.total, 0);
    assert.equal(empty.oculto, false);
    assert.equal(result.total, 20);
});

test('"sin fecha registrada" sigue las mismas reglas y el orden de los rangos es estable', () => {
    const result = buildDemographics([row('sin_dato', 'femenino', 4), row('18_24', 'femenino', 9), row('18_24', 'masculino', 9)]);
    assert.equal(byId(result).sin_dato.oculto, true);
    assert.deepEqual(result.rangos.map((range) => range.id), ['lt12', '12_14', '15_17', '18_24', '25_34', '35_plus', 'sin_dato']);
});

test('sin datos devuelve todo en cero y un total de 0', () => {
    const result = buildDemographics([]);
    assert.equal(result.total, 0);
    assert.ok(result.rangos.every((range) => range.total === 0 && range.oculto === false));
});

test('la respuesta nunca incluye identificadores ni datos personales', () => {
    const text = JSON.stringify(buildDemographics([row('18_24', 'femenino', 10), row('18_24', 'masculino', 10)]));
    assert.doesNotMatch(text, /id_usuario|email|nombre|apellido|fecha_nacimiento/);
});
