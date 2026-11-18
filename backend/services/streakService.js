'use strict';

// Racha diaria: días consecutivos con actividad (enviar un ejercicio o jugar una sala).
// Se calcula al vuelo desde datos existentes, igual que los logros: no se guarda nada derivado.
// Los días se miden en hora de Lima, no en UTC, para que "hoy" coincida con el del estudiante.
const TIMEZONE = 'America/Lima';
const WINDOW_DAYS = 400;

const ACTIVITY_SQL = `
    SELECT to_char(d, 'YYYY-MM-DD') AS dia
      FROM (
          SELECT DISTINCT (fecha_envio AT TIME ZONE '${TIMEZONE}')::date AS d
            FROM envio_ejercicio WHERE id_estudiante = $1
          UNION
          SELECT DISTINCT (fecha_ingreso AT TIME ZONE '${TIMEZONE}')::date AS d
            FROM participante_sala WHERE id_estudiante = $1
      ) actividad
     WHERE d >= (now() AT TIME ZONE '${TIMEZONE}')::date - ${WINDOW_DAYS}
     ORDER BY d DESC;
`;
const TODAY_SQL = `SELECT to_char((now() AT TIME ZONE '${TIMEZONE}')::date, 'YYYY-MM-DD') AS hoy;`;

const DAY_MS = 24 * 60 * 60 * 1000;
// Aritmética de calendario sobre 'YYYY-MM-DD' en UTC: evita errores por cambios de hora.
const shiftDay = (day, delta) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);

// `days`: fechas con actividad ('YYYY-MM-DD', cualquier orden). `today`: fecha de hoy en Lima.
// La racha sigue viva si hubo actividad hoy o ayer: hoy aún tiene tiempo de sumar y no se rompe a medianoche.
const computeStreak = (days, today) => {
    const active = new Set(days);
    const activeToday = active.has(today);
    let cursor = activeToday ? today : shiftDay(today, -1);
    let current = 0;
    while (active.has(cursor)) { current += 1; cursor = shiftDay(cursor, -1); }

    const sorted = [...active].sort();
    let best = 0;
    let run = 0;
    sorted.forEach((day, index) => {
        run = index > 0 && shiftDay(sorted[index - 1], 1) === day ? run + 1 : 1;
        best = Math.max(best, run);
    });

    const week = Array.from({ length: 7 }, (_, i) => {
        const fecha = shiftDay(today, i - 6);
        return { fecha, activo: active.has(fecha), hoy: fecha === today };
    });

    return {
        racha_actual: current,
        mejor_racha: Math.max(best, current),
        activo_hoy: activeToday,
        en_riesgo: current > 0 && !activeToday,
        ultimos_7: week
    };
};

const getStreak = async (db, idStudent) => {
    const [activity, today] = await Promise.all([db.query(ACTIVITY_SQL, [idStudent]), db.query(TODAY_SQL)]);
    return computeStreak(activity.rows.map((row) => row.dia), today.rows[0].hoy);
};

module.exports = { computeStreak, getStreak, shiftDay };
