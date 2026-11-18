'use strict';

// Código de curso automático a partir del nombre: iniciales de las palabras significativas
// ("Estructuras de Datos II" -> EDD2). Es solo una sugerencia: el docente puede editarlo.
const STOP_WORDS = new Set([
    'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para', 'por', 'con', 'a', 'al', 'un', 'una', 'o', 'u', 'su', 'sus'
]);
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
const CODE_PATTERN = /^[A-Z0-9-]{2,20}$/;
const MAX_INITIALS = 5;

const stripAccents = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '');

const baseCode = (nombre) => {
    const words = stripAccents(String(nombre || ''))
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    // Un número final (arábigo o romano) identifica el nivel y se conserva tal cual.
    let level = '';
    const last = words[words.length - 1];
    if (words.length > 1 && last && (ROMAN[last] || /^\d{1,2}$/.test(last))) {
        level = String(ROMAN[last] || last);
        words.pop();
    }

    const significant = words.filter((word) => !STOP_WORDS.has(word));
    const pool = significant.length > 0 ? significant : words;
    if (pool.length === 0) return '';

    const letters = pool.length === 1
        ? pool[0].slice(0, 4)
        : pool.slice(0, MAX_INITIALS).map((word) => word[0]).join('');
    return `${letters}${level}`.toUpperCase();
};

// `existingCodes`: códigos ya usados en la misma institución y periodo. Si hay choque se añade -2, -3...
const generateCourseCode = (nombre, existingCodes = []) => {
    const base = baseCode(nombre);
    if (base.length < 2) return null;
    const taken = new Set(existingCodes.map((code) => String(code).toUpperCase()));
    if (!taken.has(base)) return base;
    for (let n = 2; n < 100; n += 1) {
        const candidate = `${base}-${n}`;
        if (!taken.has(candidate)) return candidate;
    }
    return null;
};

const isValidCourseCode = (code) => CODE_PATTERN.test(String(code || ''));

module.exports = { generateCourseCode, isValidCourseCode, baseCode };
