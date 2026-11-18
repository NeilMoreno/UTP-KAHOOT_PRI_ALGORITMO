'use strict';

// ==============================================================
// codeInt - Ejecuta un comando contra la base de PRUEBAS
//
// Sobrescribe solo el entorno del proceso hijo (no toca .env): las URLs de
// conexión apuntan a TEST_DB_NAME (por defecto "codeint_test") y se activa
// RUN_DB_TESTS. Así las pruebas de integración nunca usan la base de desarrollo.
//
// Uso: node scripts/with-test-db.js npm test
//      node scripts/with-test-db.js --show
// ==============================================================

const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const TEST_DB_NAME = process.env.TEST_DB_NAME || 'codeint_test';

if (!/^[a-zA-Z0-9_]*test[a-zA-Z0-9_]*$/i.test(TEST_DB_NAME)) {
    console.error(`ERROR | TEST_DB_NAME ("${TEST_DB_NAME}") debe contener "test" para evitar tocar una base real.`);
    process.exit(1);
}

const withDatabase = (value) => {
    if (!value) return value;
    const url = new URL(value);
    url.pathname = `/${TEST_DB_NAME}`;
    return url.toString();
};

// Variables de entorno para un proceso que debe usar la base de pruebas.
const testEnv = () => {
    const env = { ...process.env, DB_NAME: TEST_DB_NAME, MIGRATION_DB_NAME: TEST_DB_NAME, RUN_DB_TESTS: '1' };
    if (process.env.DATABASE_URL) env.DATABASE_URL = withDatabase(process.env.DATABASE_URL);
    if (process.env.MIGRATION_DATABASE_URL) env.MIGRATION_DATABASE_URL = withDatabase(process.env.MIGRATION_DATABASE_URL);
    delete env.NODE_ENV; // las pruebas y los seeds no deben ejecutarse como producción
    return env;
};

module.exports = { TEST_DB_NAME, testEnv };

if (require.main === module) {
    const [command, ...args] = process.argv.slice(2);
    const env = testEnv();
    if (command === '--show') {
        for (const name of ['DATABASE_URL', 'MIGRATION_DATABASE_URL']) {
            if (!env[name]) continue;
            const url = new URL(env[name]);
            console.log(`${name}: usuario=${url.username} host=${url.hostname} base=${url.pathname.slice(1)}`);
        }
        console.log(`DB_NAME=${env.DB_NAME} MIGRATION_DB_NAME=${env.MIGRATION_DB_NAME}`);
        process.exit(0);
    }
    if (!command) {
        console.error('Uso: node scripts/with-test-db.js <comando> [argumentos] | --show');
        process.exit(1);
    }
    const child = spawn(command, args, { stdio: 'inherit', env, cwd: path.resolve(__dirname, '..'), shell: true });
    child.on('exit', (code) => process.exit(code ?? 1));
}
