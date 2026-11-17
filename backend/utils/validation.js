'use strict';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_PATTERN = /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERSON_NAME_PATTERN = /^[\p{L}][\p{L}\p{M} .'-]*[\p{L}\p{M}]$/u;
const GENEROS = Object.freeze(['femenino', 'masculino']);

const cleanString = (value, { min = 1, max = 255, lower = false, upper = false } = {}) => {
    if (typeof value !== 'string') return null;
    let clean = value.trim();
    if (clean.length < min || clean.length > max) return null;
    if (lower) clean = clean.toLowerCase();
    if (upper) clean = clean.toUpperCase();
    return clean;
};

const normalizeEmail = (value) => {
    const email = cleanString(value, { min: 3, max: 254, lower: true });
    return email && EMAIL_PATTERN.test(email) ? email : null;
};

const normalizeDomain = (value) => {
    const domain = cleanString(value, { min: 3, max: 254, lower: true });
    if (!domain) return null;
    const withoutAt = domain.startsWith('@') ? domain.slice(1) : domain;
    return DOMAIN_PATTERN.test(withoutAt) ? withoutAt : null;
};

const getEmailDomain = (email) => {
    const normalized = normalizeEmail(email);
    return normalized ? normalized.slice(normalized.lastIndexOf('@') + 1) : null;
};

const normalizePersonName = (value) => {
    const name = cleanString(value, { min: 2, max: 100 });
    return name && PERSON_NAME_PATTERN.test(name) ? name : null;
};

const isStrongPassword = (value) => (
    typeof value === 'string' &&
    value.length >= 12 &&
    value.length <= 128 &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value)
);

const normalizeGenero = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const genero = cleanString(value, { min: 1, max: 30, lower: true });
    return GENEROS.includes(genero) ? genero : null;
};

const buildGreeting = (nombre, genero) => {
    if (genero === 'femenino') return `Bienvenida a codeInt, ${nombre}.`;
    if (genero === 'masculino') return `Bienvenido a codeInt, ${nombre}.`;
    return `Te damos la bienvenida a codeInt, ${nombre}.`;
};

const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

module.exports = {
    GENEROS,
    cleanString,
    normalizePersonName,
    normalizeEmail,
    normalizeDomain,
    getEmailDomain,
    isStrongPassword,
    normalizeGenero,
    buildGreeting,
    isUuid
};
