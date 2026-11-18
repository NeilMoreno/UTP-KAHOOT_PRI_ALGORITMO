'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStreak, shiftDay } = require('../backend/services/streakService');

test('sin actividad la racha es 0', () => {
    const r = computeStreak([], '2026-11-17');
    assert.equal(r.racha_actual, 0);
    assert.equal(r.en_riesgo, false);
    assert.equal(r.ultimos_7.length, 7);
});

test('cuenta días consecutivos terminando hoy', () => {
    const r = computeStreak(['2026-11-17', '2026-11-16', '2026-11-15'], '2026-11-17');
    assert.equal(r.racha_actual, 3);
    assert.equal(r.activo_hoy, true);
    assert.equal(r.en_riesgo, false);
});

test('si hoy aún no hay actividad pero ayer sí, la racha sigue viva y en riesgo', () => {
    const r = computeStreak(['2026-11-16', '2026-11-15'], '2026-11-17');
    assert.equal(r.racha_actual, 2);
    assert.equal(r.activo_hoy, false);
    assert.equal(r.en_riesgo, true);
});

test('un día sin actividad antes de ayer rompe la racha pero conserva la mejor', () => {
    const r = computeStreak(['2026-11-14', '2026-11-13', '2026-11-12', '2026-11-10'], '2026-11-17');
    assert.equal(r.racha_actual, 0);
    assert.equal(r.mejor_racha, 3);
});

test('cruza límites de mes y año sin errores', () => {
    assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
    assert.equal(shiftDay('2027-01-01', -1), '2026-12-31');
    const r = computeStreak(['2027-01-02', '2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-02');
    assert.equal(r.racha_actual, 4);
});

test('ignora fechas duplicadas y marca la semana', () => {
    const r = computeStreak(['2026-11-17', '2026-11-17', '2026-11-15'], '2026-11-17');
    assert.equal(r.racha_actual, 1);
    assert.deepEqual(r.ultimos_7.filter((d) => d.activo).map((d) => d.fecha), ['2026-11-15', '2026-11-17']);
    assert.equal(r.ultimos_7[6].hoy, true);
});
