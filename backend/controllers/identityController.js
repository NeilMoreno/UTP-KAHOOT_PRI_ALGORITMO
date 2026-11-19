'use strict';

const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const {
    cleanString,
    normalizePersonName,
    normalizeEmail,
    normalizeDomain,
    normalizeGenero,
    isUuid
} = require('../utils/validation');
const {
    generateOpaqueToken,
    hashOpaqueToken,
    isOpaqueToken
} = require('../utils/securityTokens');
const { generateToken, setRefreshCookie } = require('../services/tokenService');
const { passwordProblems } = require('../utils/passwordPolicy');
const { validateRegistrationProfile, TERMS_VERSION } = require('../utils/age');
const {
    buildInvitationUrl,
    buildPasswordResetUrl,
    sendInvitationEmail,
    sendPasswordResetEmail
} = require('../services/emailService');
const { getRequestIp, recordSecurityEvent } = require('../services/securityAuditService');

// 400 que dice qué requisitos faltan (el frontend ya los muestra, pero la API no confía en él).
const weakPasswordResponse = (res, problems) => res.status(400).json({
    success: false,
    error: 'WEAK_PASSWORD',
    message: 'La contraseña no cumple los requisitos de seguridad.',
    requisitos_pendientes: problems
});

const getBcryptRounds = () => (
    Math.min(14, Math.max(10, Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10)))
);

const canExposeDevInvitation = () => (
    process.env.NODE_ENV !== 'production'
    && process.env.ALLOW_DEV_INVITATION_TOKEN_RESPONSE === 'true'
);

// Solo con el proveedor de correo deshabilitado: permite probar la recuperación local.
const canExposeDevPasswordReset = () => (
    process.env.NODE_ENV !== 'production'
    && process.env.EMAIL_PROVIDER === 'disabled'
    && process.env.ALLOW_DEV_PASSWORD_RESET_TOKEN_RESPONSE === 'true'
);

const genericResetResponse = {
    success: true,
    message: 'Si el correo corresponde a una cuenta habilitada, recibirá instrucciones para restablecer la contraseña.'
};

const registerByInvitation = async (req, res, next) => {
    let client = null;
    let transactionStarted = false;
    try {
        const body = req.body || {};
        const forbiddenFields = ['rol', 'id_institucion', 'codigo_licencia'];
        if (forbiddenFields.some(field => Object.hasOwn(body, field))) {
            return res.status(400).json({
                success: false,
                message: 'El rol y la institución se determinan exclusivamente mediante la invitación.'
            });
        }

        const invitationToken = body.invitation_token;
        const nombre = normalizePersonName(body.nombre);
        const apellido = normalizePersonName(body.apellido);
        const genero = normalizeGenero(body.genero);

        if (!isOpaqueToken(invitationToken) || !nombre || !apellido || !genero || typeof body.password !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'La invitación o los datos de registro no tienen un formato válido.'
            });
        }
        const basicProblems = passwordProblems(body.password);
        if (basicProblems.length > 0) return weakPasswordResponse(res, basicProblems);

        const tokenHash = hashOpaqueToken(invitationToken);
        client = await getClient();
        await client.query('BEGIN');
        transactionStarted = true;

        const invitationResult = await client.query(`
            SELECT inv.id_invitacion_usuario, inv.id_institucion, inv.email, inv.rol,
                   inv.estado, inv.expira_en, inv.creada_por,
                   i.nombre AS institucion_nombre, i.estado AS institucion_estado
            FROM invitacion_usuario inv
            JOIN institucion i ON i.id_institucion = inv.id_institucion
            WHERE inv.token_hash = $1
            FOR UPDATE OF inv;
        `, [tokenHash]);

        if (invitationResult.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(400).json({ success: false, message: 'La invitación no es válida.' });
        }

        const invitation = invitationResult.rows[0];
        const contextProblems = passwordProblems(body.password, { email: invitation.email, nombre, apellido });
        if (contextProblems.length > 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return weakPasswordResponse(res, contextProblems);
        }
        // Términos (todos), fecha de nacimiento (estudiantes) y consentimiento de apoderado (menores de 18).
        const profile = validateRegistrationProfile({
            rol: invitation.rol,
            fecha_nacimiento: body.fecha_nacimiento,
            acepta_terminos: body.acepta_terminos,
            consentimiento_tutor: body.consentimiento_tutor
        });
        if (!profile.ok) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(profile.status).json({ success: false, error: profile.code, message: profile.message });
        }
        if (invitation.estado !== 'pendiente') {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(409).json({ success: false, message: 'La invitación ya no está disponible.' });
        }

        if (new Date(invitation.expira_en).getTime() <= Date.now()) {
            await client.query(`
                UPDATE invitacion_usuario
                   SET estado = 'vencida'
                 WHERE id_invitacion_usuario = $1;
            `, [invitation.id_invitacion_usuario]);
            await recordSecurityEvent(client, {
                actorId: invitation.creada_por,
                institutionId: invitation.id_institucion,
                action: 'INVITACION_VENCIDA',
                targetType: 'invitacion_usuario',
                targetId: invitation.id_invitacion_usuario,
                result: 'rechazado',
                ip: getRequestIp(req)
            });
            await client.query('COMMIT');
            transactionStarted = false;
            return res.status(410).json({ success: false, message: 'La invitación ha vencido.' });
        }

        if (invitation.institucion_estado !== 'activa') {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(403).json({ success: false, message: 'La institución ya no está activa.' });
        }

        const domainResult = await client.query(`
            SELECT 1
            FROM institucion_dominio
            WHERE id_institucion = $1
              AND dominio = split_part($2, '@', 2)
              AND estado = 'activo';
        `, [invitation.id_institucion, invitation.email]);
        if (domainResult.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(403).json({ success: false, message: 'El dominio institucional ya no está habilitado.' });
        }

        const passwordHash = await bcrypt.hash(body.password, getBcryptRounds());
        const userResult = await client.query(`
            INSERT INTO usuario (
                id_institucion,
                nombre,
                apellido,
                email,
                password_hash,
                rol,
                genero,
                estado,
                correo_verificado,
                correo_verificado_en,
                password_actualizada_en,
                fecha_nacimiento,
                terminos_aceptados_en,
                terminos_version,
                consentimiento_tutor_en
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo', true, now(), now(),
                      $8::date, now(), $9, CASE WHEN $10::boolean THEN now() ELSE NULL END)
            RETURNING id_usuario, id_institucion, nombre, apellido, email, rol, genero,
                      estado, correo_verificado, token_version, fecha_creacion,
                      to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
                      terminos_aceptados_en, terminos_version;
        `, [
            invitation.id_institucion,
            nombre,
            apellido,
            invitation.email,
            passwordHash,
            invitation.rol,
            genero,
            profile.fecha,
            profile.terminosVersion,
            profile.tutor
        ]);

        const newUser = userResult.rows[0];
        await client.query(`
            UPDATE invitacion_usuario
               SET estado = 'usada', usada_en = now(), usada_por = $1
             WHERE id_invitacion_usuario = $2;
        `, [newUser.id_usuario, invitation.id_invitacion_usuario]);

        await recordSecurityEvent(client, {
            actorId: newUser.id_usuario,
            institutionId: newUser.id_institucion,
            action: 'REGISTRO_POR_INVITACION',
            targetType: 'usuario',
            targetId: newUser.id_usuario,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { rol: newUser.rol, edad_registrada: profile.age !== null, menor_con_tutor: profile.tutor }
        });

        await client.query('COMMIT');
        transactionStarted = false;

        setRefreshCookie(res, newUser);
        return res.status(201).json({
            success: true,
            message: 'Cuenta verificada y registrada correctamente en codeInt.',
            token: generateToken(newUser),
            user: newUser
        });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'La invitación o el correo ya fueron utilizados.'
            });
        }
        return next(error);
    } finally {
        if (client) client.release();
    }
};

const inspectInvitation = async (req, res, next) => {
    try {
        const token = req.body?.invitation_token;
        if (!isOpaqueToken(token)) {
            return res.status(400).json({ success: false, message: 'La invitación no es válida.' });
        }
        const result = await query(`
            SELECT inv.email, inv.rol, inv.expira_en,
                   i.id_institucion, i.nombre AS institucion_nombre
            FROM invitacion_usuario inv
            JOIN institucion i ON i.id_institucion = inv.id_institucion AND i.estado = 'activa'
            JOIN institucion_dominio d
              ON d.id_institucion = inv.id_institucion
             AND d.dominio = split_part(inv.email, '@', 2)
             AND d.estado = 'activo'
            WHERE inv.token_hash = $1
              AND inv.estado = 'pendiente'
              AND inv.expira_en > now()
            LIMIT 1;
        `, [hashOpaqueToken(token)]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'La invitación no está disponible.' });
        }
        return res.json({ success: true, invitation: result.rows[0], terminos_version: TERMS_VERSION });
    } catch (error) {
        return next(error);
    }
};

const createInvitation = async (req, res, next) => {
    let client = null;
    let transactionStarted = false;
    let invitation;
    try {
        const idInstitution = req.body?.id_institucion;
        const email = normalizeEmail(req.body?.email);
        const role = cleanString(req.body?.rol, { min: 6, max: 25, lower: true });
        const requestedHours = req.body?.expira_en_horas === undefined
            ? 72
            : Number(req.body.expira_en_horas);

        if (!isUuid(idInstitution) || !email || !['estudiante', 'docente'].includes(role)
            || !Number.isInteger(requestedHours) || requestedHours < 1 || requestedHours > 168) {
            return res.status(400).json({
                success: false,
                message: 'Institución, correo, rol o vigencia de invitación no válidos.'
            });
        }

        const rawToken = generateOpaqueToken();
        client = await getClient();
        await client.query('BEGIN');
        transactionStarted = true;

        const institutionResult = await client.query(`
            SELECT id_institucion, nombre
            FROM institucion
            WHERE id_institucion = $1 AND estado = 'activa';
        `, [idInstitution]);
        if (institutionResult.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(404).json({ success: false, message: 'Institución activa no encontrada.' });
        }

        await client.query(`
            UPDATE invitacion_usuario
               SET estado = 'vencida'
             WHERE email = $1
               AND estado = 'pendiente'
               AND expira_en <= now();
        `, [email]);

        const result = await client.query(`
            INSERT INTO invitacion_usuario (
                id_institucion, email, rol, token_hash, expira_en, creada_por
            ) VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 hour'), $6)
            RETURNING id_invitacion_usuario, id_institucion, email, rol, estado,
                      expira_en, fecha_creacion;
        `, [
            idInstitution,
            email,
            role,
            hashOpaqueToken(rawToken),
            requestedHours,
            req.user.id_usuario
        ]);
        invitation = result.rows[0];

        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId: idInstitution,
            action: 'INVITACION_CREADA',
            targetType: 'invitacion_usuario',
            targetId: invitation.id_invitacion_usuario,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { rol: role }
        });

        await client.query('COMMIT');
        transactionStarted = false;

        let delivery;
        try {
            delivery = await sendInvitationEmail({
                to: invitation.email,
                token: rawToken,
                institutionName: institutionResult.rows[0].nombre,
                role: invitation.rol,
                expiresAt: invitation.expira_en
            });
        } catch (emailError) {
            delivery = { sent: false, provider: 'error' };
        }

        if (!delivery.sent && !canExposeDevInvitation()) {
            await query(`
                UPDATE invitacion_usuario
                   SET estado = 'revocada'
                 WHERE id_invitacion_usuario = $1 AND estado = 'pendiente';
            `, [invitation.id_invitacion_usuario]);
            await recordSecurityEvent(null, {
                actorId: req.user.id_usuario,
                institutionId: idInstitution,
                action: 'INVITACION_ENVIO_FALLIDO',
                targetType: 'invitacion_usuario',
                targetId: invitation.id_invitacion_usuario,
                result: 'fallido',
                ip: getRequestIp(req)
            });
            return res.status(503).json({
                success: false,
                message: 'No fue posible entregar la invitación. La invitación fue revocada.'
            });
        }

        const response = {
            success: true,
            message: delivery.sent
                ? 'Invitación creada y enviada correctamente.'
                : 'Invitación creada en modo local; el proveedor de correo está deshabilitado.',
            invitation,
            delivery: delivery.provider
        };
        if (!delivery.sent && canExposeDevInvitation()) {
            response.dev_invitation_url = buildInvitationUrl(rawToken);
        }
        return res.status(201).json(response);
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'El correo ya tiene una cuenta o invitación pendiente.'
            });
        }
        if (error.code === '23514') {
            return res.status(400).json({ success: false, message: error.message });
        }
        return next(error);
    } finally {
        if (client) client.release();
    }
};

const listInvitations = async (req, res, next) => {
    try {
        const status = req.query?.estado === undefined
            ? null
            : cleanString(req.query.estado, { min: 5, max: 20, lower: true });
        if (status !== null && !['pendiente', 'usada', 'revocada', 'vencida'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado de invitación no válido.' });
        }
        const result = await query(`
            SELECT inv.id_invitacion_usuario, inv.id_institucion, i.nombre AS institucion_nombre,
                   inv.email, inv.rol,
                   CASE WHEN inv.estado = 'pendiente' AND inv.expira_en <= now()
                        THEN 'vencida' ELSE inv.estado END AS estado,
                   inv.expira_en, inv.usada_en, inv.fecha_creacion
            FROM invitacion_usuario inv
            JOIN institucion i ON i.id_institucion = inv.id_institucion
            WHERE ($1::text IS NULL OR inv.estado = $1)
            ORDER BY inv.fecha_creacion DESC
            LIMIT 200;
        `, [status]);
        return res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        return next(error);
    }
};

const revokeInvitation = async (req, res, next) => {
    const client = await getClient();
    let transactionStarted = false;
    try {
        const invitationId = req.params.id_invitacion;
        if (!isUuid(invitationId)) {
            return res.status(400).json({ success: false, message: 'Identificador de invitación no válido.' });
        }
        await client.query('BEGIN');
        transactionStarted = true;
        const result = await client.query(`
            UPDATE invitacion_usuario
               SET estado = 'revocada'
             WHERE id_invitacion_usuario = $1
               AND estado = 'pendiente'
            RETURNING id_invitacion_usuario, id_institucion, email, rol, estado;
        `, [invitationId]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(404).json({ success: false, message: 'Invitación pendiente no encontrada.' });
        }
        const invitation = result.rows[0];
        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId: invitation.id_institucion,
            action: 'INVITACION_REVOCADA',
            targetType: 'invitacion_usuario',
            targetId: invitation.id_invitacion_usuario,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { rol: invitation.rol }
        });
        await client.query('COMMIT');
        transactionStarted = false;
        return res.json({ success: true, message: 'Invitación revocada.', invitation });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        return next(error);
    } finally {
        client.release();
    }
};

const createInstitutionDomain = async (req, res, next) => {
    const client = await getClient();
    let transactionStarted = false;
    try {
        const institutionId = req.params.id_institucion;
        const domain = normalizeDomain(req.body?.dominio);
        if (!isUuid(institutionId) || !domain) {
            return res.status(400).json({ success: false, message: 'Institución o dominio no válido.' });
        }
        await client.query('BEGIN');
        transactionStarted = true;
        const result = await client.query(`
            INSERT INTO institucion_dominio (
                id_institucion, dominio, estado, verificado_en, creado_por
            )
            SELECT id_institucion, $2, 'pendiente', NULL, $3
            FROM institucion
            WHERE id_institucion = $1 AND estado = 'activa'
            RETURNING id_institucion_dominio, id_institucion, dominio, estado,
                      verificado_en, fecha_creacion;
        `, [institutionId, domain, req.user.id_usuario]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(404).json({ success: false, message: 'Institución activa no encontrada.' });
        }
        const record = result.rows[0];
        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId,
            action: 'DOMINIO_INSTITUCIONAL_CREADO',
            targetType: 'institucion_dominio',
            targetId: record.id_institucion_dominio,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { dominio: domain }
        });
        await client.query('COMMIT');
        transactionStarted = false;
        return res.status(201).json({ success: true, data: record });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'El dominio ya está registrado.' });
        }
        return next(error);
    } finally {
        client.release();
    }
};

const listInstitutionDomains = async (req, res, next) => {
    try {
        const institutionId = req.params.id_institucion;
        if (!isUuid(institutionId)) {
            return res.status(400).json({ success: false, message: 'Institución no válida.' });
        }
        const result = await query(`
            SELECT id_institucion_dominio, id_institucion, dominio, estado,
                   verificado_en, fecha_creacion
            FROM institucion_dominio
            WHERE id_institucion = $1
            ORDER BY dominio;
        `, [institutionId]);
        return res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        return next(error);
    }
};

const updateInstitutionDomainStatus = async (req, res, next) => {
    const client = await getClient();
    let transactionStarted = false;
    try {
        const domainId = req.params.id_dominio;
        const status = cleanString(req.body?.estado, { min: 6, max: 10, lower: true });
        if (!isUuid(domainId) || !['activo', 'inactivo'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Dominio o estado no válido.' });
        }
        await client.query('BEGIN');
        transactionStarted = true;
        const result = await client.query(`
            UPDATE institucion_dominio
               SET estado = $1,
                   verificado_en = CASE WHEN $2::text = 'activo' THEN COALESCE(verificado_en, now()) ELSE verificado_en END
             WHERE id_institucion_dominio = $3
            RETURNING id_institucion_dominio, id_institucion, dominio, estado, verificado_en;
        `, [status, status, domainId]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(404).json({ success: false, message: 'Dominio institucional no encontrado.' });
        }
        const record = result.rows[0];
        let revokedInvitations = 0;
        if (status === 'inactivo') {
            const revoked = await client.query(`
                UPDATE invitacion_usuario
                   SET estado = 'revocada'
                 WHERE id_institucion = $1
                   AND split_part(email, '@', 2) = $2
                   AND estado = 'pendiente';
            `, [record.id_institucion, record.dominio]);
            revokedInvitations = revoked.rowCount;
        }
        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId: record.id_institucion,
            action: 'DOMINIO_INSTITUCIONAL_ESTADO_CAMBIADO',
            targetType: 'institucion_dominio',
            targetId: record.id_institucion_dominio,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { estado: status, invitaciones_revocadas: revokedInvitations }
        });
        await client.query('COMMIT');
        transactionStarted = false;
        return res.json({ success: true, data: record });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        return next(error);
    } finally {
        client.release();
    }
};

const requestPasswordReset = async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body?.email);
        if (!email) return res.status(202).json(genericResetResponse);

        const userResult = await query(`
            SELECT id_usuario, id_institucion, email
            FROM usuario
            WHERE email = $1 AND estado = 'activo' AND correo_verificado = true
            LIMIT 1;
        `, [email]);
        if (userResult.rowCount === 0) return res.status(202).json(genericResetResponse);

        const user = userResult.rows[0];
        const rawToken = generateOpaqueToken();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        const client = await getClient();
        try {
            await client.query('BEGIN');
            await client.query(`
                SELECT id_usuario
                  FROM usuario
                 WHERE id_usuario = $1
                 FOR UPDATE;
            `, [user.id_usuario]);
            await client.query(`
                UPDATE token_cuenta
                   SET revocado_en = now()
                 WHERE id_usuario = $1
                   AND tipo = 'restablecer_password'
                   AND usado_en IS NULL
                   AND revocado_en IS NULL;
            `, [user.id_usuario]);
            const tokenResult = await client.query(`
                INSERT INTO token_cuenta (id_usuario, tipo, token_hash, expira_en)
                VALUES ($1, 'restablecer_password', $2, $3)
                RETURNING id_token_cuenta;
            `, [user.id_usuario, hashOpaqueToken(rawToken), expiresAt]);
            await recordSecurityEvent(client, {
                actorId: user.id_usuario,
                institutionId: user.id_institucion,
                action: 'PASSWORD_RESET_SOLICITADO',
                targetType: 'token_cuenta',
                targetId: tokenResult.rows[0].id_token_cuenta,
                result: 'exitoso',
                ip: getRequestIp(req)
            });
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }

        let sent = false;
        try {
            const delivery = await sendPasswordResetEmail({
                to: user.email,
                token: rawToken,
                expiresAt
            });
            sent = delivery.sent;
        } catch (error) {
            sent = false;
        }

        if (!sent && !canExposeDevPasswordReset()) {
            await query(`
                UPDATE token_cuenta
                   SET revocado_en = now()
                 WHERE token_hash = $1 AND usado_en IS NULL;
            `, [hashOpaqueToken(rawToken)]);
            await recordSecurityEvent(null, {
                actorId: user.id_usuario,
                institutionId: user.id_institucion,
                action: 'PASSWORD_RESET_ENVIO_FALLIDO',
                targetType: 'usuario',
                targetId: user.id_usuario,
                result: 'fallido',
                ip: getRequestIp(req)
            });
        }

        const response = { ...genericResetResponse };
        if (canExposeDevPasswordReset()) {
            response.dev_reset_url = buildPasswordResetUrl(rawToken);
        }
        if (sent && process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_PASSWORD_RESET_TOKEN_RESPONSE === 'true') {
            response.test_token = rawToken;
        }
        return res.status(202).json(response);
    } catch (error) {
        return next(error);
    }
};

const resetPassword = async (req, res, next) => {
    const client = await getClient();
    let transactionStarted = false;
    try {
        const token = req.body?.token;
        const newPassword = req.body?.new_password;
        if (!isOpaqueToken(token) || typeof newPassword !== 'string') {
            return res.status(400).json({ success: false, message: 'Token o nueva contraseña no válidos.' });
        }
        const resetBasicProblems = passwordProblems(newPassword);
        if (resetBasicProblems.length > 0) return weakPasswordResponse(res, resetBasicProblems);

        await client.query('BEGIN');
        transactionStarted = true;
        const result = await client.query(`
            SELECT t.id_token_cuenta, t.id_usuario, u.id_institucion, u.email, u.nombre, u.apellido
            FROM token_cuenta t
            JOIN usuario u ON u.id_usuario = t.id_usuario
            WHERE t.token_hash = $1
              AND t.tipo = 'restablecer_password'
              AND t.usado_en IS NULL
              AND t.revocado_en IS NULL
              AND t.expira_en > now()
              AND u.estado = 'activo'
            FOR UPDATE OF t;
        `, [hashOpaqueToken(token)]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(400).json({ success: false, message: 'El token no es válido o ha vencido.' });
        }

        const record = result.rows[0];
        const resetContextProblems = passwordProblems(newPassword, { email: record.email, nombre: record.nombre, apellido: record.apellido });
        if (resetContextProblems.length > 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return weakPasswordResponse(res, resetContextProblems);
        }
        const passwordHash = await bcrypt.hash(newPassword, getBcryptRounds());
        await client.query(`
            UPDATE usuario
               SET password_hash = $1,
                   password_actualizada_en = now(),
                   token_version = token_version + 1
             WHERE id_usuario = $2;
        `, [passwordHash, record.id_usuario]);
        await client.query(`
            UPDATE token_cuenta
               SET usado_en = CASE WHEN id_token_cuenta = $1 THEN now() ELSE usado_en END,
                   revocado_en = CASE
                       WHEN id_token_cuenta <> $1 AND usado_en IS NULL AND revocado_en IS NULL THEN now()
                       ELSE revocado_en
                   END
             WHERE id_usuario = $2 AND tipo = 'restablecer_password';
        `, [record.id_token_cuenta, record.id_usuario]);
        await recordSecurityEvent(client, {
            actorId: record.id_usuario,
            institutionId: record.id_institucion,
            action: 'PASSWORD_RESET_COMPLETADO',
            targetType: 'usuario',
            targetId: record.id_usuario,
            result: 'exitoso',
            ip: getRequestIp(req)
        });
        await client.query('COMMIT');
        transactionStarted = false;
        return res.json({
            success: true,
            message: 'Contraseña restablecida. Todas las sesiones anteriores fueron revocadas.'
        });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        return next(error);
    } finally {
        client.release();
    }
};

const changePassword = async (req, res, next) => {
    const client = await getClient();
    let transactionStarted = false;
    try {
        const currentPassword = req.body?.current_password;
        const newPassword = req.body?.new_password;
        if (typeof currentPassword !== 'string' || currentPassword.length === 0 || currentPassword.length > 128
            || typeof newPassword !== 'string') {
            return res.status(400).json({ success: false, message: 'Las contraseñas no tienen un formato válido.' });
        }
        const changeProblems = passwordProblems(newPassword, {
            email: req.user.email, nombre: req.user.nombre, apellido: req.user.apellido
        });
        if (changeProblems.length > 0) return weakPasswordResponse(res, changeProblems);

        await client.query('BEGIN');
        transactionStarted = true;
        const result = await client.query(`
            SELECT id_usuario, id_institucion, email, rol, password_hash, token_version
            FROM usuario
            WHERE id_usuario = $1
            FOR UPDATE;
        `, [req.user.id_usuario]);
        const user = result.rows[0];
        const matches = user && await bcrypt.compare(currentPassword, user.password_hash);
        if (!matches || await bcrypt.compare(newPassword, user.password_hash)) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return res.status(400).json({ success: false, message: 'La contraseña actual es incorrecta o la nueva no cambia.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, getBcryptRounds());
        const updated = await client.query(`
            UPDATE usuario
               SET password_hash = $1,
                   password_actualizada_en = now(),
                   token_version = token_version + 1
             WHERE id_usuario = $2
            RETURNING id_usuario, id_institucion, email, rol, token_version;
        `, [passwordHash, user.id_usuario]);
        await recordSecurityEvent(client, {
            actorId: user.id_usuario,
            institutionId: user.id_institucion,
            action: 'PASSWORD_CAMBIADO',
            targetType: 'usuario',
            targetId: user.id_usuario,
            result: 'exitoso',
            ip: getRequestIp(req)
        });
        await client.query('COMMIT');
        transactionStarted = false;
        setRefreshCookie(res, updated.rows[0]);
        return res.json({
            success: true,
            message: 'Contraseña actualizada. Las sesiones anteriores fueron revocadas.',
            token: generateToken(updated.rows[0])
        });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        return next(error);
    } finally {
        client.release();
    }
};

const logoutAll = async (req, res, next) => {
    const client = await getClient();
    let transactionStarted = false;
    try {
        await client.query('BEGIN');
        transactionStarted = true;
        await client.query(`
            UPDATE usuario
               SET token_version = token_version + 1
             WHERE id_usuario = $1;
        `, [req.user.id_usuario]);
        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId: req.user.id_institucion,
            action: 'SESIONES_REVOCADAS',
            targetType: 'usuario',
            targetId: req.user.id_usuario,
            result: 'exitoso',
            ip: getRequestIp(req)
        });
        await client.query('COMMIT');
        transactionStarted = false;
        return res.json({ success: true, message: 'Todas las sesiones fueron revocadas.' });
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
        return next(error);
    } finally {
        client.release();
    }
};

module.exports = {
    registerByInvitation,
    inspectInvitation,
    createInvitation,
    listInvitations,
    revokeInvitation,
    createInstitutionDomain,
    listInstitutionDomains,
    updateInstitutionDomainStatus,
    requestPasswordReset,
    resetPassword,
    changePassword,
    logoutAll
};
