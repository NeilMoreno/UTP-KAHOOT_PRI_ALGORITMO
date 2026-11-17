// ==============================================================
// codeInt - Controlador de Autenticación y Registro (Auth & RBAC)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const { getEstudianteGamificationSummary } = require('../services/gamificationService');
const { generateToken } = require('../services/tokenService');
const { getRequestIp, recordSecurityEvent } = require('../services/securityAuditService');
const { registerByInvitation } = require('./identityController');
const {
    cleanString,
    normalizePersonName,
    normalizeEmail,
    isStrongPassword,
    normalizeGenero,
    buildGreeting,
    isUuid
} = require('../utils/validation');

const DUMMY_BCRYPT_HASH = '$2b$12$KIXxP9z4XG9jEIt8hWfO5.4W4P5sP9D2gXbXFlJ8WqP0YwXGQxH6K';

/**
 * El registro público sólo consume invitaciones creadas por el superadministrador.
 */
const register = registerByInvitation;

/**
 * Inicio de sesión de usuario
 * POST /api/auth/login
 */const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Debe ingresar email y contraseña.'
            });
        }

        const emailClean = normalizeEmail(email);
        if (!emailClean || typeof password !== 'string' || password.length === 0 || password.length > 128) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
        }

        // Buscar usuario en base de datos
        const userSql = `
            SELECT u.id_usuario, u.id_institucion, u.nombre, u.apellido, u.email,
                   u.password_hash, u.rol, u.genero, u.estado, u.correo_verificado, u.token_version,
                   i.nombre AS institucion_nombre
            FROM usuario u
            LEFT JOIN institucion i ON i.id_institucion = u.id_institucion
            WHERE lower(u.email) = $1
            LIMIT 1;
        `;
        const result = await query(userSql, [emailClean]);

        const user = result.rows[0] || null;
        const passwordMatch = await bcrypt.compare(
            password,
            user?.password_hash || DUMMY_BCRYPT_HASH
        );

        if (!user || !passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas.'
            });
        }

        if (user.estado !== 'activo') {
            return res.status(403).json({
                success: false,
                message: 'Su cuenta se encuentra en estado "' + user.estado + '". Comuníquese con la administración.'
            });
        }

        if (!user.correo_verificado) {
            return res.status(403).json({
                success: false,
                message: 'Debe verificar su correo antes de iniciar sesión.'
            });
        }
        const token = generateToken(user);
        await query('UPDATE usuario SET ultimo_acceso = now() WHERE id_usuario = $1;', [user.id_usuario]);

        // Si es estudiante, obtener también sus métricas de gamificación
        let gamification = null;
        if (user.rol === 'estudiante') {
            gamification = await getEstudianteGamificationSummary(user.id_usuario);
        }

        return res.json({
            success: true,
            message: buildGreeting(user.nombre, user.genero),
            token,
            user: {
                id_usuario: user.id_usuario,
                id_institucion: user.id_institucion,
                institucion_nombre: user.institucion_nombre,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                rol: user.rol,
                genero: user.genero,
                estado: user.estado,
                correo_verificado: user.correo_verificado,
                gamification
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Consulta de perfil del usuario en sesión
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
    try {
        const user = req.user;

        let gamification = null;
        if (user.rol === 'estudiante') {
            gamification = await getEstudianteGamificationSummary(user.id_usuario);
        }

        return res.json({
            success: true,
            user: {
                id_usuario: user.id_usuario,
                id_institucion: user.id_institucion,
                institucion_nombre: user.institucion_nombre,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                rol: user.rol,
                genero: user.genero,
                estado: user.estado,
                correo_verificado: user.correo_verificado,
                gamification
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateMe = async (req, res, next) => {
    try {
        const user = req.user;
        const nombre = req.body.nombre === undefined
            ? user.nombre
            : normalizePersonName(req.body.nombre);
        const apellido = req.body.apellido === undefined
            ? user.apellido
            : normalizePersonName(req.body.apellido);
        const genero = req.body.genero === undefined
            ? user.genero
            : normalizeGenero(req.body.genero);

        if (!nombre || !apellido || !genero) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, apellido o género no tienen un valor válido.'
            });
        }

        const result = await query(`
            UPDATE usuario
            SET nombre = $1, apellido = $2, genero = $3
            WHERE id_usuario = $4
            RETURNING id_usuario, id_institucion, nombre, apellido, email, rol, genero, estado;
        `, [nombre, apellido, genero, user.id_usuario]);

        return res.json({
            success: true,
            message: buildGreeting(result.rows[0].nombre, result.rows[0].genero),
            user: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listado de instituciones activas para selector
 * GET /api/auth/instituciones
 */
const getInstituciones = async (req, res, next) => {
    try {
        const sql = `
            SELECT id_institucion, nombre
            FROM institucion
            WHERE estado = 'activa'
            ORDER BY nombre ASC;
        `;
        const result = await query(sql);
        return res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

const getPendingTeachers = async (req, res, next) => {
    try {
        const result = await query(`
            SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.genero,
                   u.fecha_creacion, i.id_institucion, i.nombre AS institucion_nombre
            FROM usuario u
            JOIN institucion i ON i.id_institucion = u.id_institucion
            WHERE u.rol = 'docente' AND u.estado = 'pendiente'
            ORDER BY u.fecha_creacion ASC;
        `);
        return res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        next(error);
    }
};

const updateUserStatus = async (req, res, next) => {
    let client = null;
    let transactionStarted = false;
    try {
        const { id_usuario } = req.params;
        const estado = cleanString(req.body.estado, { min: 6, max: 10, lower: true });
        if (!isUuid(id_usuario) || !['activo', 'inactivo'].includes(estado)) {
            return res.status(400).json({
                success: false,
                message: 'Usuario o estado no válido.'
            });
        }

        client = await getClient();
        await client.query('BEGIN');
        transactionStarted = true;
        const result = await client.query(`
            UPDATE usuario
            SET estado = $1,
                token_version = CASE WHEN $1 = 'inactivo' THEN token_version + 1 ELSE token_version END
            WHERE id_usuario = $2 AND rol = 'docente'
            RETURNING id_usuario, id_institucion, nombre, apellido, email, rol, genero, estado;
        `, [estado, id_usuario]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(404).json({
                success: false,
                message: 'Docente no encontrado.'
            });
        }

        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId: result.rows[0].id_institucion,
            action: 'ESTADO_DOCENTE_ACTUALIZADO',
            targetType: 'usuario',
            targetId: id_usuario,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { estado }
        });
        await client.query('COMMIT');
        transactionStarted = false;

        return res.json({
            success: true,
            message: `Estado del docente actualizado a ${estado}.`,
            user: result.rows[0]
        });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        if (client) client.release();
    }
};

module.exports = {
    register,
    login,
    getMe,
    updateMe,
    getInstituciones,
    getPendingTeachers,
    updateUserStatus,
    generateToken
};
