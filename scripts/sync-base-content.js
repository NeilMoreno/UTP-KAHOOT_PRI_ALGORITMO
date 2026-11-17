'use strict';

// ==============================================================
// codeInt - Relleno idempotente del catálogo base de ejercicios
//
// Copia a los cursos existentes los ejercicios base que falten en sus
// siete mundos. No modifica ejercicios ya creados ni sobrescribe
// contenido personalizado: sólo inserta los órdenes vacíos.
//
// Uso: npm run db:sync-base-content
// ==============================================================

const { migrationPool } = require('../backend/config/migrationDatabase');
const { BASE_WORLDS } = require('../backend/config/baseContent');

const run = async () => {
    const client = await migrationPool.connect();
    let inserted = 0;
    let skipped = 0;
    let courses = 0;

    try {
        await client.query('BEGIN');

        const worlds = await client.query(`
            SELECT m.id_mundo, m.id_curso, m.orden, c.nombre AS curso_nombre, c.periodo
            FROM mundo m
            JOIN curso c ON c.id_curso = m.id_curso
            WHERE m.tipo_origen = 'base'
            ORDER BY c.fecha_creacion ASC, m.orden ASC;
        `);

        const seenCourses = new Set();

        for (const world of worlds.rows) {
            const base = BASE_WORLDS.find((item) => item.orden === world.orden);
            if (!base) continue;

            if (!seenCourses.has(world.id_curso)) {
                seenCourses.add(world.id_curso);
                courses++;
            }

            for (const ejercicio of base.ejercicios) {
                const exists = await client.query(
                    'SELECT 1 FROM ejercicio WHERE id_mundo = $1 AND orden = $2 LIMIT 1;',
                    [world.id_mundo, ejercicio.orden]
                );
                if (exists.rowCount > 0) {
                    skipped++;
                    continue;
                }

                await client.query(`
                    INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
                    VALUES ($1, $2, $3, $4, $5, $6, $7);
                `, [
                    world.id_mundo,
                    world.id_curso,
                    ejercicio.titulo,
                    ejercicio.enunciado,
                    ejercicio.plantilla_pseint,
                    ejercicio.orden,
                    ejercicio.xp_recompensa
                ]);
                inserted++;
            }
        }

        await client.query('COMMIT');

        console.log('Catálogo base sincronizado.');
        console.log(`  Cursos revisados: ${courses}`);
        console.log(`  Ejercicios insertados: ${inserted}`);
        console.log(`  Ejercicios ya existentes: ${skipped}`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await migrationPool.end().catch(() => {});
    }
};

run().catch((error) => {
    console.error('No se pudo sincronizar el catálogo base:', error.message);
    process.exitCode = 1;
});
