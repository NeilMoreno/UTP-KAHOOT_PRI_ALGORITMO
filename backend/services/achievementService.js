'use strict';

// Logros e insignias del catálogo `logro`, calculados a partir de métricas
// obtenidas al vuelo (no se almacenan datos derivados).

const METRICS_SQL = `
    SELECT
        (SELECT COALESCE(sum(cantidad), 0)
           FROM xp_movimiento
          WHERE id_estudiante = $1)::bigint AS xp_acumulado,
        (SELECT count(DISTINCT ee.id_ejercicio)
           FROM evaluacion_ia ev
           JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
          WHERE ev.id_estudiante = $1
            AND ev.puntaje >= 70)::bigint AS ejercicios_aprobados,
        (SELECT COALESCE(max(total), 0)
           FROM (
               SELECT count(*) AS total
                 FROM progreso_mundo pm
                 JOIN matricula ma ON ma.id_matricula = pm.id_matricula
                WHERE ma.id_estudiante = $1
                  AND pm.estado = 'completado'
                GROUP BY pm.id_curso
           ) por_curso)::bigint AS mundos_completados,
        (SELECT count(DISTINCT id_sala)
           FROM participante_sala
          WHERE id_estudiante = $1)::bigint AS partidas_participadas
`;

const CURRENT_VALUE_SQL = `
    CASE l.tipo_condicion
        WHEN 'xp_acumulado' THEN m.xp_acumulado
        WHEN 'ejercicios_aprobados' THEN m.ejercicios_aprobados
        WHEN 'mundos_completados' THEN m.mundos_completados
        WHEN 'partidas_participadas' THEN m.partidas_participadas
    END
`;

// Recibe el cliente de la transacción en curso para que el desbloqueo sea
// atómico con el XP que lo originó.
const unlockAchievements = async (db, idStudent) => {
    const result = await db.query(`
        WITH metricas AS (${METRICS_SQL}),
        nuevos AS (
            INSERT INTO estudiante_logro (id_estudiante, id_logro)
            SELECT $1, l.id_logro
              FROM logro l
              CROSS JOIN metricas m
             WHERE ${CURRENT_VALUE_SQL} >= l.valor_umbral
            ON CONFLICT (id_estudiante, id_logro) DO NOTHING
            RETURNING id_logro
        )
        SELECT l.id_logro, l.nombre, l.descripcion, l.tipo
          FROM nuevos n
          JOIN logro l ON l.id_logro = n.id_logro
         ORDER BY l.nombre;
    `, [idStudent]);
    return result.rows;
};

// Catálogo completo con el avance del estudiante hacia cada logro.
const listAchievementProgress = async (db, idStudent) => {
    const result = await db.query(`
        WITH metricas AS (${METRICS_SQL})
        SELECT l.id_logro, l.nombre, l.descripcion, l.tipo, l.tipo_condicion, l.valor_umbral,
               LEAST(${CURRENT_VALUE_SQL}, l.valor_umbral)::integer AS progreso,
               el.fecha_obtencion
          FROM logro l
          CROSS JOIN metricas m
          LEFT JOIN estudiante_logro el
            ON el.id_logro = l.id_logro AND el.id_estudiante = $1
         ORDER BY (el.fecha_obtencion IS NULL), l.tipo_condicion, l.valor_umbral;
    `, [idStudent]);
    return result.rows;
};

module.exports = { unlockAchievements, listAchievementProgress };
