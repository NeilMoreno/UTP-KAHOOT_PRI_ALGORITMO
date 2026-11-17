'use strict';

// Crea la base de datos de codeInt si todavía no existe.
// No elimina ni sobrescribe bases existentes.

const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

const baseConfig = process.env.MIGRATION_DATABASE_URL
    ? { connectionString: process.env.MIGRATION_DATABASE_URL }
    : {
        host: process.env.MIGRATION_DB_HOST || process.env.DB_HOST || '127.0.0.1',
        port: Number.parseInt(process.env.MIGRATION_DB_PORT || process.env.DB_PORT || '5432', 10),
        user: process.env.MIGRATION_DB_USER || process.env.DB_USER || 'postgres',
        password: process.env.MIGRATION_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
        database: process.env.MIGRATION_DB_NAME || process.env.DB_NAME || 'codeint_db'
    };

const targetDatabase = baseConfig.connectionString
    ? decodeURIComponent(new URL(baseConfig.connectionString).pathname.slice(1))
    : baseConfig.database;

const adminConfig = baseConfig.connectionString
    ? (() => {
        const url = new URL(baseConfig.connectionString);
        url.pathname = '/postgres';
        return { connectionString: url.toString() };
    })()
    : { ...baseConfig, database: 'postgres' };

if (useSsl) adminConfig.ssl = { rejectUnauthorized };

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

const run = async () => {
    if (!targetDatabase || !/^[a-zA-Z0-9_]+$/.test(targetDatabase)) {
        throw new Error('El nombre de la base de datos no es válido.');
    }

    const client = new Client({ ...adminConfig, application_name: 'codeint-create-db' });
    await client.connect();
    try {
        const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1;', [targetDatabase]);
        if (exists.rowCount > 0) {
            console.log(`OK | La base "${targetDatabase}" ya existe; no se modificó.`);
            return;
        }
        await client.query(`CREATE DATABASE ${quoteIdentifier(targetDatabase)} ENCODING 'UTF8';`);
        console.log(`OK | Base "${targetDatabase}" creada.`);
    } finally {
        await client.end();
    }
};

run().catch((error) => {
    console.error('No se pudo crear la base de datos:', error.message);
    process.exitCode = 1;
});
