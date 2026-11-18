// ==============================================================
// codeInt - Controlador de Autenticación y Registro (Auth & RBAC)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const { getEstudianteGamificationSummary } = require('../services/gamificationService');
const { generateToken } = require('../services/tokenService');
const { normalizeAvatar, lockedParts, resolveAvatar } = require('../utils/avatarCatalog');
const { getMissionUnlocks } = require('../services/missionService');
const { validateBirthDate, calculateAge, ADULT_AGE, TERMS_VERSION } = require('../utils/age');
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

const avatarOf = (user) => resolveAvatar(user.avatar_config, user.id_usuario);

// Datos de perfil propios: la fecha solo se entrega a su dueño; el resto de la app trabaja con la edad.
const profileOf = (user) => ({
    fecha_nacimiento: user.fecha_nacimiento || null,
    edad: user.fecha_nacimiento ? calculateAge(user.fecha_nacimiento) : null,
    terminos_aceptados_en: user.terminos_aceptados_en || null,
    terminos_version: user.terminos_version || null,
    terminos_vigentes: user.terminos_version === TERMS_VERSION
});

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
                   u.avatar_config,
                   to_char(u.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
                   u.terminos_aceptados_en, u.terminos_version,
                   i.nombre AS institucion_nombre, i.estado AS institucion_estado
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

        if (user.id_institucion && user.institucion_estado !== 'activa') {
            return res.status(403).json({
                success: false,
                message: 'La institución asociada a su cuenta está inactiva. Comuníquese con la administración.'
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
                avatar: avatarOf(user),
                ...profileOf(user),
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
                avatar: avatarOf(user),
                ...profileOf(user),
                gamification
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateAvatar = async (req, res, next) => {
    try {
        const avatar = normalizeAvatar(req.body);
        if (!avatar) {
            return res.status(400).json({ success: false, message: 'El avatar no tiene un valor válido.' });
        }
        // El nivel se lee del servidor: el cliente nunca decide qué piezas tiene desbloqueadas.
        let level = 1;
        if (req.user.rol === 'estudiante') {
            const summary = await getEstudianteGamificationSummary(req.user.id_usuario);
            level = Number(summary?.nivel_actual) || 1;
        }
        const unlocked = req.user.rol === 'estudiante' ? await getMissionUnlocks({ query }, req.user.id_usuario) : [];
        const locked = lockedParts(avatar, level, unlocked);
        if (locked.length > 0) {
            return res.status(403).json({
                success: false,
                message: `Aún no desbloqueas: ${locked.map((item) => `${item.id} (nivel ${item.nivel})`).join(', ')}.`,
                bloqueadas: locked
            });
        }
        await query(
            'UPDATE usuario SET avatar_config = $1::jsonb WHERE id_usuario = $2;',
            [JSON.stringify(avatar), req.user.id_usuario]
        );
        return res.json({ success: true, avatar });
    } catch (error) {
        next(error);
    }
};

/**
 * Completa la fecha de nacimiento (solo si aún no existe; después solo la administración puede cambiarla).
 * PATCH /api/auth/me/nacimiento
 */
const completeBirthDate = async (req, res, next) => {
    try {
        if (req.user.fecha_nacimiento) {
            return res.status(409).json({ success: false, error: 'BIRTH_DATE_ALREADY_SET', message: 'Tu fecha de nacimiento ya está registrada. Para cambiarla, contacta a la administración.' });
        }
        const birth = validateBirthDate(req.body?.fecha_nacimiento);
        if (!birth.ok) return res.status(birth.status).json({ success: false, error: birth.code, message: birth.message });
        const minor = birth.age < ADULT_AGE;
        if (minor && req.body?.consentimiento_tutor !== true) {
            return res.status(400).json({ success: false, error: 'GUARDIAN_CONSENT_REQUIRED', message: 'Si eres menor de 18 años, tu apoderado o tutor debe autorizar el uso de la plataforma.' });
        }
        // La condición "IS NULL" evita pisar una fecha registrada en paralelo.
        const updated = await query(
            `UPDATE usuario
                SET fecha_nacimiento = $1::date,
                    consentimiento_tutor_en = CASE WHEN $3::boolean THEN now() ELSE consentimiento_tutor_en END
              WHERE id_usuario = $2 AND fecha_nacimiento IS NULL
              RETURNING to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento;`,
            [birth.fecha, req.user.id_usuario, minor]
        );
        if (updated.rowCount === 0) {
            return res.status(409).json({ success: false, error: 'BIRTH_DATE_ALREADY_SET', message: 'Tu fecha de nacimiento ya está registrada.' });
        }
        return res.json({ success: true, message: 'Fecha de nacimiento guardada.', ...profileOf({ ...req.user, fecha_nacimiento: updated.rows[0].fecha_nacimiento }) });
    } catch (error) {
        return next(error);
    }
};

/**
 * Acepta los términos vigentes (para cuentas creadas antes de que existieran).
 * POST /api/auth/me/terminos
 */
const acceptTerms = async (req, res, next) => {
    try {
        if (req.body?.acepta_terminos !== true) {
            return res.status(400).json({ success: false, error: 'TERMS_REQUIRED', message: 'Debes aceptar los términos y la política de privacidad.' });
        }
        const updated = await query(
            `UPDATE usuario SET terminos_aceptados_en = now(), terminos_version = $1
              WHERE id_usuario = $2 RETURNING terminos_aceptados_en, terminos_version;`,
            [TERMS_VERSION, req.user.id_usuario]
        );
        return res.json({ success: true, message: 'Términos aceptados.', ...profileOf({ ...req.user, ...updated.rows[0] }) });
    } catch (error) {
        return next(error);
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

/**
 * Listado administrativo de usuarios con filtros
 * GET /api/auth/usuarios?rol=&estado=&id_institucion=&q=
 */
const getUsuarios = async (req, res, next) => {
    try {
        const role = req.query?.rol === undefined ? null : cleanString(req.query.rol, { min: 6, max: 25, lower: true });
        const status = req.query?.estado === undefined ? null : cleanString(req.query.estado, { min: 6, max: 10, lower: true });
        const institution = req.query?.id_institucion || null;
        const term = req.query?.q === undefined ? null : cleanString(req.query.q, { min: 1, max: 100 });

        if (role !== null && !['estudiante', 'docente', 'superadministrador'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Rol de usuario no válido.' });
        }
        if (status !== null && !['pendiente', 'activo', 'inactivo'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado de usuario no válido.' });
        }
        if (institution !== null && !isUuid(institution)) {
            return res.status(400).json({ success: false, message: 'Institución no válida.' });
        }

        const result = await query(`
            SELECT u.id_usuario, u.id_institucion, i.nombre AS institucion_nombre,
                   u.nombre, u.apellido, u.email, u.rol, u.estado, u.genero,
                   u.correo_verificado, u.fecha_creacion,
                   (SELECT count(*)::integer FROM curso c WHERE c.id_docente = u.id_usuario) AS total_cursos,
                   (SELECT count(*)::integer FROM matricula m
                     WHERE m.id_estudiante = u.id_usuario AND m.estado = 'activa') AS total_matriculas
              FROM usuario u
              LEFT JOIN institucion i ON i.id_institucion = u.id_institucion
             WHERE ($1::text IS NULL OR u.rol = $1)
               AND ($2::text IS NULL OR u.estado = $2)
               AND ($3::uuid IS NULL OR u.id_institucion = $3)
               AND ($4::text IS NULL OR u.email ILIKE $4
                    OR concat_ws(' ', u.nombre, u.apellido) ILIKE $4)
             ORDER BY u.fecha_creacion DESC
             LIMIT 500;
        `, [role, status, institution, term === null ? null : `%${term}%`]);

        return res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        return next(error);
    }
};

/**
 * Listado administrativo de instituciones con dominios y métricas
 * GET /api/auth/admin/instituciones
 */
const getAdminInstituciones = async (req, res, next) => {
    try {
        const result = await query(`
            SELECT i.id_institucion, i.nombre, i.codigo_licencia, i.estado, i.fecha_creacion,
                   (SELECT count(*)::integer FROM usuario u WHERE u.id_institucion = i.id_institucion) AS total_usuarios,
                   (SELECT count(*)::integer FROM curso c WHERE c.id_institucion = i.id_institucion) AS total_cursos,
                   COALESCE(json_agg(json_build_object(
                       'id_institucion_dominio', d.id_institucion_dominio,
                       'dominio', d.dominio,
                       'estado', d.estado,
                       'verificado_en', d.verificado_en
                   ) ORDER BY d.dominio) FILTER (WHERE d.id_institucion_dominio IS NOT NULL), '[]'::json) AS dominios
              FROM institucion i
              LEFT JOIN institucion_dominio d ON d.id_institucion = i.id_institucion
             GROUP BY i.id_institucion
             ORDER BY i.nombre ASC;
        `);
        return res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        return next(error);
    }
};

/**
 * Crear una institución (solo superadministrador)
 * POST /api/auth/admin/instituciones
 */
const createInstitucion = async (req, res, next) => {
    const client = await getClient();
    let transactionStarted = false;
    try {
        const nombre = cleanString(req.body?.nombre, { min: 3, max: 150 });
        const licencia = cleanString(req.body?.codigo_licencia, { min: 3, max: 80 });
        const estado = req.body?.estado === undefined
            ? 'activa'
            : cleanString(req.body.estado, { min: 6, max: 8, lower: true });

        if (!nombre || !licencia || !['activa', 'inactiva'].includes(estado)) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, código de licencia o estado no válidos.'
            });
        }

        await client.query('BEGIN');
        transactionStarted = true;
        const result = await client.query(`
            INSERT INTO institucion (nombre, codigo_licencia, estado)
            VALUES ($1, $2, $3)
            RETURNING id_institucion, nombre, codigo_licencia, estado, fecha_creacion;
        `, [nombre, licencia, estado]);
        const institution = result.rows[0];

        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId: institution.id_institucion,
            action: 'INSTITUCION_CREADA',
            targetType: 'institucion',
            targetId: institution.id_institucion,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { estado }
        });

        await client.query('COMMIT');
        transactionStarted = false;
        return res.status(201).json({
            success: true,
            message: 'Institución creada correctamente.',
            data: institution
        });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una institución con ese nombre o código de licencia.'
            });
        }
        if (error.code === '23514') {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    } finally {
        client.release();
    }
};

/**
 * Editar nombre, licencia y estado de una institución
 * PUT /api/auth/admin/instituciones/:id_institucion
 */
const updateInstitucion = async (req, res, next) => {
    const client = await getClient();
    let transactionStarted = false;
    try {
        const institutionId = req.params.id_institucion;
        const nombre = cleanString(req.body?.nombre, { min: 3, max: 150 });
        const licencia = cleanString(req.body?.codigo_licencia, { min: 3, max: 80 });
        const requestedState = req.body?.estado === undefined
            ? null
            : cleanString(req.body.estado, { min: 6, max: 8, lower: true });

        if (!isUuid(institutionId) || !nombre || !licencia || (requestedState !== null && !['activa', 'inactiva'].includes(requestedState))) {
            return res.status(400).json({
                success: false,
                message: 'Institución, nombre, código de licencia o estado no válidos.'
            });
        }

        await client.query('BEGIN');
        transactionStarted = true;
        const current = await client.query(
            'SELECT id_institucion, estado FROM institucion WHERE id_institucion = $1 FOR UPDATE;',
            [institutionId]
        );
        if (current.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(404).json({ success: false, message: 'Institución no encontrada.' });
        }

        const nextState = requestedState || current.rows[0].estado;
        const result = await client.query(`
            UPDATE institucion
               SET nombre = $1, codigo_licencia = $2, estado = $3
             WHERE id_institucion = $4
             RETURNING id_institucion, nombre, codigo_licencia, estado, fecha_creacion;
        `, [nombre, licencia, nextState, institutionId]);
        const institution = result.rows[0];

        if (nextState === 'inactiva' && current.rows[0].estado !== 'inactiva') {
            await client.query(
                'UPDATE usuario SET token_version = token_version + 1 WHERE id_institucion = $1;',
                [institutionId]
            );
        }

        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId,
            action: 'INSTITUCION_ACTUALIZADA',
            targetType: 'institucion',
            targetId: institutionId,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { estado: nextState }
        });

        await client.query('COMMIT');
        transactionStarted = false;
        return res.json({
            success: true,
            message: 'Institución actualizada correctamente.',
            data: institution
        });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una institución con ese nombre o código de licencia.'
            });
        }
        if (error.code === '23514') {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    } finally {
        client.release();
    }
};

/**
 * Activar o inactivar una institución
 * PATCH /api/auth/admin/instituciones/:id_institucion/estado
 */
const updateInstitucionStatus = async (req, res, next) => {
    const client = await getClient();
    let transactionStarted = false;
    try {
        const institutionId = req.params.id_institucion;
        const estado = cleanString(req.body?.estado, { min: 6, max: 8, lower: true });
        if (!isUuid(institutionId) || !['activa', 'inactiva'].includes(estado)) {
            return res.status(400).json({ success: false, message: 'Institución o estado no válido.' });
        }

        await client.query('BEGIN');
        transactionStarted = true;
        const current = await client.query(
            'SELECT id_institucion, estado FROM institucion WHERE id_institucion = $1 FOR UPDATE;',
            [institutionId]
        );
        if (current.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(404).json({ success: false, message: 'Institución no encontrada.' });
        }

        const result = await client.query(`
            UPDATE institucion
               SET estado = $1
             WHERE id_institucion = $2
             RETURNING id_institucion, nombre, codigo_licencia, estado, fecha_creacion;
        `, [estado, institutionId]);

        if (estado === 'inactiva' && current.rows[0].estado !== 'inactiva') {
            await client.query(
                'UPDATE usuario SET token_version = token_version + 1 WHERE id_institucion = $1;',
                [institutionId]
            );
        }

        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId,
            action: 'INSTITUCION_ESTADO_ACTUALIZADO',
            targetType: 'institucion',
            targetId: institutionId,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { estado }
        });

        await client.query('COMMIT');
        transactionStarted = false;
        return res.json({
            success: true,
            message: `Institución ${estado === 'activa' ? 'activada' : 'inactivada'} correctamente.`,
            data: result.rows[0]
        });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        client.release();
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
                token_version = CASE WHEN $2::text = 'inactivo' THEN token_version + 1 ELSE token_version END
            WHERE id_usuario = $3 AND rol IN ('docente', 'estudiante')
            RETURNING id_usuario, id_institucion, nombre, apellido, email, rol, genero, estado;
        `, [estado, estado, id_usuario]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado o no gestionable.'
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
            message: `Estado del usuario actualizado a ${estado}.`,
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
    updateAvatar,
    completeBirthDate,
    acceptTerms,
    avatarOf,
    getInstituciones,
    getUsuarios,
    getAdminInstituciones,
    createInstitucion,
    updateInstitucion,
    updateInstitucionStatus,
    getPendingTeachers,
    updateUserStatus,
    generateToken
};
