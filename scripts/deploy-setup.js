'use strict';

// Prepara la base en cada despliegue (idempotente): esquema base si la base esta vacia, migraciones y,
// solo si se pide, datos ficticios de prueba con una contrasena propia (nunca la publica del seed).
//
//   DEPLOY_SEED_DEMO=true     carga database/seeds.sql si la base no tiene usuarios
//   DEMO_USER_PASSWORD=...    contrasena para TODAS las cuentas demo (obligatoria con DEPLOY_SEED_DEMO)

const fs = require('fs/promises');
const path = require('path');
const { spawnSync } = require('child_process');
const bcrypt = require('bcryptjs');
const { migrationPool } = require('../backend/config/migrationDatabase');
const { isValidPassword } = require('../backend/utils/passwordPolicy');

const root = path.resolve(__dirname, '..');
const runScript = (script) => {
    const result = spawnSync(process.execPath, [path.join('scripts', script)], { cwd: root, stdio: 'inherit', env: process.env });
    if (result.status !== 0) throw new Error(`${script} terminó con error.`);
};

const run = async () => {
    const seedDemo = process.env.DEPLOY_SEED_DEMO === 'true';
    if (seedDemo && !isValidPassword(process.env.DEMO_USER_PASSWORD || '')) {
        throw new Error('DEPLOY_SEED_DEMO requiere DEMO_USER_PASSWORD con la política de contraseñas (10+ caracteres, mayúscula, minúscula y número).');
    }

    const schema = await migrationPool.query(`SELECT to_regclass('public.usuario') AS tabla;`);
    if (!schema.rows[0].tabla) {
        console.log('Base vacía: aplicando el esquema base…');
        runScript('apply-schema.js');
    }
    runScript('migrate.js');

    if (seedDemo) {
        const users = await migrationPool.query('SELECT count(*)::int AS total FROM usuario;');
        if (users.rows[0].total === 0) {
            console.log('Cargando datos ficticios de prueba…');
            const sql = await fs.readFile(path.join(root, 'database/seeds.sql'), 'utf8');
            await migrationPool.query(sql);
            const hash = await bcrypt.hash(process.env.DEMO_USER_PASSWORD, 12);
            const updated = await migrationPool.query('UPDATE usuario SET password_hash = $1, token_version = token_version + 1;', [hash]);
            console.log(`Contraseña de las ${updated.rowCount} cuentas demo reemplazada por DEMO_USER_PASSWORD.`);
        } else {
            console.log('La base ya tiene usuarios: no se cargan datos demo.');
        }
    }
};

run()
    .then(() => migrationPool.end())
    .catch(async (error) => {
        console.error('Preparación del despliegue fallida:', error.message);
        await migrationPool.end().catch(() => {});
        process.exitCode = 1;
    });
