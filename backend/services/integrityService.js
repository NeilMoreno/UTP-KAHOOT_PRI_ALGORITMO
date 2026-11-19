'use strict';

// Integridad académica: señales de comportamiento (pegado, foco, tiempos), similitud entre estudiantes y
// semáforo de riesgo. Nada de esto bloquea al estudiante: es evidencia para que el docente decida.

const { query } = require('../config/database');
const { stripComments } = require('./promptGuard');

// ---- Señales enviadas por el navegador (no confiables: se acotan y se descartan claves desconocidas) ----
const SIGNAL_LIMITS = Object.freeze({
    pegados: 1000,            // veces que pegó texto
    chars_pegados: 200000,    // caracteres pegados en total
    max_pegado: 12000,        // pegado más grande
    cambios_foco: 1000,       // veces que salió de la pestaña/ventana
    segundos_fuera: 86400,    // tiempo total fuera de la pestaña
    copias_enunciado: 100,    // veces que copió el enunciado
    segundos_abierto: 86400,  // tiempo desde que abrió el ejercicio
    pulsaciones: 200000       // teclas pulsadas en el editor
});

const sanitizeSignals = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const clean = {};
    for (const [key, max] of Object.entries(SIGNAL_LIMITS)) {
        const value = Number(raw[key]);
        clean[key] = Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0;
    }
    return clean;
};

// ---- Similitud entre envíos --------------------------------------------------------------------------
const KEYWORDS = new Set(`algoritmo proceso finalgoritmo finproceso funcion finfuncion subproceso finsubproceso definir como leer escribir
    si entonces sino finsi segun hacer finsegun para hasta con paso finpara mientras finmientras repetir que
    def class return if elif else for while in range import from print input len int float str list dict set not and or is none true false
    function const let var new this switch case break continue default try catch throw async await null undefined
    public private protected static void final extends implements interface package string boolean double long char
    include using namespace main printf scanf cout cin endl struct typedef sizeof`.split(/\s+/).filter(Boolean));

const TOKEN = /[\p{L}_][\p{L}\p{N}_]*|\d+(?:\.\d+)?|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|[^\s\p{L}\p{N}_]/gu;
const SHINGLE = 4;

// Normaliza: sin comentarios, identificadores propios → 'v', números → 'n', cadenas → 's'. Así cambiar nombres
// de variables o comentarios no oculta una copia.
const tokenize = (code, language) => {
    const tokens = [];
    for (const raw of stripComments(code, language).toLowerCase().match(TOKEN) || []) {
        if (/^["']/.test(raw)) tokens.push('s');
        else if (/^\d/.test(raw)) tokens.push('n');
        else if (/^[\p{L}_]/u.test(raw)) tokens.push(KEYWORDS.has(raw) ? raw : 'v');
        else tokens.push(raw);
    }
    return tokens;
};

const shingles = (code, language) => {
    const tokens = tokenize(code, language);
    const set = new Set();
    for (let i = 0; i + SHINGLE <= tokens.length; i += 1) set.add(tokens.slice(i, i + SHINGLE).join(' '));
    return set;
};

const MIN_SHINGLES = 15; // por debajo de esto no hay suficiente código propio para comparar

// Jaccard entre los fragmentos propios (sin los de la plantilla que todos reciben).
const similarity = (shinglesA, shinglesB, templateShingles = new Set()) => {
    const a = [...shinglesA].filter((item) => !templateShingles.has(item));
    const bSet = new Set([...shinglesB].filter((item) => !templateShingles.has(item)));
    if (a.length < MIN_SHINGLES || bSet.size < MIN_SHINGLES) return 0;
    let shared = 0;
    for (const item of a) if (bSet.has(item)) shared += 1;
    return shared / (a.length + bSet.size - shared);
};

// Compara con el último envío de cada otro estudiante del mismo ejercicio.
const findMostSimilar = async ({ idEjercicio, idEstudiante, code, language, template }) => {
    const mine = shingles(code, language);
    const templateSet = template ? shingles(template, language) : new Set();
    const others = await query(
        `SELECT DISTINCT ON (id_estudiante) id_envio_ejercicio, codigo_pseint
           FROM envio_ejercicio
          WHERE id_ejercicio = $1 AND id_estudiante <> $2
          ORDER BY id_estudiante, fecha_envio DESC
          LIMIT 300;`,
        [idEjercicio, idEstudiante]
    );
    let best = { similitud: 0, id_envio_similar: null };
    for (const row of others.rows) {
        const value = similarity(mine, shingles(row.codigo_pseint, language), templateSet);
        if (value > best.similitud) best = { similitud: value, id_envio_similar: row.id_envio_ejercicio };
    }
    return { similitud: Math.round(best.similitud * 1000) / 1000, id_envio_similar: best.similitud > 0 ? best.id_envio_similar : null };
};

// ---- Semáforo -----------------------------------------------------------------------------------------
const THRESHOLDS = Object.freeze({
    pasteShare: 0.8,        // proporción del código que fue pegada
    bigPaste: 300,          // un solo pegado de este tamaño
    fastSeconds: 20,        // código largo enviado en menos de esto
    fastMinLength: 120,
    focusChanges: 5,
    awaySeconds: 120,
    similarityAmber: 0.85,
    similarityRed: 0.95
});

const assessRisk = ({ senales, codeLength, similitud = 0, manipulacion = false, defensaFallida = false }) => {
    const reasons = [];
    let points = 0;
    const add = (reason, weight) => { reasons.push(reason); points += weight; };

    if (senales) {
        const share = codeLength > 0 ? senales.chars_pegados / codeLength : 0;
        if (codeLength >= 80 && (share >= THRESHOLDS.pasteShare || senales.max_pegado >= THRESHOLDS.bigPaste)) add('PEGADO_GRANDE', 2);
        if (codeLength >= THRESHOLDS.fastMinLength && senales.segundos_abierto < THRESHOLDS.fastSeconds) add('ENVIO_MUY_RAPIDO', 1);
        if (senales.cambios_foco >= THRESHOLDS.focusChanges || senales.segundos_fuera >= THRESHOLDS.awaySeconds) add('SALIO_DE_LA_PESTANA', 1);
        if (senales.copias_enunciado >= 1) add('COPIO_EL_ENUNCIADO', 1);
    }
    if (similitud >= THRESHOLDS.similarityRed) add('SIMILITUD_MUY_ALTA', 3);
    else if (similitud >= THRESHOLDS.similarityAmber) add('SIMILITUD_ALTA', 2);
    if (manipulacion) add('INTENTO_DE_MANIPULACION', 3);
    // Fallar la pregunta sobre el propio código pesa poco por sí sola: suma a otras señales.
    if (defensaFallida) add('DEFENSA_FALLIDA', 1);

    const riesgo = points >= 3 ? 'rojo' : (points >= 2 ? 'ambar' : 'verde');
    return { riesgo, motivos: reasons };
};

module.exports = {
    SIGNAL_LIMITS, THRESHOLDS, MIN_SHINGLES,
    sanitizeSignals, tokenize, shingles, similarity, findMostSimilar, assessRisk
};
