'use strict';

// ==============================================================
// codeInt - Analíticas académicas (/api/analiticas)
// Agregados por curso, mundo, estudiante, errores y salas.
// ==============================================================

const { query } = require('../config/database');
const { getAuthorizedCourse } = require('../services/authorizationService');
const { httpError } = require('../utils/httpError');
const { isUuid } = require('../utils/validation');
const { getDemographics } = require('../services/demographicsService');

const roundFloat = (expression) => `ROUND(COALESCE(${expression}, 0)::numeric, 2)::float8`;

/**
 * Resumen de cursos del docente (o de todas las instituciones para el superadministrador)
 * GET /api/analiticas/cursos
 */
const getCoursesSummary = async (req, res, next) => {
    try {
        const idDocente = req.user.rol === 'docente' ? req.user.id_usuario : null;
        const idInstitucion = req.query?.id_institucion || null;
        if (idInstitucion !== null && !isUuid(idInstitucion)) {
            throw httpError(400, 'id_institucion debe ser un UUID válido.', 'INVALID_INSTITUTION_ID');
        }

        const result = await query(`
            WITH base AS (
                SELECT c.id_curso, c.nombre, c.codigo_curso, c.periodo, c.estado,
                       c.id_docente, c.id_institucion
                  FROM curso c
                 WHERE ($1::uuid IS NULL OR c.id_docente = $1)
                   AND ($2::uuid IS NULL OR c.id_institucion = $2)
            ),
            worlds AS (
                SELECT b.id_curso, count(w.id_mundo)::integer AS total_mundos
                  FROM base b
                  LEFT JOIN mundo w ON w.id_curso = b.id_curso
                 GROUP BY b.id_curso
            ),
            enroll AS (
                SELECT b.id_curso, m.id_matricula
                  FROM base b
                  LEFT JOIN matricula m ON m.id_curso = b.id_curso AND m.estado = 'activa'
            ),
            progress AS (
                SELECT e.id_curso,
                       AVG(
                           CASE WHEN e.id_matricula IS NULL THEN 0
                                ELSE (SELECT count(*) FROM progreso_mundo pm
                                       WHERE pm.id_matricula = e.id_matricula
                                         AND pm.id_curso = e.id_curso
                                         AND pm.estado = 'completado')::numeric
                                     / NULLIF(w.total_mundos, 0)
                           END
                       ) AS avg_avance
                  FROM enroll e
                  JOIN worlds w ON w.id_curso = e.id_curso
                 GROUP BY e.id_curso
            )
            SELECT b.id_curso, b.nombre, b.codigo_curso, b.periodo, b.estado,
                   b.id_docente, b.id_institucion,
                   (SELECT count(*)::integer FROM matricula m
                     WHERE m.id_curso = b.id_curso AND m.estado = 'activa') AS total_estudiantes,
                   w.total_mundos,
                   ROUND(COALESCE(p.avg_avance, 0) * 100)::integer AS porcentaje_avance,
                   (SELECT count(*)::integer FROM envio_ejercicio ee WHERE ee.id_curso = b.id_curso) AS total_envios,
                   (SELECT count(*)::integer
                      FROM evaluacion_ia ev
                      JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
                     WHERE ee.id_curso = b.id_curso) AS total_evaluaciones,
                   (SELECT count(DISTINCT (ee.id_matricula, ee.id_ejercicio))::integer
                      FROM envio_ejercicio ee
                      JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                     WHERE ee.id_curso = b.id_curso AND ev.puntaje >= 70) AS ejercicios_aprobados,
                   ${roundFloat(`(SELECT AVG(ev.puntaje)
                        FROM evaluacion_ia ev
                        JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
                       WHERE ee.id_curso = b.id_curso)`)} AS promedio_puntaje
              FROM base b
              JOIN worlds w ON w.id_curso = b.id_curso
              LEFT JOIN progress p ON p.id_curso = b.id_curso
             ORDER BY b.nombre ASC;
        `, [idDocente, idInstitucion]);

        return res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        return next(error);
    }
};

const summaryForCourse = async (idCurso) => {
    const result = await query(`
        SELECT
            (SELECT count(*)::integer FROM matricula m
              WHERE m.id_curso = $1 AND m.estado = 'activa') AS total_estudiantes,
            (SELECT count(*)::integer FROM mundo w WHERE w.id_curso = $1) AS total_mundos,
            (SELECT count(*)::integer FROM ejercicio e WHERE e.id_curso = $1) AS total_ejercicios,
            ROUND(COALESCE((
                SELECT AVG(
                    CASE WHEN m.id_matricula IS NULL THEN 0
                         ELSE (SELECT count(*) FROM progreso_mundo pm
                                WHERE pm.id_matricula = m.id_matricula
                                  AND pm.id_curso = $1
                                  AND pm.estado = 'completado')::numeric
                              / NULLIF((SELECT count(*) FROM mundo w WHERE w.id_curso = $1), 0)
                    END
                )
                  FROM matricula m
                 WHERE m.id_curso = $1 AND m.estado = 'activa'
            ), 0) * 100)::integer AS porcentaje_avance,
            (SELECT count(*)::integer FROM envio_ejercicio ee WHERE ee.id_curso = $1) AS total_envios,
            (SELECT count(*)::integer
               FROM evaluacion_ia ev
               JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
              WHERE ee.id_curso = $1) AS total_evaluaciones,
            (SELECT count(DISTINCT (ee.id_matricula, ee.id_ejercicio))::integer
               FROM envio_ejercicio ee
               JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
              WHERE ee.id_curso = $1 AND ev.puntaje >= 70) AS ejercicios_aprobados,
            ${roundFloat(`(SELECT AVG(ev.puntaje)
                 FROM evaluacion_ia ev
                 JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
                WHERE ee.id_curso = $1)`)} AS promedio_puntaje;
    `, [idCurso]);
    return result.rows[0];
};

const getCourseDetail = async (req, res, next) => {
    try {
        const { id_curso } = req.params;
        await getAuthorizedCourse(id_curso, req.user);

        const courseResult = await query(`
            SELECT c.id_curso, c.nombre, c.codigo_curso, c.periodo, c.estado, c.id_docente,
                   c.id_institucion, i.nombre AS institucion_nombre,
                   concat_ws(' ', u.nombre, u.apellido) AS docente_nombre,
                   u.email AS docente_email
              FROM curso c
              JOIN usuario u ON u.id_usuario = c.id_docente
              JOIN institucion i ON i.id_institucion = c.id_institucion
             WHERE c.id_curso = $1
             LIMIT 1;
        `, [id_curso]);
        if (courseResult.rowCount === 0) throw httpError(404, 'Curso no encontrado.', 'COURSE_NOT_FOUND');

        const [resumen, mundos, estudiantes, categorias, salas] = await Promise.all([
            summaryForCourse(id_curso),
            query(`
                SELECT w.id_mundo, w.orden, w.nombre,
                       (SELECT count(*)::integer FROM ejercicio e WHERE e.id_mundo = w.id_mundo) AS total_ejercicios,
                       (SELECT count(*)::integer
                          FROM progreso_mundo pm
                          JOIN matricula m ON m.id_matricula = pm.id_matricula AND m.estado = 'activa'
                         WHERE pm.id_mundo = w.id_mundo AND pm.estado = 'completado') AS estudiantes_completados,
                       (SELECT count(*)::integer FROM matricula m
                         WHERE m.id_curso = $1 AND m.estado = 'activa') AS total_estudiantes,
                       (SELECT count(*)::integer
                          FROM envio_ejercicio ee
                          JOIN ejercicio e ON e.id_ejercicio = ee.id_ejercicio
                         WHERE e.id_mundo = w.id_mundo) AS total_envios,
                       (SELECT count(DISTINCT (ee.id_matricula, ee.id_ejercicio))::integer
                          FROM envio_ejercicio ee
                          JOIN ejercicio e ON e.id_ejercicio = ee.id_ejercicio
                          JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                         WHERE e.id_mundo = w.id_mundo AND ev.puntaje >= 70) AS ejercicios_aprobados,
                       ${roundFloat(`(SELECT AVG(ev.puntaje)
                            FROM evaluacion_ia ev
                            JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
                            JOIN ejercicio e ON e.id_ejercicio = ee.id_ejercicio
                           WHERE e.id_mundo = w.id_mundo)`)} AS promedio_puntaje
                  FROM mundo w
                 WHERE w.id_curso = $1
                 ORDER BY w.orden ASC;
            `, [id_curso]),
            query(`
                SELECT m.id_matricula, m.id_estudiante, m.estado, m.fecha_matricula,
                       u.nombre, u.apellido, u.email,
                       COALESCE((SELECT sum(xp.cantidad)::integer FROM xp_movimiento xp
                                  WHERE xp.id_estudiante = u.id_usuario AND xp.id_curso = $1), 0) AS xp_en_curso,
                       (SELECT count(*)::integer FROM progreso_mundo pm
                         WHERE pm.id_matricula = m.id_matricula AND pm.estado = 'completado') AS mundos_completados,
                       (SELECT count(*)::integer FROM mundo w WHERE w.id_curso = $1) AS total_mundos,
                       (SELECT count(DISTINCT ee.id_ejercicio)::integer
                          FROM envio_ejercicio ee
                          JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                         WHERE ee.id_matricula = m.id_matricula AND ev.puntaje >= 70) AS ejercicios_aprobados,
                       (SELECT count(*)::integer FROM ejercicio e WHERE e.id_curso = $1) AS total_ejercicios,
                       ${roundFloat(`(SELECT AVG(ev.puntaje)
                            FROM evaluacion_ia ev
                            JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
                           WHERE ee.id_matricula = m.id_matricula)`)} AS promedio_puntaje,
                       (SELECT max(ee.fecha_envio) FROM envio_ejercicio ee
                         WHERE ee.id_matricula = m.id_matricula) AS ultima_actividad
                  FROM matricula m
                  JOIN usuario u ON u.id_usuario = m.id_estudiante
                 WHERE m.id_curso = $1 AND m.estado = 'activa'
                 ORDER BY u.apellido ASC, u.nombre ASC;
            `, [id_curso]),
            query(`
                SELECT COALESCE(ev.categoria_error, 'sin_categoria') AS categoria,
                       count(*)::integer AS total
                  FROM evaluacion_ia ev
                  JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
                 WHERE ee.id_curso = $1
                 GROUP BY COALESCE(ev.categoria_error, 'sin_categoria')
                 ORDER BY total DESC, categoria ASC;
            `, [id_curso]),
            query(`
                SELECT s.id_sala, trim(s.pin_sala) AS pin, s.estado,
                       s.fecha_creacion, s.fecha_inicio, s.fecha_fin,
                       (SELECT count(*)::integer FROM participante_sala ps
                         WHERE ps.id_sala = s.id_sala) AS participantes,
                       (SELECT max(ps.puntaje_final) FROM participante_sala ps
                         WHERE ps.id_sala = s.id_sala) AS max_puntaje
                  FROM sala_multijugador s
                 WHERE s.id_curso = $1
                 ORDER BY s.fecha_creacion DESC
                 LIMIT 20;
            `, [id_curso])
        ]);

        return res.json({
            success: true,
            data: {
                curso: courseResult.rows[0],
                resumen,
                mundos: mundos.rows,
                estudiantes: estudiantes.rows,
                categorias_error: categorias.rows,
                salas: salas.rows
            }
        });
    } catch (error) {
        return next(error);
    }
};

const getStudentDetail = async (req, res, next) => {
    try {
        const { id_curso, id_estudiante } = req.params;
        if (!isUuid(id_estudiante)) throw httpError(400, 'id_estudiante debe ser un UUID válido.', 'INVALID_STUDENT_ID');
        await getAuthorizedCourse(id_curso, req.user);

        const enrollment = await query(`
            SELECT m.id_matricula, m.estado, m.fecha_matricula,
                   u.id_usuario, u.nombre, u.apellido, u.email
              FROM matricula m
              JOIN usuario u ON u.id_usuario = m.id_estudiante
             WHERE m.id_curso = $1 AND m.id_estudiante = $2 AND m.estado = 'activa'
             LIMIT 1;
        `, [id_curso, id_estudiante]);
        if (enrollment.rowCount === 0) {
            throw httpError(404, 'El estudiante no está matriculado en este curso.', 'STUDENT_NOT_ENROLLED');
        }
        const matricula = enrollment.rows[0];

        const [resumen, mundos, envios] = await Promise.all([
            query(`
                SELECT
                    (SELECT count(*)::integer FROM mundo w WHERE w.id_curso = $1) AS total_mundos,
                    (SELECT count(*)::integer FROM progreso_mundo pm
                      WHERE pm.id_matricula = $2 AND pm.estado = 'completado') AS mundos_completados,
                    (SELECT count(*)::integer FROM ejercicio e WHERE e.id_curso = $1) AS total_ejercicios,
                    (SELECT count(DISTINCT ee.id_ejercicio)::integer
                       FROM envio_ejercicio ee
                       JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                      WHERE ee.id_matricula = $2 AND ev.puntaje >= 70) AS ejercicios_aprobados,
                    COALESCE((SELECT sum(xp.cantidad)::integer FROM xp_movimiento xp
                               WHERE xp.id_estudiante = $3 AND xp.id_curso = $1), 0) AS xp_en_curso,
                    ${roundFloat(`(SELECT AVG(ev.puntaje)
                         FROM evaluacion_ia ev
                         JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
                        WHERE ee.id_matricula = $2)`)} AS promedio_puntaje;
            `, [id_curso, matricula.id_matricula, id_estudiante]),
            query(`
                SELECT w.id_mundo, w.orden, w.nombre,
                       COALESCE(pm.estado, 'sin_progreso') AS estado,
                       (SELECT count(*)::integer FROM ejercicio e WHERE e.id_mundo = w.id_mundo) AS total_ejercicios,
                       (SELECT count(DISTINCT ee.id_ejercicio)::integer
                          FROM envio_ejercicio ee
                          JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                         WHERE ee.id_matricula = $2 AND ee.id_ejercicio IN
                               (SELECT e.id_ejercicio FROM ejercicio e WHERE e.id_mundo = w.id_mundo)
                           AND ev.puntaje >= 70) AS ejercicios_aprobados,
                       (SELECT count(*)::integer
                          FROM envio_ejercicio ee
                          WHERE ee.id_matricula = $2 AND ee.id_ejercicio IN
                                (SELECT e.id_ejercicio FROM ejercicio e WHERE e.id_mundo = w.id_mundo)) AS total_envios
                  FROM mundo w
                  LEFT JOIN progreso_mundo pm
                    ON pm.id_mundo = w.id_mundo AND pm.id_matricula = $2
                 WHERE w.id_curso = $1
                 ORDER BY w.orden ASC;
            `, [id_curso, matricula.id_matricula]),
            query(`
                SELECT ee.id_envio_ejercicio, ee.fecha_envio, ee.estado_evaluacion,
                       ee.sintaxis_valida, ej.titulo,
                       ev.puntaje, ev.categoria_error, ev.retroalimentacion
                  FROM envio_ejercicio ee
                  JOIN ejercicio ej ON ej.id_ejercicio = ee.id_ejercicio
                  LEFT JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                 WHERE ee.id_curso = $1 AND ee.id_matricula = $2
                 ORDER BY ee.fecha_envio DESC
                 LIMIT 20;
            `, [id_curso, matricula.id_matricula])
        ]);

        return res.json({
            success: true,
            data: {
                estudiante: matricula,
                resumen: resumen.rows[0],
                mundos: mundos.rows,
                envios: envios.rows
            }
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * Perfil demográfico agregado de los estudiantes (solo superadministrador)
 * GET /api/analiticas/demografia?id_institucion=
 */
const getDemographicsSummary = async (req, res, next) => {
    try {
        const institution = req.query.id_institucion || null;
        if (institution !== null && !isUuid(institution)) {
            return next(httpError(400, 'El identificador de la institución no es válido.', 'INVALID_ID'));
        }
        return res.json({ success: true, ...(await getDemographics({ query }, institution)) });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    getDemographicsSummary,
    getCoursesSummary,
    getCourseDetail,
    getStudentDetail
};
