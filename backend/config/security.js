'use strict';

const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const defaultDevelopmentOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
];

const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set(
    configuredOrigins.length > 0
        ? configuredOrigins
        : (process.env.NODE_ENV === 'production' ? [] : defaultDevelopmentOrigins)
);

const corsOptions = {
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        const error = new Error('Origen no permitido por la política CORS.');
        error.status = 403;
        return callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'X-Request-Id'],
    credentials: false,
    maxAge: 600
};

// Las peticiones del propio sitio (p. ej. los módulos ES del frontend o fetch al API) también
// llevan cabecera Origin; no son cross-origin y nunca deben rechazarse por la lista CORS.
const corsOptionsDelegate = (req, callback) => {
    const origin = req.get('Origin');
    if (origin && origin === `${req.protocol}://${req.get('host')}`) {
        return callback(null, { ...corsOptions, origin: true });
    }
    return callback(null, corsOptions);
};

const limiter = (windowMs, limit, message) => rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message }
});

const apiLimiter = limiter(15 * 60 * 1000, 300, 'Demasiadas solicitudes. Intente nuevamente más tarde.');
const authLimiter = limiter(15 * 60 * 1000, 10, 'Demasiados intentos de autenticación. Intente nuevamente en 15 minutos.');
const uploadLimiter = limiter(60 * 60 * 1000, 20, 'Se alcanzó el límite de cargas. Intente nuevamente más tarde.');
const aiEvaluationLimiter = limiter(60 * 60 * 1000, 30, 'Se alcanzó el límite de evaluaciones por IA. Intente nuevamente más tarde.');
const aiGenerationLimiter = limiter(60 * 60 * 1000, 10, 'Se alcanzó el límite de generaciones por IA. Intente nuevamente más tarde.');

const helmetHeaders = helmet({
    crossOriginEmbedderPolicy: { policy: 'credentialless' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' }
});

const securityHeaders = (req, res, next) => {
    res.setHeader(
        'Permissions-Policy',
        'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
    );
    helmetHeaders(req, res, next);
};

module.exports = {
    corsOptions,
    corsOptionsDelegate,
    securityHeaders,
    apiLimiter,
    authLimiter,
    uploadLimiter,
    aiEvaluationLimiter,
    aiGenerationLimiter
};
