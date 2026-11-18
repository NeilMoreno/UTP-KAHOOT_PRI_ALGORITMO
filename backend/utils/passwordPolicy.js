'use strict';

// ==============================================================
// codeInt - Política de contraseñas (fuente única del servidor)
//
// El frontend replica estas reglas en frontend/js/password-policy.js para
// mostrar el checklist al instante; tests/password-policy.test.js comprueba
// que ambas implementaciones den exactamente el mismo resultado.
// ==============================================================

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

// Contraseñas demasiado conocidas. Se comparan sin tildes y en minúsculas.
const COMMON_EXACT = Object.freeze([
    '12345678', '123456789', '1234567890', '0123456789', '11111111', '00000000',
    'qwertyuiop', 'abcdefghij', 'asdfghjkl', 'zxcvbnm123'
]);
// Raíces que, con números o símbolos al final, siguen siendo contraseñas comunes ("Password123!").
const COMMON_BASES = Object.freeze([
    'password', 'contrasena', 'qwerty', 'admin', 'administrador', 'welcome', 'bienvenido',
    'bienvenida', 'letmein', 'iloveyou', 'codeint', 'pseint', 'usuario', 'estudiante',
    'docente', 'colegio', 'universidad', 'utp', 'abcdef', 'asdfgh', 'zxcvbn', 'peru', 'lima'
]);

const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const isCommonPassword = (password) => {
    const plain = normalize(password);
    if (COMMON_EXACT.includes(plain)) return true;
    if (/^(.)\1+$/.test(plain)) return true; // un mismo carácter repetido
    const base = plain.replace(/[0-9!@#$%^&*._\-+=?]+$/g, '');
    return COMMON_BASES.includes(base);
};

// ¿La contraseña contiene datos personales del usuario (parte local del correo, nombre o apellido)?
const containsPersonalData = (password, context = {}) => {
    const plain = normalize(password);
    const tokens = [];
    const email = String(context.email || '');
    if (email.includes('@')) tokens.push(normalize(email.split('@')[0]));
    for (const value of [context.nombre, context.apellido]) {
        tokens.push(...normalize(value).split(/[\s.'-]+/));
    }
    return tokens.some((token) => token.length >= 4 && plain.includes(token));
};

const hasPersonalContext = (context = {}) => Boolean(context.email || context.nombre || context.apellido);

// Cada regla: id estable, texto para el usuario, `test(password, context)` y, si es contextual,
// `applies(context)`. El máximo de longitud solo se muestra cuando se incumple.
const RULES = Object.freeze([
    { id: 'length', text: `Al menos ${MIN_LENGTH} caracteres`, test: (p) => p.length >= MIN_LENGTH },
    { id: 'upper', text: 'Una letra mayúscula', test: (p) => /\p{Lu}/u.test(p) },
    { id: 'lower', text: 'Una letra minúscula', test: (p) => /\p{Ll}/u.test(p) },
    { id: 'digit', text: 'Un número', test: (p) => /\d/.test(p) },
    { id: 'common', text: 'No es una contraseña común', test: (p) => !isCommonPassword(p) },
    {
        id: 'personal',
        text: 'No incluye tu nombre ni tu correo',
        applies: hasPersonalContext,
        test: (p, context) => !containsPersonalData(p, context)
    },
    { id: 'max', text: `Máximo ${MAX_LENGTH} caracteres`, test: (p) => p.length <= MAX_LENGTH, onlyWhenFailing: true }
]);

// Resultado por regla. `applies` es false cuando falta el contexto necesario para evaluarla.
const evaluatePassword = (password, context = {}) => {
    const value = typeof password === 'string' ? password : '';
    return RULES.map((rule) => {
        const applies = rule.applies ? rule.applies(context) : true;
        const ok = applies ? rule.test(value, context) : true;
        const hidden = !applies || (rule.onlyWhenFailing && ok);
        return { id: rule.id, text: rule.text, ok, applies, hidden };
    });
};

const isValidPassword = (password, context = {}) => (
    typeof password === 'string' && evaluatePassword(password, context).every((rule) => rule.ok)
);

// Textos de los requisitos incumplidos (para devolverlos al cliente).
const passwordProblems = (password, context = {}) => (
    evaluatePassword(password, context).filter((rule) => !rule.ok).map((rule) => rule.text)
);

const LEVELS = Object.freeze(['', 'Débil', 'Aceptable', 'Buena', 'Fuerte']);

// 0 = vacía; 1 = no cumple lo mínimo; 2 = cumple lo mínimo; 3 = larga (≥14); 4 = larga y con símbolo.
const passwordStrength = (password, context = {}) => {
    const value = typeof password === 'string' ? password : '';
    if (value.length === 0) return { score: 0, label: LEVELS[0] };
    if (!isValidPassword(value, context)) return { score: 1, label: LEVELS[1] };
    let score = 2;
    if (value.length >= 14) score += 1;
    if (score === 3 && /[^\p{L}\d\s]/u.test(value)) score += 1;
    return { score, label: LEVELS[score] };
};

module.exports = {
    MIN_LENGTH, MAX_LENGTH, COMMON_EXACT, COMMON_BASES, RULES,
    evaluatePassword, isValidPassword, passwordProblems, passwordStrength
};
