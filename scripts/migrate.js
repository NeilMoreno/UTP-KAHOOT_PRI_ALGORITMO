'use strict';

const fs = require('fs/promises');
const path = require('path');
const { migrationPool } = require('../backend/config/migrationDatabase');

const migrationsDir = path.resolve(__dirname, '../database/migrations');

const run = async () => {
    const client = await migrationPool.connect();
    try {
        const schema = await client.query(`SELECT to_regclass('public.usuario') AS usuario;`);
        if (!schema.rows[0].usuario) {
            throw new Error(
                'La base no tiene el esquema base. Aplica primero database/schema.sql con la cuenta propietaria '
                + '(ver README.md, sección "Instalación local").'
            );
        }

        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migration (
                nombre VARCHAR(255) PRIMARY KEY,
                aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await client.query("SELECT pg_advisory_lock(hashtext('codeint_schema_migrations')); ");

        const files = (await fs.readdir(migrationsDir))
            .filter(file => file.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const exists = await client.query(
                'SELECT 1 FROM schema_migration WHERE nombre = $1;',
                [file]
            );
            if (exists.rowCount > 0) {
                console.log(`OMITIDA ${file}`);
                continue;
            }

            const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
            await client.query(sql);
            await client.query('INSERT INTO schema_migration (nombre) VALUES ($1);', [file]);
            console.log(`APLICADA ${file}`);
        }
    } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext('codeint_schema_migrations')); ").catch(() => {});
        client.release();
        await migrationPool.end();
    }
};

run().catch(error => {
    console.error('Error de migración:', error.message);
    process.exitCode = 1;
});
