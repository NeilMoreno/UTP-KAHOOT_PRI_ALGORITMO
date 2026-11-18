// ==============================================================
// codeInt - Controlador de Ejercicios PSeInt (/api/ejercicios)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const { query } = require('../config/database');
const { httpError } = require('../utils/httpError');
const { getLanguage, publicLanguage } = require('../config/languages');
const {
    getAuthorizedCourse,
    getAuthorizedWorld,
    getAuthorizedExercise
} = require('../services/authorizationService');

/**
 * Listado de ejercicios pertenecientes a un mundo
 * GET /api/ejercicios/mundo/:id_mundo
 */
const getEjerciciosByMundo = async (req, res, next) => {
    try {
        const { id_mundo } = req.params;
        const user = req.user;
        await getAuthorizedWorld(id_mundo, user, { enforceSequence: true });

        // Validar existencia del mundo
        const mundoRes = await query(`
            SELECT m.id_mundo, m.id_curso, m.orden, m.nombre, m.descripcion,
                   c.id_institucion, c.id_docente
            FROM mundo m
            JOIN curso c ON c.id_curso = m.id_curso
            WHERE m.id_mundo = $1
            LIMIT 1;
        `, [id_mundo]);

        if (mundoRes.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mundo temático no encontrado.'
            });
        }

        const mundo = mundoRes.rows[0];

        // Si el usuario es estudiante, verificar si el mundo está desbloqueado
        if (user.rol === 'estudiante') {
            // Verificar si el estudiante está matriculado
            const matRes = await query(
                'SELECT id_matricula FROM matricula WHERE id_curso = $1 AND id_estudiante = $2 AND estado = \'activa\' LIMIT 1;',
                [mundo.id_curso, user.id_usuario]
            );

            if (matRes.rowCount === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'No estás matriculado en el curso al que pertenece este mundo.'
                });
            }

            const id_matricula = matRes.rows[0].id_matricula;

            // Verificar si el mundo anterior fue completado (si no es el mundo 1)
            if (mundo.orden > 1) {
                const prevMundoSql = `
                    SELECT m.id_mundo,
                           (SELECT count(*) FROM ejercicio e WHERE e.id_mundo = m.id_mundo)::INTEGER AS total_ejercicios,
                           (
                               SELECT count(DISTINCT ee.id_ejercicio)::INTEGER
                               FROM envio_ejercicio ee
                               JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                               JOIN ejercicio ej ON ej.id_ejercicio = ee.id_ejercicio
                               WHERE ej.id_mundo = m.id_mundo
                                 AND ee.id_matricula = $2
                                 AND ev.puntaje >= 70
                           ) AS ejercicios_aprobados
                    FROM mundo m
                    WHERE m.id_curso = $1 AND m.orden = $3
                    LIMIT 1;
                `;
                const prevRes = await query(prevMundoSql, [mundo.id_curso, id_matricula, mundo.orden - 1]);

                if (prevRes.rowCount > 0) {
                    const prevMundo = prevRes.rows[0];
                    const prevCompletado = prevMundo.total_ejercicios > 0 && prevMundo.ejercicios_aprobados >= prevMundo.total_ejercicios;

                    if (!prevCompletado) {
                        return res.status(403).json({
                            success: false,
                            bloqueado: true,
                            message: `Este mundo está bloqueado. Debes completar primero todos los ejercicios del Mundo ${mundo.orden - 1}.`
                        });
                    }
                }
            }

            // Consultar ejercicios adjuntando el último envío y puntaje del estudiante
            const sql = `
                SELECT e.id_ejercicio, e.id_mundo, e.id_curso, e.titulo, e.enunciado,
                       e.plantilla_pseint, e.orden, e.xp_recompensa,
                       ult_envio.id_envio_ejercicio,
                       ult_envio.fecha_envio,
                       ult_envio.sintaxis_valida,
                       ult_envio.estado_evaluacion,
                       ult_eval.puntaje,
                       ult_eval.categoria_error,
                       CASE WHEN ult_eval.puntaje >= 70 THEN true ELSE false END AS aprobado
                FROM ejercicio e
                LEFT JOIN LATERAL (
                    SELECT ee.id_envio_ejercicio, ee.fecha_envio, ee.sintaxis_valida, ee.estado_evaluacion
                    FROM envio_ejercicio ee
                    WHERE ee.id_ejercicio = e.id_ejercicio AND ee.id_matricula = $2
                    ORDER BY ee.fecha_envio DESC
                    LIMIT 1
                ) ult_envio ON true
                LEFT JOIN LATERAL (
                    SELECT ev.puntaje, ev.categoria_error
                    FROM evaluacion_ia ev
                    WHERE ev.id_envio_ejercicio = ult_envio.id_envio_ejercicio
                    LIMIT 1
                ) ult_eval ON true
                WHERE e.id_mundo = $1
                ORDER BY e.orden ASC;
            `;
            const result = await query(sql, [id_mundo, id_matricula]);

            return res.json({
                success: true,
                mundo: {
                    id_mundo: mundo.id_mundo,
                    id_curso: mundo.id_curso,
                    orden: mundo.orden,
                    nombre: mundo.nombre,
                    descripcion: mundo.descripcion
                },
                total: result.rowCount,
                data: result.rows
            });
        } else {
            // Docente / Admin: listado de ejercicios
            const sql = `
                SELECT e.id_ejercicio, e.id_mundo, e.id_curso, e.titulo, e.enunciado,
                       e.plantilla_pseint, e.orden, e.xp_recompensa,
                       (SELECT count(*) FROM envio_ejercicio ee WHERE ee.id_ejercicio = e.id_ejercicio)::INTEGER AS total_envios
                FROM ejercicio e
                WHERE e.id_mundo = $1
                ORDER BY e.orden ASC;
            `;
            const result = await query(sql, [id_mundo]);

            return res.json({
                success: true,
                mundo: {
                    id_mundo: mundo.id_mundo,
                    id_curso: mundo.id_curso,
                    orden: mundo.orden,
                    nombre: mundo.nombre,
                    descripcion: mundo.descripcion
                },
                total: result.rowCount,
                data: result.rows
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Detalle completo de un ejercicio para el editor PSeInt
 * GET /api/ejercicios/:id_ejercicio
 */
const getEjercicioById = async (req, res, next) => {
    try {
        const { id_ejercicio } = req.params;
        const user = req.user;
        const authorizedExercise = await getAuthorizedExercise(id_ejercicio, user);
        await getAuthorizedWorld(authorizedExercise.id_mundo, user, { enforceSequence: true });

        const sql = `
            SELECT e.id_ejercicio, e.id_mundo, e.id_curso, e.titulo, e.enunciado,
                   e.plantilla_pseint, e.orden, e.xp_recompensa,
                   m.nombre AS mundo_nombre, m.orden AS mundo_orden,
                   e.nivel, e.rubrica, e.fuente_silabo,
                   c.nombre AS curso_nombre, c.codigo_curso, c.lenguaje
            FROM ejercicio e
            JOIN mundo m ON m.id_mundo = e.id_mundo
            JOIN curso c ON c.id_curso = e.id_curso
            WHERE e.id_ejercicio = $1
            LIMIT 1;
        `;
        const result = await query(sql, [id_ejercicio]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ejercicio no encontrado.'
            });
        }

        const ejercicio = result.rows[0];
        // Lenguaje del curso con su plantilla base (se usa si el ejercicio no trae una propia).
        ejercicio.lenguaje = publicLanguage(ejercicio.lenguaje);

        // Si es estudiante, obtener su último envío y evaluación
        if (user.rol === 'estudiante') {
            const envioSql = `
                SELECT ee.id_envio_ejercicio, ee.codigo_pseint, ee.sintaxis_valida,
                       ee.mensaje_sintaxis, ee.estado_evaluacion, ee.fecha_envio,
                       ev.puntaje, ev.retroalimentacion, ev.categoria_error,
                       ev.sugerencias, ev.eficiencia_algoritmica,
                       ev.codigo_sugerido_mejora, ev.modelo_ia
                FROM envio_ejercicio ee
                LEFT JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                WHERE ee.id_ejercicio = $1 AND ee.id_estudiante = $2
                ORDER BY ee.fecha_envio DESC
                LIMIT 1;
            `;
            const envioRes = await query(envioSql, [id_ejercicio, user.id_usuario]);
            ejercicio.ultimo_envio = envioRes.rows[0] || null;
        }

        return res.json({
            success: true,
            data: ejercicio
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Crear un nuevo ejercicio en un mundo (Docentes y Administradores)
 * POST /api/ejercicios
 */
const createEjercicio = async (req, res, next) => {
    try {
        const { id_mundo, titulo, enunciado, plantilla_pseint, orden, xp_recompensa = 50 } = req.body;

        if (!id_mundo || !titulo || !enunciado || !orden) {
            return res.status(400).json({
                success: false,
                message: 'Los campos id_mundo, titulo, enunciado y orden son obligatorios.'
            });
        }

        // Obtener id_curso a partir del mundo
        const mundoRes = await query('SELECT m.id_curso, c.lenguaje FROM mundo m JOIN curso c ON c.id_curso = m.id_curso WHERE m.id_mundo = $1 LIMIT 1;', [id_mundo]);
        if (mundoRes.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Mundo no encontrado.' });
        }
        const id_curso = mundoRes.rows[0].id_curso;
        await getAuthorizedCourse(id_curso, req.user, { write: true });

        const ordenNumerico = parseInt(orden, 10);
        const xpNumerico = parseInt(xp_recompensa, 10);
        if (!Number.isInteger(ordenNumerico) || ordenNumerico < 1) {
            throw httpError(400, 'El orden del ejercicio debe ser un entero mayor que cero.', 'INVALID_EXERCISE_ORDER');
        }
        if (!Number.isInteger(xpNumerico) || xpNumerico < 0 || xpNumerico > 1000) {
            throw httpError(400, 'La recompensa de XP debe estar entre 0 y 1000.', 'INVALID_EXERCISE_XP');
        }

        const duplicated = await query(
            'SELECT 1 FROM ejercicio WHERE id_mundo = $1 AND orden = $2 LIMIT 1;',
            [id_mundo, ordenNumerico]
        );
        if (duplicated.rowCount > 0) {
            throw httpError(409, `Ya existe un ejercicio con el orden ${ordenNumerico} en este mundo.`, 'EXERCISE_ORDER_CONFLICT');
        }

        const insertSql = `
            INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id_ejercicio, id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa;
        `;
        const result = await query(insertSql, [
            id_mundo,
            id_curso,
            titulo.trim(),
            enunciado.trim(),
            plantilla_pseint || getLanguage(mundoRes.rows[0].lenguaje).plantilla,
            ordenNumerico,
            xpNumerico
        ]);

        return res.status(201).json({
            success: true,
            message: 'Ejercicio creado exitosamente.',
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar un ejercicio
 * PUT /api/ejercicios/:id_ejercicio
 */
const updateEjercicio = async (req, res, next) => {
    try {
        const { id_ejercicio } = req.params;
        const exercise = await getAuthorizedExercise(id_ejercicio, req.user, { write: true });
        const { titulo, enunciado, plantilla_pseint, orden, xp_recompensa } = req.body;

        const ordenNumerico = orden !== undefined && orden !== null && orden !== '' ? parseInt(orden, 10) : null;
        const xpNumerico = xp_recompensa !== undefined && xp_recompensa !== null && xp_recompensa !== '' ? parseInt(xp_recompensa, 10) : null;

        if (ordenNumerico !== null && (!Number.isInteger(ordenNumerico) || ordenNumerico < 1)) {
            throw httpError(400, 'El orden del ejercicio debe ser un entero mayor que cero.', 'INVALID_EXERCISE_ORDER');
        }
        if (xpNumerico !== null && (!Number.isInteger(xpNumerico) || xpNumerico < 0 || xpNumerico > 1000)) {
            throw httpError(400, 'La recompensa de XP debe estar entre 0 y 1000.', 'INVALID_EXERCISE_XP');
        }

        if (ordenNumerico !== null) {
            const duplicated = await query(
                'SELECT 1 FROM ejercicio WHERE id_mundo = $1 AND orden = $2 AND id_ejercicio <> $3 LIMIT 1;',
                [exercise.id_mundo, ordenNumerico, id_ejercicio]
            );
            if (duplicated.rowCount > 0) {
                throw httpError(409, `Ya existe un ejercicio con el orden ${ordenNumerico} en este mundo.`, 'EXERCISE_ORDER_CONFLICT');
            }
        }

        const updateSql = `
            UPDATE ejercicio
            SET titulo = COALESCE($1, titulo),
                enunciado = COALESCE($2, enunciado),
                plantilla_pseint = COALESCE($3, plantilla_pseint),
                orden = COALESCE($4, orden),
                xp_recompensa = COALESCE($5, xp_recompensa)
            WHERE id_ejercicio = $6
            RETURNING id_ejercicio, id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa;
        `;
        const result = await query(updateSql, [
            titulo ? titulo.trim() : null,
            enunciado ? enunciado.trim() : null,
            plantilla_pseint !== undefined ? plantilla_pseint : null,
            ordenNumerico,
            xpNumerico,
            id_ejercicio
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Ejercicio no encontrado.' });
        }

        return res.json({
            success: true,
            message: 'Ejercicio actualizado exitosamente.',
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Consulta del historial de entregas de un estudiante para un ejercicio
 * GET /api/ejercicios/:id_ejercicio/historial
 */
const getHistorialEnvios = async (req, res, next) => {
    try {
        const { id_ejercicio } = req.params;
        const user = req.user;
        const exercise = await getAuthorizedExercise(id_ejercicio, user);

        const estudianteId = user.rol === 'estudiante' ? user.id_usuario : (req.query.id_estudiante || user.id_usuario);

        if (user.rol !== 'estudiante') {
            const enrollment = await query(
                `SELECT 1 FROM matricula
                 WHERE id_curso = $1 AND id_estudiante = $2 AND estado = 'activa';`,
                [exercise.id_curso, estudianteId]
            );
            if (enrollment.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'El estudiante no está matriculado en este curso.'
                });
            }
        }

        const sql = `
            SELECT ee.id_envio_ejercicio, ee.codigo_pseint, ee.sintaxis_valida,
                   ee.mensaje_sintaxis, ee.estado_evaluacion, ee.fecha_envio,
                   ev.id_evaluacion, ev.puntaje, ev.retroalimentacion, ev.categoria_error,
                   ev.sugerencias, ev.eficiencia_algoritmica, ev.codigo_sugerido_mejora,
                   ev.modelo_ia, ev.fecha_evaluacion
            FROM envio_ejercicio ee
            LEFT JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
            WHERE ee.id_ejercicio = $1 AND ee.id_estudiante = $2
            ORDER BY ee.fecha_envio DESC;
        `;
        const result = await query(sql, [id_ejercicio, estudianteId]);

        return res.json({
            success: true,
            total: result.rowCount,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getEjerciciosByMundo,
    getEjercicioById,
    createEjercicio,
    updateEjercicio,
    getHistorialEnvios
};
