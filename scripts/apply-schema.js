'use strict';

// Aplica database/schema.sql sobre una base vacía usando la cuenta propietaria.
// Evita depender de psql y de las metacomandos del volcado (líneas que empiezan con "\").

const fs = require('fs/promises');
const path = require('path');
const { migrationPool } = require('../backend/config/migrationDatabase');

const schemaPath = path.resolve(__dirname, '../database/schema.sql');

const run = async () => {
    const raw = await fs.readFile(schemaPath, 'utf8');
    const sql = raw
        .split(/\r?\n/)
        .filter((line) => !line.trimStart().startsWith('\\'))
        .join('\n');

    if (!/CREATE TABLE/i.test(sql)) {
        throw new Error('database/schema.sql no contiene sentencias CREATE TABLE reconocibles.');
    }

    const client = await migrationPool.connect();
    try {
        const existing = await client.query(`SELECT to_regclass('public.usuario') AS tabla;`);
        if (existing.rows[0].tabla) {
            throw new Error(
                'La base ya tiene el esquema de codeInt. Por seguridad, este comando solo se aplica sobre una base vacía.'
            );
        }

        await client.query(sql);
        console.log('OK | Esquema base aplicado desde database/schema.sql.');
    } finally {
        client.release();
        await migrationPool.end();
    }
};

run().catch((error) => {
    console.error('No se pudo aplicar el esquema:', error.message);
    process.exitCode = 1;
});
