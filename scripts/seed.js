'use strict';

const fs = require('fs/promises');
const path = require('path');
const { migrationPool } = require('../backend/config/migrationDatabase');

const run = async () => {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Los datos demo no pueden cargarse con NODE_ENV=production.');
    }
    const sql = await fs.readFile(path.resolve(__dirname, '../database/seeds.sql'), 'utf8');
    await migrationPool.query(sql);
    console.log('Datos demo cargados únicamente para desarrollo.');
    await migrationPool.end();
};

run().catch(async error => {
    console.error('No se pudieron cargar los datos demo:', error.message);
    await migrationPool.end().catch(() => {});
    process.exitCode = 1;
});
