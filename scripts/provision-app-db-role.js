'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const roleName = 'codeint_app';
const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

const adminConnection = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL
    ? {
        connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized } : false
    }
    : {
        host: process.env.MIGRATION_DB_HOST || process.env.DB_HOST || '127.0.0.1',
        port: Number.parseInt(process.env.MIGRATION_DB_PORT || process.env.DB_PORT || '5432', 10),
        user: process.env.MIGRATION_DB_USER || process.env.DB_USER || 'postgres',
        password: process.env.MIGRATION_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
        database: process.env.MIGRATION_DB_NAME || process.env.DB_NAME || 'codeint_db',
        ssl: useSsl ? { rejectUnauthorized } : false
    };

const pool = new Pool({ ...adminConnection, max: 1, application_name: 'codeint-role-provisioner' });

const setEnvValue = (source, name, value) => {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    if (pattern.test(source)) return source.replace(pattern, line);
    return `${source.replace(/\s*$/, '')}\n${line}\n`;
};

const formatSql = async (client, format, values) => {
    const result = await client.query('SELECT format($1, VARIADIC $2::text[]) AS sql;', [format, values]);
    return result.rows[0].sql;
};

const run = async () => {
    const client = await pool.connect();
    const appPassword = crypto.randomBytes(48).toString('base64url');
    try {
        const capability = await client.query(`
            SELECT current_user, current_database(), r.rolsuper, r.rolcreaterole
            FROM pg_roles r
            WHERE r.rolname = current_user;
        `);
        const current = capability.rows[0];
        if (!current || (!current.rolsuper && !current.rolcreaterole)) {
            throw new Error('La cuenta de migración no puede crear o administrar roles PostgreSQL.');
        }

        await client.query('BEGIN');
        const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1;', [roleName]);
        const passwordSql = await formatSql(
            client,
            exists.rowCount > 0
                ? 'ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L'
                : 'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
            [roleName, appPassword]
        );
        await client.query(passwordSql);

        const statements = [
            ['GRANT CONNECT ON DATABASE %I TO %I', [current.current_database, roleName]],
            ['GRANT USAGE ON SCHEMA public TO %I', [roleName]],
            ['GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', [roleName]],
            ['GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', [roleName]],
            ['GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO %I', [roleName]],
            ['ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', [current.current_user, roleName]],
            ['ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', [current.current_user, roleName]],
            ['ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO %I', [current.current_user, roleName]],
            ['ALTER ROLE %I SET statement_timeout = %L', [roleName, '15s']],
            ['ALTER ROLE %I SET lock_timeout = %L', [roleName, '5s']]
        ];
        for (const [format, values] of statements) {
            await client.query(await formatSql(client, format, values));
        }

        await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC;');
        await client.query(`
            REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON schema_migration FROM codeint_app;
            REVOKE UPDATE, DELETE, TRUNCATE ON auditoria_seguridad FROM codeint_app;
            REVOKE DELETE, TRUNCATE ON
                usuario,
                institucion,
                institucion_dominio,
                invitacion_usuario,
                token_cuenta
            FROM codeint_app;
        `);
        await client.query('COMMIT');

        let envText = await fs.readFile(envPath, 'utf8');
        const sourceUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
        if (sourceUrl) {
            const appUrl = new URL(sourceUrl);
            appUrl.username = roleName;
            appUrl.password = appPassword;
            envText = setEnvValue(envText, 'MIGRATION_DATABASE_URL', sourceUrl);
            envText = setEnvValue(envText, 'DATABASE_URL', appUrl.toString());
        } else {
            const migrationValues = {
                MIGRATION_DB_HOST: process.env.MIGRATION_DB_HOST || process.env.DB_HOST || '127.0.0.1',
                MIGRATION_DB_PORT: process.env.MIGRATION_DB_PORT || process.env.DB_PORT || '5432',
                MIGRATION_DB_USER: process.env.MIGRATION_DB_USER || process.env.DB_USER || 'postgres',
                MIGRATION_DB_PASSWORD: process.env.MIGRATION_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
                MIGRATION_DB_NAME: process.env.MIGRATION_DB_NAME || process.env.DB_NAME || 'codeint_db'
            };
            for (const [name, value] of Object.entries(migrationValues)) {
                envText = setEnvValue(envText, name, value);
            }
            envText = setEnvValue(envText, 'DATABASE_URL', '');
            envText = setEnvValue(envText, 'DB_USER', roleName);
            envText = setEnvValue(envText, 'DB_PASSWORD', appPassword);
        }
        envText = setEnvValue(envText, 'JWT_EXPIRES_IN', '30m');
        envText = setEnvValue(envText, 'EMAIL_PROVIDER', process.env.EMAIL_PROVIDER || 'disabled');
        envText = setEnvValue(
            envText,
            'ALLOW_DEV_INVITATION_TOKEN_RESPONSE',
            process.env.NODE_ENV === 'production' ? 'false' : 'true'
        );
        envText = setEnvValue(envText, 'ALLOW_TEST_PASSWORD_RESET_TOKEN_RESPONSE', 'false');
        envText = setEnvValue(
            envText,
            'ALLOW_DEV_PASSWORD_RESET_TOKEN_RESPONSE',
            process.env.NODE_ENV === 'production' ? 'false' : 'true'
        );
        envText = setEnvValue(envText, 'FRONTEND_INVITATION_URL', `"${process.env.FRONTEND_INVITATION_URL || 'http://localhost:3000/#/registro'}"`);
        envText = setEnvValue(envText, 'FRONTEND_PASSWORD_RESET_URL', `"${process.env.FRONTEND_PASSWORD_RESET_URL || 'http://localhost:3000/#/restablecer-password'}"`);
        await fs.writeFile(envPath, envText, { encoding: 'utf8', mode: 0o600 });

        console.log('Rol PostgreSQL de aplicación provisionado y .env actualizado sin mostrar credenciales.');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

run().catch(error => {
    console.error('No se pudo provisionar el rol de aplicación:', error.message);
    process.exitCode = 1;
});
