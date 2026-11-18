'use strict';

// Misiones semanales: 3 por semana (lunes-domingo, hora de Lima) rotando el catálogo `mision`.
// El progreso se calcula al vuelo desde la actividad real; solo se guarda qué misiones se completaron,
// porque la recompensa (una pieza de avatar) debe seguir desbloqueada aunque pase la semana.
const TIMEZONE = 'America/Lima';
const MISSIONS_PER_WEEK = 3;
const PASS_SCORE = 70; // mismo umbral de "aprobado" que logros y mapa de mundos

const WEEK_SQL = `
    SELECT to_char(date_trunc('week', now() AT TIME ZONE '${TIMEZONE}'), 'YYYY-MM-DD') AS semana,
           (date_trunc('week', now() AT TIME ZONE '${TIMEZONE}') AT TIME ZONE '${TIMEZONE}') AS desde,
           ((date_trunc('week', now() AT TIME ZONE '${TIMEZONE}') + interval '7 days') AT TIME ZONE '${TIMEZONE}') AS hasta;
`;

const METRICS_SQL = `
    SELECT
        (SELECT count(DISTINCT id_ejercicio) FROM envio_ejercicio
          WHERE id_estudiante = $1 AND fecha_envio >= $2 AND fecha_envio < $3)::integer AS ejercicios_enviados,
        (SELECT count(DISTINCT ee.id_ejercicio)
           FROM evaluacion_ia ev
           JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
          WHERE ev.id_estudiante = $1 AND ev.puntaje >= ${PASS_SCORE}
            AND ev.fecha_evaluacion >= $2 AND ev.fecha_evaluacion < $3)::integer AS ejercicios_aprobados,
        (SELECT count(DISTINCT id_sala) FROM participante_sala
          WHERE id_estudiante = $1 AND fecha_ingreso >= $2 AND fecha_ingreso < $3)::integer AS partidas_jugadas,
        (SELECT count(*) FROM (
             SELECT (fecha_envio AT TIME ZONE '${TIMEZONE}')::date AS d FROM envio_ejercicio
              WHERE id_estudiante = $1 AND fecha_envio >= $2 AND fecha_envio < $3
             UNION
             SELECT (fecha_ingreso AT TIME ZONE '${TIMEZONE}')::date FROM participante_sala
              WHERE id_estudiante = $1 AND fecha_ingreso >= $2 AND fecha_ingreso < $3
         ) dias)::integer AS dias_activos;
`;

// Elige las misiones de la semana: ventana de 3 sobre el catálogo ordenado, desplazada una vez por semana.
const pickWeekly = (catalog, weekStart) => {
    if (catalog.length <= MISSIONS_PER_WEEK) return catalog;
    const weekNumber = Math.floor(Date.parse(`${weekStart}T00:00:00Z`) / (7 * 24 * 60 * 60 * 1000));
    return Array.from({ length: MISSIONS_PER_WEEK }, (_, k) => catalog[(weekNumber * MISSIONS_PER_WEEK + k) % catalog.length]);
};

const toMission = (mission, metrics) => {
    const progreso = Math.min(Number(metrics[mission.tipo_condicion]) || 0, mission.meta);
    return {
        codigo: mission.codigo,
        nombre: mission.nombre,
        descripcion: mission.descripcion,
        progreso,
        meta: mission.meta,
        completada: progreso >= mission.meta,
        recompensa: mission.recompensa_capa ? { capa: mission.recompensa_capa, id: mission.recompensa_pieza } : null
    };
};

// Piezas de avatar ganadas con misiones (de cualquier semana).
const getMissionUnlocks = async (db, idStudent) => {
    const result = await db.query(`
        SELECT DISTINCT m.recompensa_capa AS capa, m.recompensa_pieza AS id
          FROM estudiante_mision em
          JOIN mision m ON m.codigo = em.codigo
         WHERE em.id_estudiante = $1 AND m.recompensa_capa IS NOT NULL;
    `, [idStudent]);
    return result.rows;
};

const getWeeklyMissions = async (db, idStudent) => {
    const week = (await db.query(WEEK_SQL)).rows[0];
    const catalog = (await db.query('SELECT * FROM mision ORDER BY codigo;')).rows;
    const chosen = pickWeekly(catalog, week.semana);
    const metrics = (await db.query(METRICS_SQL, [idStudent, week.desde, week.hasta])).rows[0];
    const missions = chosen.map((mission) => toMission(mission, metrics));

    // Registrar lo completado: es idempotente y es lo que mantiene la recompensa tras la semana.
    for (const mission of missions.filter((item) => item.completada)) {
        await db.query(
            `INSERT INTO estudiante_mision (id_estudiante, codigo, semana) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING;`,
            [idStudent, mission.codigo, week.semana]
        );
    }

    return {
        semana: week.semana,
        termina: week.hasta,
        misiones: missions,
        desbloqueos: await getMissionUnlocks(db, idStudent)
    };
};

module.exports = { getWeeklyMissions, getMissionUnlocks, pickWeekly, toMission };
