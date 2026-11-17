'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BASE_WORLDS } = require('../backend/config/baseContent');

test('el catálogo base define los siete mundos en orden', () => {
    assert.equal(BASE_WORLDS.length, 7);
    assert.deepEqual(BASE_WORLDS.map((mundo) => mundo.orden), [1, 2, 3, 4, 5, 6, 7]);
    for (const mundo of BASE_WORLDS) {
        assert.ok(mundo.nombre.trim().length > 0);
        assert.ok(mundo.descripcion.trim().length > 0);
    }
});

test('cada mundo tiene ejercicios completos y en orden consecutivo', () => {
    for (const mundo of BASE_WORLDS) {
        assert.equal(mundo.ejercicios.length, 3, `Mundo ${mundo.orden} debe tener 3 ejercicios`);
        assert.deepEqual(
            mundo.ejercicios.map((ejercicio) => ejercicio.orden),
            [1, 2, 3],
            `Los ejercicios del mundo ${mundo.orden} deben estar ordenados`
        );

        for (const ejercicio of mundo.ejercicios) {
            assert.ok(ejercicio.titulo.trim().length > 0);
            assert.ok(ejercicio.enunciado.trim().length > 0);
            assert.match(ejercicio.plantilla_pseint, /^Algoritmo[\s\S]*FinAlgoritmo/);
            assert.ok(Number.isInteger(ejercicio.xp_recompensa));
            assert.ok(ejercicio.xp_recompensa > 0 && ejercicio.xp_recompensa <= 1000);
        }
    }
});

test('database/seeds.sql replica los títulos del catálogo base', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../database/seeds.sql'), 'utf8');
    for (const mundo of BASE_WORLDS) {
        for (const ejercicio of mundo.ejercicios) {
            assert.ok(
                sql.includes(`'${ejercicio.titulo}'`),
                `Falta en seeds.sql el ejercicio "${ejercicio.titulo}" del mundo ${mundo.orden}`
            );
        }
    }
});
