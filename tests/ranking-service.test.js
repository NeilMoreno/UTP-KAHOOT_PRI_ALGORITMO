'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getCourseRanking, publicName } = require('../backend/services/rankingService');

const makeRows = (count) => Array.from({ length: count }, (_, i) => ({
    id_usuario: `u${i + 1}`, nombre: `Alumno${i + 1}`, apellido: 'Perez Gomez',
    avatar_config: null, xp: (count - i) * 10, posicion: String(i + 1)
}));
const fakeDb = (rows) => ({ query: async () => ({ rows }) });

test('publicName muestra solo la inicial del apellido', () => {
    assert.equal(publicName({ nombre: 'Ana', apellido: 'Torres Díaz' }), 'Ana T.');
});

test('el estudiante ve el top 10 y su posición cuando queda fuera', async () => {
    const result = await getCourseRanking(fakeDb(makeRows(15)), 'curso', { id_usuario: 'u13', rol: 'estudiante' });
    assert.equal(result.total, 15);
    assert.equal(result.ranking.length, 10);
    assert.equal(result.yo.posicion, 13);
    assert.equal(result.yo.es_yo, true);
});

test('la respuesta no filtra apellidos completos, ids ni correos', async () => {
    const result = await getCourseRanking(fakeDb(makeRows(3)), 'curso', { id_usuario: 'u1', rol: 'estudiante' });
    const text = JSON.stringify(result);
    assert.doesNotMatch(text, /Perez Gomez|id_usuario|email|u2/);
    assert.ok(result.ranking.every((entry) => entry.avatar && entry.avatar.clase));
});

test('el docente recibe la lista completa y sin "yo"', async () => {
    const result = await getCourseRanking(fakeDb(makeRows(15)), 'curso', { id_usuario: 'doc', rol: 'docente' });
    assert.equal(result.ranking.length, 15);
    assert.equal(result.yo, null);
});
