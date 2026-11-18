'use strict';

// Catálogo cerrado del avatar pixel: id de pieza -> nivel mínimo para usarla.
// Debe coincidir con frontend/js/avatar-parts.js (lo comprueba tests/avatar-catalog.test.js).
const LAYERS = Object.freeze({
    clase: { hacker: 1, vibecoder: 1, devops: 1, backend: 1, frontend: 1, data: 1, pentester: 1 },
    piel: { claro: 1, medio: 1, bronceado: 1, moreno: 1, oscuro: 1, alien: 3, robot: 4, dorada: 6 },
    peinado: { corto: 1, largo: 1, rapado: 1, afro: 2, mono: 2, gorro: 2, mohawk: 3 },
    pelo: { negro: 1, castano: 1, rubio: 1, rojo: 1, azul: 2, rosa: 2, neon: 3, blanco: 4 },
    ropa: { camiseta: 1, hoodie: 1, chaqueta: 2, bata: 3, armadura: 5 },
    ropaColor: { negro: 1, violeta: 1, verde: 1, azul: 1, rojo: 1, naranja: 1, rosa: 2, blanco: 2, oro: 6 },
    gafas: { ninguna: 1, redondas: 1, antifaz: 1, deal: 2, visor: 3 },
    accesorio: {
        ninguno: 1, laptop: 1, auriculares: 1, headset: 1, servidor: 1, monitor: 1,
        grafico: 1, candado: 1, cafe: 2, orejas: 4, corona: 6
    },
    fondo: { violeta: 1, menta: 1, naranja: 1, terminal: 1, atardecer: 3, galaxia: 4, matrix: 5 }
});

const KEYS = Object.freeze(Object.keys(LAYERS));

const PRESETS = Object.freeze({
    hacker: { clase: 'hacker', piel: 'medio', peinado: 'corto', pelo: 'negro', ropa: 'hoodie', ropaColor: 'negro', gafas: 'ninguna', accesorio: 'laptop', fondo: 'terminal' },
    vibecoder: { clase: 'vibecoder', piel: 'claro', peinado: 'largo', pelo: 'castano', ropa: 'camiseta', ropaColor: 'violeta', gafas: 'redondas', accesorio: 'auriculares', fondo: 'violeta' },
    devops: { clase: 'devops', piel: 'bronceado', peinado: 'corto', pelo: 'castano', ropa: 'hoodie', ropaColor: 'azul', gafas: 'ninguna', accesorio: 'headset', fondo: 'naranja' },
    backend: { clase: 'backend', piel: 'moreno', peinado: 'rapado', pelo: 'negro', ropa: 'camiseta', ropaColor: 'verde', gafas: 'ninguna', accesorio: 'servidor', fondo: 'menta' },
    frontend: { clase: 'frontend', piel: 'claro', peinado: 'corto', pelo: 'rojo', ropa: 'camiseta', ropaColor: 'naranja', gafas: 'redondas', accesorio: 'monitor', fondo: 'violeta' },
    data: { clase: 'data', piel: 'oscuro', peinado: 'largo', pelo: 'negro', ropa: 'camiseta', ropaColor: 'azul', gafas: 'redondas', accesorio: 'grafico', fondo: 'menta' },
    pentester: { clase: 'pentester', piel: 'medio', peinado: 'corto', pelo: 'negro', ropa: 'hoodie', ropaColor: 'negro', gafas: 'antifaz', accesorio: 'candado', fondo: 'terminal' }
});

const CLASES = Object.keys(LAYERS.clase);

// Devuelve el avatar saneado o null si falta una clave, sobra otra o hay un id fuera del catálogo.
const normalizeAvatar = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const keys = Object.keys(value);
    if (keys.length !== KEYS.length || !KEYS.every((key) => keys.includes(key))) return null;
    const clean = {};
    for (const key of KEYS) {
        const id = value[key];
        if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(LAYERS[key], id)) return null;
        clean[key] = id;
    }
    return clean;
};

// Lista de piezas que exigen más nivel del que tiene el usuario.
// `unlocked` son piezas ya ganadas por otra vía (misiones), como [{ capa, id }]: esas no exigen nivel.
const lockedParts = (avatar, level, unlocked = []) => KEYS
    .filter((key) => LAYERS[key][avatar[key]] > level)
    .filter((key) => !unlocked.some((piece) => piece.capa === key && piece.id === avatar[key]))
    .map((key) => ({ capa: key, id: avatar[key], nivel: LAYERS[key][avatar[key]] }));

// Preset determinista según el id del usuario, para quien aún no ha personalizado nada.
const defaultAvatarFor = (userId) => {
    let hash = 0;
    for (const char of String(userId || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return { ...PRESETS[CLASES[hash % CLASES.length]] };
};

const resolveAvatar = (config, userId) => normalizeAvatar(config) || defaultAvatarFor(userId);

module.exports = { LAYERS, KEYS, PRESETS, CLASES, normalizeAvatar, lockedParts, defaultAvatarFor, resolveAvatar };
