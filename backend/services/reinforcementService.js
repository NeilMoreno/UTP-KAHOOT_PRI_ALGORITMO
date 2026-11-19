'use strict';

// Refuerzo por errores: si el estudiante falla 3 o más veces la misma categoría de error en un curso, se le
// sugiere repasar con lo que YA existe (la teoría del mundo y ejercicios de corrección automática pendientes).
// No usa IA ni gasta cuota: es una consulta sobre sus propias evaluaciones.

const { query } = require('../config/database');

const MIN_FAILS = 3;
const WINDOW_DAYS = 30;
const PASS_SCORE = 70;

const buildReinforcement = async (idCourse, idStudent) => {
    const categories = await query(
        `SELECT ev.categoria_error AS categoria, count(*)::int AS total
           FROM evaluacion_ia ev
          WHERE ev.id_estudiante = $1 AND ev.id_curso = $2 AND ev.puntaje < $3
            AND ev.categoria_error IS NOT NULL AND ev.categoria_error <> 'ninguno'
            AND ev.fecha_evaluacion > now() - make_interval(days => $4)
          GROUP BY ev.categoria_error
          ORDER BY total DESC, ev.categoria_error
          LIMIT 3;`,
        [idStudent, idCourse, PASS_SCORE, WINDOW_DAYS]
    );
    const top = categories.rows.find((row) => row.total >= MIN_FAILS) || null;
    if (!top) return { necesita_refuerzo: false, categorias: categories.rows, categoria: null, ejercicios: [], mundo: null };

    // Mundo donde más falló en esa categoría (para enlazar su lección).
    const world = await query(
        `SELECT m.id_mundo, m.orden, m.nombre, (m.leccion IS NOT NULL) AS tiene_leccion, count(*)::int AS fallos
           FROM evaluacion_ia ev
           JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
           JOIN ejercicio e ON e.id_ejercicio = ee.id_ejercicio
           JOIN mundo m ON m.id_mundo = e.id_mundo
          WHERE ev.id_estudiante = $1 AND ev.id_curso = $2 AND ev.puntaje < $3 AND ev.categoria_error = $4
          GROUP BY m.id_mundo, m.orden, m.nombre, m.leccion
          ORDER BY fallos DESC, m.orden LIMIT 1;`,
        [idStudent, idCourse, PASS_SCORE, top.categoria]
    );

    // Ejercicios de corrección automática aún sin aprobar, en mundos que ya puede abrir.
    const reachable = await query(
        `SELECT COALESCE(ma.mundos_convalidados, 0)
                + (SELECT count(*) FROM progreso_mundo pm WHERE pm.id_matricula = ma.id_matricula AND pm.estado = 'completado')
                + 1 AS max_orden
           FROM matricula ma WHERE ma.id_curso = $1 AND ma.id_estudiante = $2 AND ma.estado = 'activa' LIMIT 1;`,
        [idCourse, idStudent]
    );
    const maxOrder = Number(reachable.rows[0]?.max_orden || 1);
    const exercises = await query(
        `SELECT e.id_ejercicio, e.titulo, e.tipo, m.orden AS mundo_orden
           FROM ejercicio e JOIN mundo m ON m.id_mundo = e.id_mundo
          WHERE e.id_curso = $1 AND e.tipo <> 'escribir' AND m.orden <= $3
            AND NOT EXISTS (
                SELECT 1 FROM envio_ejercicio ee JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                 WHERE ee.id_ejercicio = e.id_ejercicio AND ee.id_estudiante = $2 AND ev.puntaje >= $4)
          ORDER BY m.orden, e.orden LIMIT 3;`,
        [idCourse, idStudent, maxOrder, PASS_SCORE]
    );

    return {
        necesita_refuerzo: true,
        categorias: categories.rows,
        categoria: top,
        mundo: world.rows[0] || null,
        ejercicios: exercises.rows
    };
};

module.exports = { buildReinforcement, MIN_FAILS, WINDOW_DAYS };
