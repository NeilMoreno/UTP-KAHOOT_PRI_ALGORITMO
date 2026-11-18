'use strict';

// ==============================================================
// codeInt - Fecha de nacimiento, edad y reglas de registro
//
// Las fechas viajan como texto 'YYYY-MM-DD' (sin hora ni zona) para evitar
// desfases de un día. frontend/js/age.js replica calculateAge/ageBucket;
// tests/age.test.js comprueba que ambos coincidan.
// ==============================================================

const MIN_REGISTRATION_AGE = Math.max(1, Number.parseInt(process.env.MIN_REGISTRATION_AGE || '10', 10) || 10);
const MAX_REGISTRATION_AGE = 100;
const ADULT_AGE = 18;
const TERMS_VERSION = '2026-11';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Devuelve { year, month, day } si el texto es una fecha real del calendario; si no, null.
const parseDateParts = (value) => {
    if (typeof value !== 'string') return null;
    const match = DATE_PATTERN.exec(value.trim());
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const probe = new Date(Date.UTC(year, month - 1, day));
    const real = probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
    return real ? { year, month, day } : null;
};

const todayParts = (now = new Date()) => ({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });

// Años cumplidos a la fecha `today` (por defecto, hoy).
const calculateAge = (birthDate, today = todayParts()) => {
    const birth = parseDateParts(birthDate);
    if (!birth) return null;
    let age = today.year - birth.year;
    if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) age -= 1;
    return age;
};

const BUCKETS = Object.freeze([
    { id: 'lt12', label: 'Menos de 12', min: 0, max: 11 },
    { id: '12_14', label: '12 a 14', min: 12, max: 14 },
    { id: '15_17', label: '15 a 17', min: 15, max: 17 },
    { id: '18_24', label: '18 a 24', min: 18, max: 24 },
    { id: '25_34', label: '25 a 34', min: 25, max: 34 },
    { id: '35_plus', label: '35 o más', min: 35, max: Infinity }
]);

const ageBucket = (age) => {
    if (!Number.isInteger(age) || age < 0) return 'sin_dato';
    return (BUCKETS.find((bucket) => age >= bucket.min && age <= bucket.max) || {}).id || 'sin_dato';
};

const failure = (status, code, message) => ({ ok: false, status, code, message });

// Valida solo la fecha de nacimiento (se usa al registrarse y al completarla después en "Mi cuenta").
const validateBirthDate = (value, today = todayParts()) => {
    const parts = parseDateParts(value);
    if (!parts) return failure(400, 'INVALID_BIRTH_DATE', 'La fecha de nacimiento no es válida.');
    const age = calculateAge(value, today);
    if (age < 0) return failure(400, 'INVALID_BIRTH_DATE', 'La fecha de nacimiento no puede ser futura.');
    if (age < MIN_REGISTRATION_AGE) {
        return failure(400, 'UNDER_MIN_AGE', `La edad mínima para registrarse es de ${MIN_REGISTRATION_AGE} años.`);
    }
    if (age > MAX_REGISTRATION_AGE) return failure(400, 'INVALID_BIRTH_DATE', 'La fecha de nacimiento no es válida.');
    return { ok: true, age, fecha: `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}` };
};

/**
 * Datos de perfil del registro. Reglas:
 *  - términos y privacidad: obligatorios para todos los roles;
 *  - fecha de nacimiento: obligatoria para estudiantes, opcional para docentes (si viene, se valida);
 *  - menores de 18 años: requieren la confirmación de apoderado o tutor.
 */
const validateRegistrationProfile = ({ rol, fecha_nacimiento, acepta_terminos, consentimiento_tutor }, today = todayParts()) => {
    if (acepta_terminos !== true) {
        return failure(400, 'TERMS_REQUIRED', 'Debes aceptar los términos y la política de privacidad.');
    }
    const hasDate = fecha_nacimiento !== undefined && fecha_nacimiento !== null && fecha_nacimiento !== '';
    if (!hasDate) {
        if (rol === 'estudiante') return failure(400, 'BIRTH_DATE_REQUIRED', 'La fecha de nacimiento es obligatoria.');
        return { ok: true, fecha: null, age: null, terminosVersion: TERMS_VERSION, tutor: false };
    }
    const birth = validateBirthDate(fecha_nacimiento, today);
    if (!birth.ok) return birth;
    const minor = birth.age < ADULT_AGE;
    if (minor && consentimiento_tutor !== true) {
        return failure(400, 'GUARDIAN_CONSENT_REQUIRED', 'Si eres menor de 18 años, tu apoderado o tutor debe autorizar el uso de la plataforma.');
    }
    return { ok: true, fecha: birth.fecha, age: birth.age, terminosVersion: TERMS_VERSION, tutor: minor };
};

module.exports = {
    MIN_REGISTRATION_AGE, MAX_REGISTRATION_AGE, ADULT_AGE, TERMS_VERSION, BUCKETS,
    parseDateParts, calculateAge, ageBucket, validateBirthDate, validateRegistrationProfile
};
