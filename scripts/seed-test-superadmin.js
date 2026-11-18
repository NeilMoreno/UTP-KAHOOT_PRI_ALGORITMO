'use strict';

// ==============================================================
// codeInt - Superadministrador SOLO para la base de pruebas de integración
//
// Las pruebas en tests/*.integration.test.js inician sesión como
// admin@codeintcorp.com con la contraseña de pruebas "codeint123", que no
// cumple la política de contraseñas reales. Este script la inserta
// directamente y únicamente en una base cuyo nombre contenga "test".
//
// Uso (base de pruebas): ALLOW_TEST_SUPERADMIN=1 npm run db:test-superadmin
// ==============================================================

const bcrypt = require('bcryptjs');
const { migrationPool } = require('../backend/config/migrationDatabase');

const EMAIL = 'admin@codeintcorp.com';
const TEST_PASSWORD = 'codeint123';

const run = async () => {
    if (process.env.ALLOW_TEST_SUPERADMIN !== '1') {
        throw new Error('Defina ALLOW_TEST_SUPERADMIN=1 para sembrar el superadministrador de pruebas.');
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('El superadministrador de pruebas no puede crearse con NODE_ENV=production.');
    }

    const client = await migrationPool.connect();
    try {
        const { rows } = await client.query('SELECT current_database() AS base;');
        if (!/test/i.test(rows[0].base)) {
            throw new Error(`La base "${rows[0].base}" no parece de pruebas (su nombre debe contener "test"). No se modificó nada.`);
        }

        const hash = await bcrypt.hash(TEST_PASSWORD, 10);
        const inserted = await client.query(`
            INSERT INTO usuario (nombre, apellido, email, password_hash, rol, genero, estado, correo_verificado, correo_verificado_en)
            SELECT 'Super', 'Admin', $1, $2, 'superadministrador', 'masculino', 'activo', true, now()
            WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE rol = 'superadministrador')
            RETURNING id_usuario;
        `, [EMAIL, hash]);
        console.log(inserted.rowCount > 0
            ? `OK | Superadministrador de pruebas creado en "${rows[0].base}".`
            : `OK | Ya existe un superadministrador en "${rows[0].base}"; no se modificó.`);
    } finally {
        client.release();
        await migrationPool.end();
    }
};

run().catch((error) => {
    console.error(`ERROR | ${error.message}`);
    process.exit(1);
});
