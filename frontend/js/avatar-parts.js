// Avatar pixel art por capas. Lienzo de 16x16; cada pieza es una matriz de caracteres
// (una letra = un color de la paleta, "." = transparente) que se convierte en <rect> SVG.
// Los ids y niveles deben coincidir con backend/utils/avatarCatalog.js (lo verifica tests/avatar-catalog.test.js).

const SIZE = 16;
const row = (y, text) => [y, text];

// ---------- Colores ----------
const SKINS = { claro: '#F7D3B5', medio: '#E8B58D', bronceado: '#C98B63', moreno: '#9A6240', oscuro: '#6B4026', alien: '#7BE0A0', robot: '#9FB3C8', dorada: '#F4C542' };
const HAIRS = { negro: '#2E2A4A', castano: '#6B4428', rubio: '#E8C65B', rojo: '#C2452D', azul: '#3F6DF2', rosa: '#FF6FB5', neon: '#3DF2A0', blanco: '#EDEDF5' };
const CLOTHES = { negro: '#2B2842', violeta: '#7B5CFF', verde: '#1FA67A', azul: '#3F6DF2', rojo: '#D94452', naranja: '#F28C38', rosa: '#E85CA8', blanco: '#E8E8F4', oro: '#E8B93A' };

const shade = (hex, amount) => {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
    const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

// Colores fijos de los accesorios.
const FIXED = {
    K: '#14102B', W: '#FFFFFF', w: '#C9CFE6', m: '#B5524A', G: '#6FD3FF', T: '#3DF2A0', t: '#148A5E',
    B: '#4C7DFF', O: '#FF9A3D', R: '#FF5C6C', Y: '#FFC83D', P: '#A99BFF', L: '#C9CFE6', D: '#3B3A55', N: '#FF6FB5'
};

// ---------- Piezas ----------
const rows = (...pairs) => Object.fromEntries(pairs);
const repeat = (from, to, text) => Array.from({ length: to - from + 1 }, (_, i) => [from + i, text]);

const HEAD = rows(
    ...repeat(3, 5, '....SSSSSSSS....'), ...repeat(6, 7, '...SSSSSSSSSS...'), row(8, '....SSSSSSSS....'),
    row(9, '.....SSSSSS.....'), row(10, '......ssss......')
);
const FACE = rows(row(6, '.....K....K.....'), row(8, '.......mm.......'));

const ROPA = {
    camiseta: { nombre: 'Camiseta', nivel: 1, rows: rows(row(10, '...CCC....CCC...'), ...repeat(11, 15, '..CCCCCCCCCCCC..')) },
    hoodie: {
        nombre: 'Hoodie', nivel: 1,
        rows: rows(row(9, '...cc......cc...'), row(10, '...ccC....Ccc...'), row(11, '..CCCCWCCWCCCC..'), row(12, '..CCCCWCCWCCCC..'),
            row(13, '..CCCCCCCCCCCC..'), row(14, '..CccccccccccC..'), row(15, '..CCCCCCCCCCCC..'))
    },
    chaqueta: {
        nombre: 'Chaqueta', nivel: 2,
        rows: rows(row(10, '...CCC....CCC...'), row(11, '..CCCcWWWWcCCC..'), row(12, '..CCCCcWWcCCCC..'), ...repeat(13, 15, '..CCCCCCCCCCCC..'))
    },
    bata: {
        nombre: 'Bata de laboratorio', nivel: 3,
        rows: rows(row(10, '...WWW....WWW...'), row(11, '..WWWwCCCCwWWW..'), ...repeat(12, 15, '..WWWwCCCCwWWW..'))
    },
    armadura: {
        nombre: 'Armadura cyber', nivel: 5,
        rows: rows(row(10, '...AAA....AAA...'), row(11, '..AAAAAAAAAAAA..'), row(12, '..AAaaAAAAaaAA..'), row(13, '..AAAAAWWAAAAA..'),
            row(14, '..AAAAAAAAAAAA..'), row(15, '..aaaaaaaaaaaa..'))
    }
};

const SHORT = [row(2, '....HHHHHHHH....'), row(3, '...HHhhHHHHHH...'), row(4, '...HHHHHHHHHH...'), row(5, '....H......H....')];
const PEINADO = {
    corto: { nombre: 'Corto', nivel: 1, rows: rows(...SHORT) },
    largo: { nombre: 'Largo', nivel: 1, rows: rows(...SHORT, ...repeat(6, 9, '...HH......HH...')) },
    rapado: { nombre: 'Rapado', nivel: 1, rows: rows(row(3, '....HHHHHHHH....'), row(4, '....H......H....')) },
    afro: {
        nombre: 'Afro', nivel: 2,
        rows: rows(row(1, '....HHHHHHHH....'), row(2, '...HHHHHHHHHH...'), row(3, '..HHHHhHHhHHHH..'), row(4, '..HHHHHHHHHHHH..'),
            row(5, '..HHH......HHH..'), row(6, '..HH........HH..'))
    },
    mono: { nombre: 'Moño', nivel: 2, rows: rows(row(0, '......HHHH......'), row(1, '.....HHHHHH.....'), ...SHORT) },
    gorro: {
        nombre: 'Gorro', nivel: 2,
        rows: rows(row(1, '.......CC.......'), row(2, '....CCCCCCCC....'), row(3, '...CCCCCCCCCC...'), row(4, '...cccccccccc...'), row(5, '....H......H....'))
    },
    mohawk: {
        nombre: 'Cresta', nivel: 3,
        rows: rows(row(0, '.......HH.......'), ...repeat(1, 3, '......HHHH......'), row(4, '......hHHh......'))
    }
};

const GAFAS = {
    ninguna: { nombre: 'Sin gafas', nivel: 1, rows: {} },
    redondas: { nombre: 'Redondas', nivel: 1, rows: rows(row(5, '....KKK..KKK....'), row(6, '....KGKKKKGK....'), row(7, '....KKK..KKK....')) },
    antifaz: { nombre: 'Antifaz', nivel: 1, rows: rows(row(5, '...KKKKKKKKKK...'), row(6, '...KKWKKKKWKK...'), row(7, '....KKKKKKKK....')) },
    deal: { nombre: 'Deal with it', nivel: 2, rows: rows(row(5, '....KKKKKKKK....'), row(6, '....KKWKKKWK....'), row(7, '.....KK..KK.....')) },
    visor: { nombre: 'Visor cyber', nivel: 3, rows: rows(row(5, '...KKKKKKKKKK...'), row(6, '...KTTTTTTTTK...'), row(7, '...KKKKKKKKKK...')) }
};

const ACCESORIO = {
    ninguno: { nombre: 'Ninguno', nivel: 1, rows: {} },
    laptop: {
        nombre: 'Laptop', nivel: 1,
        rows: rows(row(12, '...DDDDDDDDDD...'), row(13, '...DDDDTTDDDD...'), row(14, '...DDDDDDDDDD...'), row(15, '..LLLLLLLLLLLL..'))
    },
    auriculares: {
        nombre: 'Auriculares', nivel: 1,
        rows: rows(row(1, '....KKKKKKKK....'), row(2, '...K........K...'), row(3, '...K........K...'), row(4, '...K........K...'),
            row(5, '...KK......KK...'), row(6, '...PP......PP...'), row(7, '...PP......PP...'), row(8, '...KK......KK...'))
    },
    headset: {
        nombre: 'Headset', nivel: 1,
        rows: rows(row(3, '...D........D...'), row(4, '...D........D...'), row(5, '...DD......DD...'), row(6, '...DD......DD...'),
            row(7, '...DD......DD...'), row(8, '...DDDR.........'))
    },
    servidor: {
        nombre: 'Servidor', nivel: 1,
        rows: rows(row(11, '..........DDDDD.'), row(12, '..........DTDRD.'), row(13, '..........DDDDD.'), row(14, '..........DTDYD.'), row(15, '..........DDDDD.'))
    },
    monitor: {
        nombre: 'Monitor </>', nivel: 1,
        rows: rows(row(11, '...DDDDDDDDDD...'), row(12, '...DBBBBBBBBD...'), row(13, '...DBWBBBBWBD...'), row(14, '...DDDDDDDDDD...'), row(15, '.......DD.......'))
    },
    grafico: {
        nombre: 'Gráfico', nivel: 1,
        rows: rows(row(11, '.............T..'), row(12, '.............T..'), row(13, '...........B.T..'), row(14, '.........B.B.T..'), row(15, '.........B.B.T..'))
    },
    candado: {
        nombre: 'Candado', nivel: 1,
        rows: rows(row(11, '..........KKK...'), row(12, '..........K.K...'), row(13, '.........YYYYY..'), row(14, '.........YYKYY..'), row(15, '.........YYYYY..'))
    },
    cafe: {
        nombre: 'Café', nivel: 2,
        rows: rows(row(11, '...........L....'), row(12, '..........WWWW..'), row(13, '..........WWWWW.'), row(14, '..........WWWW..'))
    },
    orejas: { nombre: 'Orejas de gato', nivel: 4, rows: rows(row(1, '....N......N....'), row(2, '....NN....NN....')) },
    corona: { nombre: 'Corona', nivel: 6, rows: rows(row(1, '....Y..YY..Y....'), row(2, '....YYYYYYYY....')) }
};

// Fondos: color base + filas opcionales con letras definidas en `colors`.
const bands = (list) => Object.fromEntries(list.flatMap(([from, to, letter]) => repeat(from, to, letter.repeat(SIZE))));
const matrixRows = () => {
    const out = {};
    [[1, 6], [4, 10], [7, 4], [10, 8], [13, 12]].forEach(([x, length]) => {
        for (let y = 0; y <= length; y += 1) {
            const prev = out[y] || '.'.repeat(SIZE);
            out[y] = prev.slice(0, x) + (y === length ? 'T' : 't') + prev.slice(x + 1);
        }
    });
    return out;
};
const FONDO = {
    violeta: { nombre: 'Violeta', nivel: 1, base: '#4B3AA8', colors: { f: '#3A2E86' }, rows: bands([[14, 15, 'f']]) },
    menta: { nombre: 'Menta', nivel: 1, base: '#1F8F7A', colors: { f: '#176F5F' }, rows: bands([[14, 15, 'f']]) },
    naranja: { nombre: 'Naranja', nivel: 1, base: '#D9692F', colors: { f: '#B4532A' }, rows: bands([[14, 15, 'f']]) },
    terminal: {
        nombre: 'Terminal', nivel: 1, base: '#0B1A14', colors: { t: '#166B49' },
        rows: rows(row(0, 'tt.ttt..t.tt..t.'), row(2, '.t..tt.ttt..t.tt'), row(4, 't..t.........t.t'), row(6, '.tt..........tt.'), row(8, 't.t..........t.t'))
    },
    atardecer: {
        nombre: 'Atardecer', nivel: 3, base: '#FF7A59', colors: { a: '#FF5C8A', b: '#9B5CFF', c: '#5B3FE0' },
        rows: bands([[4, 7, 'a'], [8, 11, 'b'], [12, 15, 'c']])
    },
    galaxia: {
        nombre: 'Galaxia', nivel: 4, base: '#140B3D', colors: { W: '#FFFFFF', P: '#A99BFF' },
        rows: rows(row(1, '..W.....P....W..'), row(3, '.P........W.....'), row(5, 'W.......P......W'), row(8, '.....W.......P..'))
    },
    matrix: { nombre: 'Matrix', nivel: 5, base: '#031008', colors: { t: '#0F6B3A', T: '#7CFFB2' }, rows: matrixRows() }
};

// ---------- Capas y catálogo para el editor ----------
const swatchItems = (colors, names, levels) => Object.entries(colors).map(([id, color]) => ({ id, nombre: names[id], nivel: levels[id], color }));

export const PIEL = swatchItems(SKINS,
    { claro: 'Claro', medio: 'Medio', bronceado: 'Bronceado', moreno: 'Moreno', oscuro: 'Oscuro', alien: 'Alien', robot: 'Robot', dorada: 'Dorada' },
    { claro: 1, medio: 1, bronceado: 1, moreno: 1, oscuro: 1, alien: 3, robot: 4, dorada: 6 });
export const PELO = swatchItems(HAIRS,
    { negro: 'Negro', castano: 'Castaño', rubio: 'Rubio', rojo: 'Rojo', azul: 'Azul', rosa: 'Rosa', neon: 'Neón', blanco: 'Blanco' },
    { negro: 1, castano: 1, rubio: 1, rojo: 1, azul: 2, rosa: 2, neon: 3, blanco: 4 });
export const ROPA_COLOR = swatchItems(CLOTHES,
    { negro: 'Negro', violeta: 'Violeta', verde: 'Verde', azul: 'Azul', rojo: 'Rojo', naranja: 'Naranja', rosa: 'Rosa', blanco: 'Blanco', oro: 'Oro' },
    { negro: 1, violeta: 1, verde: 1, azul: 1, rojo: 1, naranja: 1, rosa: 2, blanco: 2, oro: 6 });

const fromPieces = (pieces) => Object.entries(pieces).map(([id, piece]) => ({ id, nombre: piece.nombre, nivel: piece.nivel }));

export const CLASES = [
    { id: 'hacker', nombre: 'Hacker', descripcion: 'Rompe sistemas (con permiso) y vive en la terminal.' },
    { id: 'vibecoder', nombre: 'Vibecoder', descripcion: 'Programa con IA, buena música y mejor ambiente.' },
    { id: 'devops', nombre: 'DevOps', descripcion: 'Automatiza despliegues y mantiene todo en pie.' },
    { id: 'backend', nombre: 'Backend Dev', descripcion: 'Servidores, APIs y bases de datos.' },
    { id: 'frontend', nombre: 'Frontend Dev', descripcion: 'Interfaces que se ven (y se sienten) bien.' },
    { id: 'data', nombre: 'Data Scientist', descripcion: 'Convierte datos en decisiones.' },
    { id: 'pentester', nombre: 'Pentester', descripcion: 'Busca vulnerabilidades antes que los malos.' }
].map((item) => ({ ...item, nivel: 1 }));

export const PRESETS = {
    hacker: { clase: 'hacker', piel: 'medio', peinado: 'corto', pelo: 'negro', ropa: 'hoodie', ropaColor: 'negro', gafas: 'ninguna', accesorio: 'laptop', fondo: 'terminal' },
    vibecoder: { clase: 'vibecoder', piel: 'claro', peinado: 'largo', pelo: 'castano', ropa: 'camiseta', ropaColor: 'violeta', gafas: 'redondas', accesorio: 'auriculares', fondo: 'violeta' },
    devops: { clase: 'devops', piel: 'bronceado', peinado: 'corto', pelo: 'castano', ropa: 'hoodie', ropaColor: 'azul', gafas: 'ninguna', accesorio: 'headset', fondo: 'naranja' },
    backend: { clase: 'backend', piel: 'moreno', peinado: 'rapado', pelo: 'negro', ropa: 'camiseta', ropaColor: 'verde', gafas: 'ninguna', accesorio: 'servidor', fondo: 'menta' },
    frontend: { clase: 'frontend', piel: 'claro', peinado: 'corto', pelo: 'rojo', ropa: 'camiseta', ropaColor: 'naranja', gafas: 'redondas', accesorio: 'monitor', fondo: 'violeta' },
    data: { clase: 'data', piel: 'oscuro', peinado: 'largo', pelo: 'negro', ropa: 'camiseta', ropaColor: 'azul', gafas: 'redondas', accesorio: 'grafico', fondo: 'menta' },
    pentester: { clase: 'pentester', piel: 'medio', peinado: 'corto', pelo: 'negro', ropa: 'hoodie', ropaColor: 'negro', gafas: 'antifaz', accesorio: 'candado', fondo: 'terminal' }
};

// Capas editables, en el orden en que aparecen las pestañas. `swatch` = muestra de color; el resto usa miniatura del avatar.
export const LAYERS = [
    { key: 'clase', label: 'Clase', items: CLASES },
    { key: 'piel', label: 'Piel', swatch: true, items: PIEL },
    { key: 'peinado', label: 'Peinado', items: fromPieces(PEINADO) },
    { key: 'pelo', label: 'Pelo', swatch: true, items: PELO },
    { key: 'ropa', label: 'Ropa', items: fromPieces(ROPA) },
    { key: 'ropaColor', label: 'Color de ropa', swatch: true, items: ROPA_COLOR },
    { key: 'gafas', label: 'Gafas', items: fromPieces(GAFAS) },
    { key: 'accesorio', label: 'Accesorio', items: fromPieces(ACCESORIO) },
    { key: 'fondo', label: 'Fondo', items: fromPieces(FONDO) }
];

export const AVATAR_KEYS = LAYERS.map((layer) => layer.key);

const itemOf = (key, id) => LAYERS.find((layer) => layer.key === key)?.items.find((item) => item.id === id) || null;
export const partLevel = (key, id) => itemOf(key, id)?.nivel ?? Infinity;
export const isUnlocked = (key, id, level) => partLevel(key, id) <= level;
export const className = (id) => CLASES.find((item) => item.id === id)?.nombre || 'Hacker';

// Devuelve siempre un avatar válido: cualquier dato desconocido o ausente cae al preset de la clase.
export function normalizeAvatar(value) {
    const base = PRESETS[value?.clase] || PRESETS.hacker;
    const clean = { ...base };
    for (const key of AVATAR_KEYS) {
        if (itemOf(key, value?.[key])) clean[key] = value[key];
    }
    return clean;
}

export const presetFor = (clase) => ({ ...(PRESETS[clase] || PRESETS.hacker) });

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Avatar aleatorio que solo usa piezas desbloqueadas por el nivel dado.
export function randomAvatar(level = 1) {
    const avatar = presetFor(pick(CLASES).id);
    for (const layer of LAYERS) {
        if (layer.key === 'clase') continue;
        avatar[layer.key] = pick(layer.items.filter((item) => item.nivel <= level)).id;
    }
    return avatar;
}

// ---------- Render ----------
const PIECES = { ropa: ROPA, peinado: PEINADO, gafas: GAFAS, accesorio: ACCESORIO };

const rectsFor = (grid, palette) => {
    const rects = [];
    for (const [y, text] of Object.entries(grid)) {
        let x = 0;
        while (x < text.length) {
            const letter = text[x];
            if (letter === '.' || !palette[letter]) { x += 1; continue; }
            let end = x + 1;
            while (end < text.length && text[end] === letter) end += 1;
            rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${palette[letter]}"/>`);
            x = end;
        }
    }
    return rects.join('');
};

const cache = new Map();

// Todo el contenido sale de catálogos cerrados: ningún texto del usuario llega al SVG.
export function renderAvatarSvg(value) {
    const avatar = normalizeAvatar(value);
    const key = AVATAR_KEYS.map((name) => avatar[name]).join('|');
    if (cache.has(key)) return cache.get(key);

    const skin = SKINS[avatar.piel];
    const hair = HAIRS[avatar.pelo];
    const cloth = CLOTHES[avatar.ropaColor];
    const palette = {
        ...FIXED,
        S: skin, s: shade(skin, -0.18), H: hair, h: shade(hair, 0.28),
        C: cloth, c: shade(cloth, -0.28), A: cloth, a: shade(cloth, -0.3)
    };
    const fondo = FONDO[avatar.fondo];
    const background = `<rect width="${SIZE}" height="${SIZE}" fill="${fondo.base}"/>${rectsFor(fondo.rows, { ...palette, ...fondo.colors })}`;
    const layers = [
        ROPA[avatar.ropa].rows, HEAD, FACE, GAFAS[avatar.gafas].rows, PEINADO[avatar.peinado].rows, ACCESORIO[avatar.accesorio].rows
    ];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges" focusable="false" aria-hidden="true">`
        + background + layers.map((grid) => rectsFor(grid, palette)).join('') + '</svg>';
    cache.set(key, svg);
    return svg;
}

// Para pruebas: valida que todas las filas de todas las piezas midan 16 caracteres.
export function auditPieces() {
    const problems = [];
    const check = (name, grid) => Object.entries(grid).forEach(([y, text]) => {
        if (text.length !== SIZE) problems.push(`${name} fila ${y}: ${text.length} caracteres`);
        if (Number(y) < 0 || Number(y) >= SIZE) problems.push(`${name} fila ${y} fuera de rango`);
    });
    check('cabeza', HEAD); check('cara', FACE);
    Object.entries(PIECES).forEach(([layer, pieces]) => Object.entries(pieces).forEach(([id, piece]) => check(`${layer}.${id}`, piece.rows)));
    Object.entries(FONDO).forEach(([id, piece]) => check(`fondo.${id}`, piece.rows));
    return problems;
}
