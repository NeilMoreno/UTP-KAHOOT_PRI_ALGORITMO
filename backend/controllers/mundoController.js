// ==============================================================
// codeInt - Controlador de Mundos Temáticos (/api/mundos)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const { query } = require('../config/database');
const { getAuthorizedCourse, getAuthorizedWorld } = require('../services/authorizationService');

/**
 * Listado de los mundos de un curso con su estado de desbloqueo dinámico
 * GET /api/mundos/curso/:id_curso
 */
const getMundosByCurso = async (req, res, next) => {
    try {
        const { id_curso } = req.params;
        const user = req.user;
        await getAuthorizedCourse(id_curso, user);

        // Validar existencia del curso
        const cursoRes = await query('SELECT id_curso, nombre, codigo_curso FROM curso WHERE id_curso = $1;', [id_curso]);
        if (cursoRes.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado.'
            });
        }

        if (user.rol === 'estudiante') {
            // Obtener matrícula activa del estudiante
            const matRes = await query(
                'SELECT id_matricula FROM matricula WHERE id_curso = $1 AND id_estudiante = $2 AND estado = \'activa\' LIMIT 1;',
                [id_curso, user.id_usuario]
            );

            if (matRes.rowCount === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'No estás matriculado en este curso.'
                });
            }

            const id_matricula = matRes.rows[0].id_matricula;

            // Consultar mundos y el estado registrado en progreso_mundo
            const sql = `
                SELECT m.id_mundo, m.id_curso, m.orden, m.nombre, m.descripcion, m.tipo_origen,
                       COALESCE(pm.estado, 'bloqueado') AS estado_db,
                       pm.fecha_inicio, pm.fecha_completado,
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
                LEFT JOIN progreso_mundo pm ON pm.id_mundo = m.id_mundo AND pm.id_matricula = $2
                WHERE m.id_curso = $1
                ORDER BY m.orden ASC;
            `;
            const result = await query(sql, [id_curso, id_matricula]);
            const mundos = result.rows;

            // Regla de Negocio 3: Cálculo dinámico de desbloqueo secuencial
            // Un mundo N (N > 1) está desbloqueado si el mundo N - 1 fue completado
            let mundoAnteriorCompletado = true; // El mundo 1 siempre está disponible inicialmente

            const mundosConEstado = mundos.map((m, index) => {
                let estadoCalculado = 'bloqueado';

                if (index === 0) {
                    // Mundo 1
                    estadoCalculado = (m.total_ejercicios > 0 && m.ejercicios_aprobados >= m.total_ejercicios)
                        ? 'completado'
                        : 'en_progreso';
                } else {
                    if (mundoAnteriorCompletado) {
                        estadoCalculado = (m.total_ejercicios > 0 && m.ejercicios_aprobados >= m.total_ejercicios)
                            ? 'completado'
                            : 'en_progreso';
                    } else {
                        estadoCalculado = 'bloqueado';
                    }
                }

                // Si este mundo está completado, habilita el siguiente
                mundoAnteriorCompletado = (estadoCalculado === 'completado');

                return {
                    ...m,
                    estado: estadoCalculado,
                    desbloqueado: estadoCalculado !== 'bloqueado',
                    porcentaje_completado: m.total_ejercicios > 0
                        ? Math.round((m.ejercicios_aprobados / m.total_ejercicios) * 100)
                        : 0
                };
            });

            return res.json({
                success: true,
                curso: cursoRes.rows[0],
                data: mundosConEstado
            });
        } else {
            // Docente o Superadmin: vista completa de mundos
            const sql = `
                SELECT m.id_mundo, m.id_curso, m.orden, m.nombre, m.descripcion, m.tipo_origen,
                       (SELECT count(*) FROM ejercicio e WHERE e.id_mundo = m.id_mundo)::INTEGER AS total_ejercicios,
                       (
                           SELECT count(DISTINCT pm.id_matricula)::INTEGER
                           FROM progreso_mundo pm
                           WHERE pm.id_mundo = m.id_mundo AND pm.estado = 'completado'
                       ) AS estudiantes_que_completaron
                FROM mundo m
                WHERE m.id_curso = $1
                ORDER BY m.orden ASC;
            `;
            const result = await query(sql, [id_curso]);

            return res.json({
                success: true,
                curso: cursoRes.rows[0],
                data: result.rows.map(m => ({
                    ...m,
                    desbloqueado: true,
                    estado: 'activo'
                }))
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Detalle de un mundo temático
 * GET /api/mundos/:id_mundo
 */
const getMundoById = async (req, res, next) => {
    try {
        const { id_mundo } = req.params;
        await getAuthorizedWorld(id_mundo, req.user);

        const sql = `
            SELECT m.id_mundo, m.id_curso, m.orden, m.nombre, m.descripcion, m.tipo_origen,
                   c.nombre AS curso_nombre, c.codigo_curso,
                   (SELECT count(*) FROM ejercicio e WHERE e.id_mundo = m.id_mundo)::INTEGER AS total_ejercicios
            FROM mundo m
            JOIN curso c ON c.id_curso = m.id_curso
            WHERE m.id_mundo = $1
            LIMIT 1;
        `;
        const result = await query(sql, [id_mundo]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mundo no encontrado.'
            });
        }

        return res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getMundosByCurso,
    getMundoById
};
