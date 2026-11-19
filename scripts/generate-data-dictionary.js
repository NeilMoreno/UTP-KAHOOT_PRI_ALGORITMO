'use strict';

// Genera DOCS/DICCIONARIO_DATOS.md desde la base real (tablas, columnas, llaves y restricciones).
//   npm run docs:dictionary
// Usa la cuenta de migraciones (solo lectura de catálogo). Así el diccionario nunca se desactualiza.

const fs = require('fs/promises');
const path = require('path');
const { migrationPool } = require('../backend/config/migrationDatabase');

const out = path.resolve(__dirname, '../DOCS/DICCIONARIO_DATOS.md');
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

const run = async () => {
    const tables = (await migrationPool.query(`
        SELECT c.relname AS tabla
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname;`)).rows.map((row) => row.tabla);

    const columns = (await migrationPool.query(`
        SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default, ordinal_position
          FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;`)).rows;

    const constraints = (await migrationPool.query(`
        SELECT rel.relname AS tabla, con.conname, con.contype, pg_get_constraintdef(con.oid) AS definicion
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = rel.relnamespace
         WHERE n.nspname = 'public' ORDER BY rel.relname, con.contype, con.conname;`)).rows;

    const migrations = (await migrationPool.query(`SELECT nombre FROM schema_migration ORDER BY nombre;`).catch(() => ({ rows: [] }))).rows;

    const lines = [
        '# Diccionario de datos de codeInt',
        '',
        `Generado automáticamente desde la base (${new Date().toISOString().slice(0, 10)}) con \`npm run docs:dictionary\`. ` +
        'No lo edites a mano: cambia las migraciones en `database/migrations/` y vuelve a generarlo.',
        '',
        `- **Tablas:** ${tables.length}`,
        `- **Migraciones aplicadas:** ${migrations.length} (${migrations[0]?.nombre || '—'} … ${migrations.at(-1)?.nombre || '—'})`,
        '',
        '## Índice',
        '',
        ...tables.map((table) => `- [\`${table}\`](#${table})`),
        ''
    ];

    for (const table of tables) {
        lines.push(`## ${table}`, '', '| Columna | Tipo | Nulo | Por defecto |', '|---|---|---|---|');
        for (const col of columns.filter((item) => item.table_name === table)) {
            const type = col.character_maximum_length ? `${col.data_type}(${col.character_maximum_length})` : col.data_type;
            lines.push(`| \`${col.column_name}\` | ${cell(type)} | ${col.is_nullable === 'YES' ? 'sí' : 'no'} | ${cell(col.column_default)} |`);
        }
        const own = constraints.filter((item) => item.tabla === table);
        const label = { p: 'Llave primaria', f: 'Llave foránea', u: 'Única', c: 'Regla (CHECK)', x: 'Exclusión' };
        if (own.length > 0) {
            lines.push('', '**Restricciones**', '');
            for (const item of own) lines.push(`- ${label[item.contype] || item.contype} \`${item.conname}\`: \`${cell(item.definicion)}\``);
        }
        lines.push('');
    }

    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, `${lines.join('\n')}\n`, 'utf8');
    console.log(`OK | ${tables.length} tablas documentadas en DOCS/DICCIONARIO_DATOS.md`);
};

run()
    .then(() => migrationPool.end())
    .catch(async (error) => {
        console.error('No se pudo generar el diccionario:', error.message);
        await migrationPool.end().catch(() => {});
        process.exitCode = 1;
    });
