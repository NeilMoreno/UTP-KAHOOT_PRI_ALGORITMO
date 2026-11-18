'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

test('toda condición de logro sembrada en migraciones se calcula en achievementService', () => {
    const service = read('backend/services/achievementService.js');
    const migrations = fs.readdirSync(path.resolve(__dirname, '../database/migrations')).map((f) => read(`database/migrations/${f}`)).join('\n');
    const seeds = read('database/seeds.sql');
    const used = new Set([...(migrations + seeds).matchAll(/'(?:insignia|logro)',\s*'(\w+)',\s*\d+/g)].map((m) => m[1]));
    assert.ok(used.size >= 7, 'se esperaban al menos 7 condiciones distintas');
    for (const condition of used) {
        assert.match(service, new RegExp(`WHEN '${condition}' THEN`), `falta ${condition} en CURRENT_VALUE_SQL`);
    }
});

test('el frontend agrupa todas las condiciones de logro', () => {
    const view = read('frontend/js/views/student/achievements.js');
    for (const condition of ['podios_sala', 'victorias_sala', 'respuestas_rapidas', 'partidas_participadas']) {
        assert.ok(view.includes(`'${condition}'`), `falta ${condition} en la vista de logros`);
    }
});
