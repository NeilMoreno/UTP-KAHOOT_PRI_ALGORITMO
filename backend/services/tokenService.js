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

module.exports = { getJwtConfig, generateToken };
