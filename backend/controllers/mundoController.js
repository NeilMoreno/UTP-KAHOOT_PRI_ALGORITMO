// ==============================================================
// codeInt - Controlador de Mundos Temáticos (/api/mundos)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const { getValidatedWorlds } = require('../services/diagnosticService');
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
        const cursoRes = await query('SELECT id_curso, nombre, codigo_curso, lenguaje FROM curso WHERE id_curso = $1;', [id_curso]);
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
            const convalidados = await getValidatedWorlds(id_curso, user.id_usuario);

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

                // Convalidado por el diagnóstico: cuenta como superado para habilitar el siguiente.
                const convalidado = index < convalidados;
                mundoAnteriorCompletado = (estadoCalculado === 'completado') || convalidado;

                return {
                    ...m,
                    estado: estadoCalculado,
                    convalidado,
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
 * Primer ejercicio sin aprobar del curso, en el orden de los mundos.
 * Como los mundos se desbloquean en secuencia, ese ejercicio siempre está disponible.
 * GET /api/mundos/curso/:id_curso/siguiente  (solo estudiantes)
 */
const getSiguienteEjercicio = async (req, res, next) => {
    try {
        const { id_curso } = req.params;
        const user = req.user;
        if (user.rol !== 'estudiante') {
            return res.status(403).json({ success: false, message: 'Solo los estudiantes tienen una ruta de ejercicios.' });
        }
        await getAuthorizedCourse(id_curso, user);

        const matRes = await query(
            'SELECT id_matricula FROM matricula WHERE id_curso = $1 AND id_estudiante = $2 AND estado = \'activa\' LIMIT 1;',
            [id_curso, user.id_usuario]
        );
        if (matRes.rowCount === 0) {
            return res.status(403).json({ success: false, message: 'No estás matriculado en este curso.' });
        }

        const skipped = await getValidatedWorlds(id_curso, user.id_usuario);
        const result = await query(`
            SELECT ej.id_ejercicio, ej.titulo, ej.orden AS orden_ejercicio,
                   m.id_mundo, m.nombre AS mundo_nombre, m.orden AS orden_mundo,
                   (SELECT count(*) FROM ejercicio x WHERE x.id_mundo = m.id_mundo)::INTEGER AS total_en_mundo
              FROM ejercicio ej
              JOIN mundo m ON m.id_mundo = ej.id_mundo
             WHERE m.id_curso = $1
               AND m.orden > $3
               AND NOT EXISTS (
                   SELECT 1
                     FROM envio_ejercicio ee
                     JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                    WHERE ee.id_ejercicio = ej.id_ejercicio
                      AND ee.id_matricula = $2
                      AND ev.puntaje >= 70
               )
             ORDER BY m.orden ASC, ej.orden ASC
             LIMIT 1;
        `, [id_curso, matRes.rows[0].id_matricula, skipped]);

        // data = null cuando ya aprobó todos los ejercicios del curso
        return res.json({ success: true, data: result.rows[0] || null });
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
            SELECT m.id_mundo, m.id_curso, m.orden, m.nombre, m.descripcion, m.tipo_origen, m.leccion,
                   c.nombre AS curso_nombre, c.codigo_curso, c.lenguaje,
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
    getSiguienteEjercicio,
    getMundoById
};
