// Edad y fecha de nacimiento del lado del cliente. Réplica de las reglas de backend/utils/age.js
// (tests/age.test.js comprueba que ambas coincidan). El servidor es quien decide.

export const MIN_REGISTRATION_AGE = 10;
export const MAX_REGISTRATION_AGE = 100;
export const ADULT_AGE = 18;
export const TERMS_VERSION = '2026-11';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseDateParts = (value) => {
    if (typeof value !== 'string') return null;
    const match = DATE_PATTERN.exec(value.trim());
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const probe = new Date(Date.UTC(year, month - 1, day));
    const real = probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
    return real ? { year, month, day } : null;
};

export const todayParts = (now = new Date()) => ({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });

export const calculateAge = (birthDate, today = todayParts()) => {
    const birth = parseDateParts(birthDate);
    if (!birth) return null;
    let age = today.year - birth.year;
    if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) age -= 1;
    return age;
};

const pad = (value, size = 2) => String(value).padStart(size, '0');

// Límites para <input type="date">: el más joven permitido y el más antiguo.
export const birthDateLimits = (today = todayParts()) => ({
    max: `${pad(today.year - MIN_REGISTRATION_AGE, 4)}-${pad(today.month)}-${pad(today.day)}`,
    min: `${pad(today.year - MAX_REGISTRATION_AGE, 4)}-${pad(today.month)}-${pad(today.day)}`
});

// Estado de la fecha escrita: { ok, age, minor, message }. `message` explica el problema en español.
export const checkBirthDate = (value, today = todayParts()) => {
    if (!value) return { ok: false, age: null, minor: false, message: '' };
    if (!parseDateParts(value)) return { ok: false, age: null, minor: false, message: 'La fecha no es válida.' };
    const age = calculateAge(value, today);
    if (age < 0) return { ok: false, age, minor: false, message: 'La fecha no puede ser futura.' };
    if (age < MIN_REGISTRATION_AGE) return { ok: false, age, minor: true, message: `La edad mínima para registrarse es de ${MIN_REGISTRATION_AGE} años.` };
    if (age > MAX_REGISTRATION_AGE) return { ok: false, age, minor: false, message: 'La fecha no es válida.' };
    return { ok: true, age, minor: age < ADULT_AGE, message: '' };
};
