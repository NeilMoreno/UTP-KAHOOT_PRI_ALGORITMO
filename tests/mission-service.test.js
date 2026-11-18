'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pickWeekly, toMission } = require('../backend/services/missionService');
const catalog = require('../backend/utils/avatarCatalog');

const CATALOG = ['a', 'b', 'c', 'd', 'e', 'f'].map((codigo) => ({ codigo }));

test('cada semana se eligen 3 misiones distintas', () => {
    const picked = pickWeekly(CATALOG, '2026-11-16');
    assert.equal(picked.length, 3);
    assert.equal(new Set(picked.map((m) => m.codigo)).size, 3);
});

test('la selección es estable dentro de la semana y rota a la siguiente', () => {
    const first = pickWeekly(CATALOG, '2026-11-16').map((m) => m.codigo);
    assert.deepEqual(pickWeekly(CATALOG, '2026-11-16').map((m) => m.codigo), first);
    assert.notDeepEqual(pickWeekly(CATALOG, '2026-11-23').map((m) => m.codigo), first);
});

test('con 3 misiones o menos se muestran todas', () => {
    assert.equal(pickWeekly(CATALOG.slice(0, 2), '2026-11-16').length, 2);
});

test('el progreso se limita a la meta y marca completada', () => {
    const mission = { codigo: 'x', nombre: 'X', descripcion: 'd', tipo_condicion: 'ejercicios_aprobados', meta: 2, recompensa_capa: 'gafas', recompensa_pieza: 'visor' };
    assert.equal(toMission(mission, { ejercicios_aprobados: 1 }).completada, false);
    const done = toMission(mission, { ejercicios_aprobados: 9 });
    assert.equal(done.progreso, 2);
    assert.equal(done.completada, true);
    assert.deepEqual(done.recompensa, { capa: 'gafas', id: 'visor' });
});

test('las recompensas sembradas en la migración existen en el catálogo de avatar', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../database/migrations/012_misiones_semanales.sql'), 'utf8');
    const rewards = [...sql.matchAll(/'(\w+)',\s*'(\w+)'\),?;?\s*$/gm)].map((m) => ({ capa: m[1], id: m[2] }));
    assert.ok(rewards.length >= 6);
    for (const { capa, id } of rewards) {
        assert.ok(catalog.LAYERS[capa] && id in catalog.LAYERS[capa], `${capa}:${id} no existe en el catálogo`);
    }
});

test('una pieza ganada con misión salta el requisito de nivel', () => {
    const avatar = { ...catalog.PRESETS.hacker, gafas: 'visor' };
    assert.equal(catalog.lockedParts(avatar, 1).length, 1);
    assert.equal(catalog.lockedParts(avatar, 1, [{ capa: 'gafas', id: 'visor' }]).length, 0);
    assert.equal(catalog.lockedParts({ ...avatar, accesorio: 'corona' }, 1, [{ capa: 'gafas', id: 'visor' }]).length, 1);
});
