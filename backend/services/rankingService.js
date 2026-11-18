'use strict';

const { resolveAvatar } = require('../utils/avatarCatalog');

// Ranking de XP de un curso. Solo cuenta matrículas activas del propio curso y el XP ganado en él,
// de modo que nadie ve ni compite con estudiantes de otros cursos o instituciones.
const RANKING_SQL = `
    SELECT u.id_usuario, u.nombre, u.apellido, u.avatar_config,
           COALESCE(SUM(x.cantidad), 0)::integer AS xp,
           RANK() OVER (ORDER BY COALESCE(SUM(x.cantidad), 0) DESC) AS posicion
      FROM matricula m
      JOIN usuario u ON u.id_usuario = m.id_estudiante AND u.estado = 'activo'
      LEFT JOIN xp_movimiento x ON x.id_estudiante = u.id_usuario AND x.id_curso = m.id_curso
     WHERE m.id_curso = $1 AND m.estado = 'activa'
     GROUP BY u.id_usuario
     ORDER BY xp DESC, u.nombre ASC, u.id_usuario ASC;
`;

// Nombre + inicial del apellido: suficiente para reconocer a un compañero sin exponer el nombre completo.
const publicName = (row) => `${row.nombre} ${String(row.apellido || '').trim().charAt(0)}.`.trim();

const toEntry = (row, viewerId) => ({
    posicion: Number(row.posicion),
    nombre: publicName(row),
    xp: row.xp,
    avatar: resolveAvatar(row.avatar_config, row.id_usuario),
    es_yo: row.id_usuario === viewerId
});

const TOP_FOR_STUDENTS = 10;

// Estudiante: top 10 + su propia posición. Docente/administrador: lista completa.
const getCourseRanking = async (db, idCurso, user) => {
    const { rows } = await db.query(RANKING_SQL, [idCurso]);
    const entries = rows.map((row) => toEntry(row, user.id_usuario));
    if (user.rol !== 'estudiante') return { total: entries.length, ranking: entries, yo: null };

    const me = entries.find((entry) => entry.es_yo) || null;
    return { total: entries.length, ranking: entries.slice(0, TOP_FOR_STUDENTS), yo: me };
};

module.exports = { getCourseRanking, publicName };
