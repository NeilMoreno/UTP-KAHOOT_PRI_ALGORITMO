// Política de contraseñas del lado del cliente: réplica exacta de backend/utils/passwordPolicy.js
// para mostrar el checklist al instante. El servidor es quien decide; tests/password-policy.test.js
// verifica que ambas implementaciones den siempre el mismo resultado.

export const MIN_LENGTH = 10;
export const MAX_LENGTH = 128;

export const COMMON_EXACT = [
    '12345678', '123456789', '1234567890', '0123456789', '11111111', '00000000',
    'qwertyuiop', 'abcdefghij', 'asdfghjkl', 'zxcvbnm123'
];
export const COMMON_BASES = [
    'password', 'contrasena', 'qwerty', 'admin', 'administrador', 'welcome', 'bienvenido',
    'bienvenida', 'letmein', 'iloveyou', 'codeint', 'pseint', 'usuario', 'estudiante',
    'docente', 'colegio', 'universidad', 'utp', 'abcdef', 'asdfgh', 'zxcvbn', 'peru', 'lima'
];

const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const isCommonPassword = (password) => {
    const plain = normalize(password);
    if (COMMON_EXACT.includes(plain)) return true;
    if (/^(.)\1+$/.test(plain)) return true;
    const base = plain.replace(/[0-9!@#$%^&*._\-+=?]+$/g, '');
    return COMMON_BASES.includes(base);
};

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

export const RULES = [
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
];

export const evaluatePassword = (password, context = {}) => {
    const value = typeof password === 'string' ? password : '';
    return RULES.map((rule) => {
        const applies = rule.applies ? rule.applies(context) : true;
        const ok = applies ? rule.test(value, context) : true;
        const hidden = !applies || (rule.onlyWhenFailing && ok);
        return { id: rule.id, text: rule.text, ok, applies, hidden };
    });
};

export const isValidPassword = (password, context = {}) => (
    typeof password === 'string' && evaluatePassword(password, context).every((rule) => rule.ok)
);

export const passwordProblems = (password, context = {}) => (
    evaluatePassword(password, context).filter((rule) => !rule.ok).map((rule) => rule.text)
);

const LEVELS = ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];

export const passwordStrength = (password, context = {}) => {
    const value = typeof password === 'string' ? password : '';
    if (value.length === 0) return { score: 0, label: LEVELS[0] };
    if (!isValidPassword(value, context)) return { score: 1, label: LEVELS[1] };
    let score = 2;
    if (value.length >= 14) score += 1;
    if (score === 3 && /[^\p{L}\d\s]/u.test(value)) score += 1;
    return { score, label: LEVELS[score] };
};
