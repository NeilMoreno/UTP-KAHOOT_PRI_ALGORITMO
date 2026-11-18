'use strict';

// ==============================================================
// codeInt - Prepara la base de PRUEBAS (idempotente)
//
// Crea "codeint_test" si no existe, aplica el esquema (solo si está vacía) y
// las migraciones, da al rol de la app los mismos permisos que en desarrollo
// (sin cambiar su contraseña ni reescribir .env), carga los datos demo y
// siembra el superadministrador de pruebas.
//
// Uso: npm run db:test-setup
// ==============================================================

const path = require('path');
const { spawnSync } = require('child_process');
const { TEST_DB_NAME, testEnv } = require('./with-test-db');

const root = path.resolve(__dirname, '..');
const env = testEnv();
env.ALLOW_TEST_SUPERADMIN = '1';

const step = (label, script, { tolerate } = {}) => {
    console.log(`\n== ${label} ==`);
    const result = spawnSync(process.execPath, [path.join('scripts', script)], { cwd: root, env, encoding: 'utf8' });
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    if (output) console.log(output.split('\n').slice(-4).join('\n'));
    if (result.status !== 0 && !(tolerate && tolerate.test(output))) {
        console.error(`\nFalló el paso "${label}".`);
        process.exit(result.status || 1);
    }
};

const grantAppRole = async () => {
    Object.assign(process.env, env); // la configuración de conexión se lee al cargar el módulo
    const { migrationPool } = require('../backend/config/migrationDatabase');
    const client = await migrationPool.connect();
    try {
        const role = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = 'codeint_app';`);
        if (role.rowCount === 0) {
            console.log('El rol codeint_app no existe; las pruebas usarán la cuenta de DATABASE_URL tal cual.');
            return;
        }
        const { rows } = await client.query('SELECT current_database() AS base, current_user AS owner;');
        if (rows[0].base !== TEST_DB_NAME) throw new Error(`Base inesperada: ${rows[0].base}`);
        const owner = `"${rows[0].owner.replaceAll('"', '""')}"`;
        await client.query('BEGIN');
        for (const sql of [
            `GRANT CONNECT ON DATABASE "${TEST_DB_NAME}" TO codeint_app`,
            'GRANT USAGE ON SCHEMA public TO codeint_app',
            'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO codeint_app',
            'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO codeint_app',
            'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO codeint_app',
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO codeint_app`,
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO codeint_app`,
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO codeint_app`,
            'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON schema_migration FROM codeint_app',
            'REVOKE UPDATE, DELETE, TRUNCATE ON auditoria_seguridad FROM codeint_app',
            'REVOKE DELETE, TRUNCATE ON usuario, institucion, institucion_dominio, invitacion_usuario, token_cuenta FROM codeint_app'
        ]) {
            await client.query(sql);
        }
        await client.query('COMMIT');
        console.log(`Permisos de codeint_app aplicados en ${TEST_DB_NAME}.`);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await migrationPool.end();
    }
};

(async () => {
    console.log(`Preparando la base de pruebas "${TEST_DB_NAME}"…`);
    step('Crear base', 'create-database.js');
    step('Aplicar esquema (solo si está vacía)', 'apply-schema.js', { tolerate: /ya tiene el esquema/i });
    step('Migraciones', 'migrate.js');
    console.log('\n== Permisos del rol de la aplicación ==');
    await grantAppRole();
    step('Datos demo y catálogos', 'seed.js', { tolerate: /ya (existe|existen|cargad)|duplicate|already/i });
    step('Superadministrador de pruebas', 'seed-test-superadmin.js');
    console.log(`\nListo. Ejecuta las pruebas con: npm run test:integration`);
})().catch((error) => {
    console.error(`ERROR | ${error.message}`);
    process.exit(1);
});
