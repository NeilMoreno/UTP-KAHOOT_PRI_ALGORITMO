'use strict';

const jwt = require('jsonwebtoken');

const getJwtConfig = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32 || secret.includes('tu_clave_secreta')) {
        throw new Error('JWT_SECRET debe configurarse con al menos 32 caracteres seguros.');
    }
    return {
        secret,
        expiresIn: process.env.JWT_EXPIRES_IN || '30m',
        issuer: process.env.JWT_ISSUER || 'codeint-api',
        audience: process.env.JWT_AUDIENCE || 'codeint-web'
    };
};

const generateToken = (user) => {
    const payload = {
        id_usuario: user.id_usuario,
        token_version: user.token_version,
        email: user.email,
        rol: user.rol,
        id_institucion: user.id_institucion
    };
    const { secret, expiresIn, issuer, audience } = getJwtConfig();
    return jwt.sign(payload, secret, { expiresIn, issuer, audience, algorithm: 'HS256' });
};

// ---- Token de refresco -------------------------------------------------------------------------------
// Vive en una cookie HttpOnly (el JavaScript de la página no puede leerla), SameSite=Strict y limitada a
// /api/auth. Solo sirve para pedir un token de acceso nuevo; se invalida con token_version (cambio de
// contraseña, "cerrar todas las sesiones", cuenta desactivada).
const REFRESH_COOKIE = 'codeint_refresh';
const REFRESH_PATH = '/api/auth';
const refreshDays = () => {
    const parsed = Number.parseInt(process.env.REFRESH_TOKEN_DAYS, 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 30 ? parsed : 7;
};

const generateRefreshToken = (user) => {
    const { secret, issuer } = getJwtConfig();
    return jwt.sign(
        { id_usuario: user.id_usuario, token_version: user.token_version, typ: 'refresh' },
        secret,
        { expiresIn: `${refreshDays()}d`, issuer, audience: 'codeint-refresh', algorithm: 'HS256' }
    );
};

const verifyRefreshToken = (token) => {
    const { secret, issuer } = getJwtConfig();
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience: 'codeint-refresh' });
    if (decoded.typ !== 'refresh') throw new Error('Tipo de token no válido.');
    return decoded;
};

const cookieAttributes = (maxAgeSeconds) => [
    `Path=${REFRESH_PATH}`, 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`,
    process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true' ? 'Secure' : null
].filter(Boolean).join('; ');

const setRefreshCookie = (res, user) => {
    res.append('Set-Cookie', `${REFRESH_COOKIE}=${generateRefreshToken(user)}; ${cookieAttributes(refreshDays() * 86400)}`);
};

const clearRefreshCookie = (res) => {
    res.append('Set-Cookie', `${REFRESH_COOKIE}=; ${cookieAttributes(0)}`);
};

const readRefreshCookie = (req) => {
    const header = req.headers.cookie || '';
    for (const part of header.split(';')) {
        const index = part.indexOf('=');
        if (index > 0 && part.slice(0, index).trim() === REFRESH_COOKIE) return part.slice(index + 1).trim();
    }
    return null;
};

module.exports = {
    getJwtConfig, generateToken, generateRefreshToken, verifyRefreshToken,
    setRefreshCookie, clearRefreshCookie, readRefreshCookie, REFRESH_COOKIE
};
