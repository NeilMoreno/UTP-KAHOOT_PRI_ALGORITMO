'use strict';

require('dotenv').config();
const { pool } = require('../backend/config/database');
const { normalizeEmail } = require('../backend/utils/validation');

const failures = [];
const requireCondition = (condition, message) => {
    if (!condition) failures.push(message);
};

const run = async () => {
    const origins = (process.env.CORS_ORIGINS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

    requireCondition(process.env.NODE_ENV === 'production', 'NODE_ENV debe ser production.');
    requireCondition(
        typeof process.env.JWT_SECRET === 'string'
            && process.env.JWT_SECRET.length >= 32
            && !process.env.JWT_SECRET.includes('tu_clave_secreta'),
        'JWT_SECRET no cumple la longitud o todavía es un placeholder.'
    );
    requireCondition(origins.length > 0, 'CORS_ORIGINS debe declarar los orígenes del frontend.');
    requireCondition(
        origins.every(origin => !/localhost|127\.0\.0\.1/i.test(origin)),
        'CORS_ORIGINS todavía contiene destinos locales.'
    );
    requireCondition(process.env.EMAIL_PROVIDER === 'cloudflare', 'EMAIL_PROVIDER debe ser cloudflare.');
    requireCondition(Boolean(process.env.CLOUDFLARE_ACCOUNT_ID), 'Falta CLOUDFLARE_ACCOUNT_ID.');
    requireCondition(Boolean(process.env.CLOUDFLARE_EMAIL_API_TOKEN), 'Falta CLOUDFLARE_EMAIL_API_TOKEN.');
    requireCondition(Boolean(normalizeEmail(process.env.EMAIL_FROM_ADDRESS)), 'EMAIL_FROM_ADDRESS no es válido.');
    requireCondition(
        process.env.ALLOW_DEV_INVITATION_TOKEN_RESPONSE !== 'true',
        'La exposición local del enlace de invitación debe estar deshabilitada.'
    );
    requireCondition(
        process.env.ALLOW_TEST_PASSWORD_RESET_TOKEN_RESPONSE !== 'true'
            && process.env.EXPOSE_TEST_RESET_TOKEN !== 'true',
        'La exposición de tokens de prueba debe estar deshabilitada.'
    );
    requireCondition(
        process.env.ALLOW_DEV_PASSWORD_RESET_TOKEN_RESPONSE !== 'true',
        'El enlace local de restablecimiento debe estar deshabilitado.'
    );
    requireCondition(
        process.env.ALLOW_SUPERADMIN_BOOTSTRAP !== '1'
            && !process.env.BOOTSTRAP_SUPERADMIN_PASSWORD,
        'Las variables temporales de bootstrap deben retirarse.'
    );

    const result = await pool.query(`
        SELECT
            (SELECT count(*)::int
               FROM pg_roles
              WHERE rolname = current_user
                AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication)) AS excessive_db_roles,
            CASE WHEN has_schema_privilege(current_user, 'public', 'CREATE') THEN 1 ELSE 0 END AS can_create_schema_objects,
            (SELECT CASE WHEN count(*) = 1 AND bool_and(
                email = 'admin@codeintcorp.com'
                AND estado = 'activo'
                AND correo_verificado = true
                AND id_institucion IS NULL
            ) THEN 0 ELSE 1 END::int
             FROM usuario WHERE rol = 'superadministrador') AS invalid_superadmin,
            (SELECT count(*)::int
               FROM usuario u
              WHERE u.rol IN ('docente', 'estudiante')
                AND NOT EXISTS (
                    SELECT 1 FROM institucion_dominio d
                     WHERE d.id_institucion = u.id_institucion
                       AND d.dominio = split_part(u.email, '@', 2)
                       AND d.estado = 'activo'
                )) AS invalid_user_domains,
            (SELECT count(*)::int
               FROM usuario
              WHERE email IN ('docente.demo@utp.edu.pe', 'estudiante.demo@utp.edu.pe')) AS demo_accounts,
            (SELECT count(*)::int
               FROM auditoria_seguridad
              WHERE accion = 'SUPERADMIN_BOOTSTRAP'
                AND resultado = 'exitoso') AS successful_admin_bootstraps;
    `);
    const state = result.rows[0];
    requireCondition(state.excessive_db_roles === 0, 'La API conserva privilegios administrativos PostgreSQL.');
    requireCondition(state.can_create_schema_objects === 0, 'La API todavía puede crear objetos en public.');
    requireCondition(state.invalid_superadmin === 0, 'La identidad fija del superadministrador no es válida.');
    requireCondition(state.invalid_user_domains === 0, 'Existen usuarios fuera de dominios institucionales activos.');
    requireCondition(state.demo_accounts === 0, 'Todavía existen cuentas demo en la base de producción.');
    requireCondition(
        state.successful_admin_bootstraps > 0,
        'El superadministrador todavía no fue rotado mediante el bootstrap seguro.'
    );

    if (failures.length > 0) {
        for (const failure of failures) console.error(`FALTA | ${failure}`);
        process.exitCode = 1;
        return;
    }
    console.log('OK | Configuración y base listas para un despliegue de producción.');
};

run()
    .catch(error => {
        console.error('No se pudo completar la comprobación de producción:', error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end().catch(() => {}));
