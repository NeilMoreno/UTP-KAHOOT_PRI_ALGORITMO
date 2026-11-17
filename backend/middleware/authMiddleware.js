// ==============================================================
// codeInt - Middleware de Autenticación JWT
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { httpError } = require('../utils/httpError');

/**
 * Verifica un JWT y devuelve el usuario vigente en PostgreSQL.
 * Lo comparten el middleware REST y la autenticación de Socket.io para que
 * ambos apliquen las mismas reglas (firma, emisor, audiencia, revocación y estado).
 * Lanza httpError con el estado HTTP que corresponda.
 */
const loadUserFromToken = async (token) => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET no está configurado de forma segura.');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, secret, {
            algorithms: ['HS256'],
            issuer: process.env.JWT_ISSUER || 'codeint-api',
            audience: process.env.JWT_AUDIENCE || 'codeint-web'
        });
    } catch (jwtErr) {
        if (jwtErr.name === 'TokenExpiredError') {
            throw httpError(401, 'El token ha expirado. Por favor, inicia sesión nuevamente.', 'TOKEN_EXPIRED');
        }
        throw httpError(401, 'Token de autenticación inválido.', 'INVALID_TOKEN');
    }

    // Validar que el usuario exista y esté activo en PostgreSQL
    const sql = `
        SELECT u.id_usuario, u.id_institucion, u.nombre, u.apellido, u.email, u.rol, u.genero, u.estado,
               u.correo_verificado, u.token_version,
               i.nombre AS institucion_nombre
        FROM usuario u
        LEFT JOIN institucion i ON i.id_institucion = u.id_institucion
        WHERE u.id_usuario = $1
        LIMIT 1;
    `;
    const result = await query(sql, [decoded.id_usuario]);

    if (result.rowCount === 0) {
        throw httpError(401, 'El usuario asociado a este token ya no existe.', 'USER_NOT_FOUND');
    }

    const user = result.rows[0];

    if (!Number.isInteger(decoded.token_version)
        || decoded.token_version !== user.token_version) {
        throw httpError(401, 'La sesión fue revocada. Inicie sesión nuevamente.', 'SESSION_REVOKED');
    }

    if (!user.correo_verificado) {
        throw httpError(403, 'Debe verificar su correo antes de continuar.', 'EMAIL_NOT_VERIFIED');
    }
    if (user.estado !== 'activo') {
        throw httpError(
            403,
            `La cuenta de usuario se encuentra en estado "${user.estado}". Contacte al administrador.`,
            'ACCOUNT_NOT_ACTIVE'
        );
    }

    return user;
};

/**
 * Middleware para validar el JWT en cabeceras Authorization: Bearer <token>
 */
const authenticateJWT = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Acceso no autorizado: No se proporcionó el token de autenticación (Bearer token requerido).'
            });
        }

        // Inyectar usuario verificado en la petición
        req.user = await loadUserFromToken(authHeader.slice(7).trim());
        next();
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        console.error('❌ [Auth Middleware Error]:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno en el servicio de autenticación.'
        });
    }
};

module.exports = {
    authenticateJWT,
    loadUserFromToken
};
