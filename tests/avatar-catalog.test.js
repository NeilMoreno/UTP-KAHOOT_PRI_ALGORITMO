'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const catalog = require('../backend/utils/avatarCatalog');

const loadParts = () => import(pathToFileURL(path.resolve(__dirname, '../frontend/js/avatar-parts.js')).href);

test('el catálogo del frontend coincide con el del backend (ids y niveles)', async () => {
    const parts = await loadParts();
    assert.deepEqual(parts.AVATAR_KEYS, catalog.KEYS);
    for (const layer of parts.LAYERS) {
        const expected = catalog.LAYERS[layer.key];
        assert.deepEqual(Object.fromEntries(layer.items.map((item) => [item.id, item.nivel])), expected, `capa ${layer.key}`);
    }
});

test('los presets coinciden y solo usan piezas de nivel 1', async () => {
    const parts = await loadParts();
    assert.deepEqual(parts.PRESETS, catalog.PRESETS);
    for (const preset of Object.values(catalog.PRESETS)) {
        assert.ok(catalog.normalizeAvatar(preset));
        assert.equal(catalog.lockedParts(preset, 1).length, 0);
    }
});

test('todas las matrices de píxeles miden 16 caracteres', async () => {
    const parts = await loadParts();
    assert.deepEqual(parts.auditPieces(), []);
});

test('normalizeAvatar rechaza claves extra, ids desconocidos y no-objetos', () => {
    const valid = { ...catalog.PRESETS.hacker };
    assert.ok(catalog.normalizeAvatar(valid));
    assert.equal(catalog.normalizeAvatar({ ...valid, extra: 'x' }), null);
    assert.equal(catalog.normalizeAvatar({ ...valid, piel: '<script>' }), null);
    assert.equal(catalog.normalizeAvatar({ ...valid, __proto__: { piel: 'claro' }, piel: 'toString' }), null);
    assert.equal(catalog.normalizeAvatar(null), null);
    assert.equal(catalog.normalizeAvatar([]), null);
});

test('lockedParts detecta piezas por encima del nivel', () => {
    const avatar = { ...catalog.PRESETS.hacker, accesorio: 'corona', pelo: 'blanco' };
    const locked = catalog.lockedParts(avatar, 3).map((item) => item.capa).sort();
    assert.deepEqual(locked, ['accesorio', 'pelo']);
    assert.equal(catalog.lockedParts(avatar, 6).length, 0);
});

test('el render del avatar solo emite rects con colores del catálogo', async () => {
    const parts = await loadParts();
    const svg = parts.renderAvatarSvg({ ...catalog.PRESETS.hacker, clase: '<img>' });
    assert.match(svg, /^<svg /);
    assert.doesNotMatch(svg, /<img|<script|onload/i);
    assert.match(svg, /fill="#[0-9a-f]{6}"/i);
});
