'use strict';

const { randomUUID } = require('crypto');
const { query, getClient } = require('../config/database');
const { getAuthorizedExercise, getAuthorizedWorld } = require('../services/authorizationService');
const { sanitizeSignals, findMostSimilar, assessRisk } = require('../services/integrityService');
const { DEFAULT_MAX_CODE_LENGTH } = require('../services/pseintValidator');
const { getLanguage } = require('../config/languages');
const { readAnswer, gradeLocal } = require('../services/exerciseTypes');
const { evaluatePseIntWithGemini } = require('../services/geminiService');
const { unlockAchievements } = require('../services/achievementService');
const { getEstudianteGamificationSummary } = require('../services/gamificationService');
const { httpError } = require('../utils/httpError');
const { isUuid } = require('../utils/validation');

const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Un envío sin terminar pasado este tiempo se considera abandonado (p. ej. el
// servidor se reinició a mitad de la evaluación). Siempre supera el timeout de Gemini.
const getStaleSubmissionMs = () =>
    parsePositiveInteger(process.env.GEMINI_TIMEOUT_MS, 30000) + 120000;

// Marca el envío como fallido y libera la reserva de tokens que haya quedado abierta.
const failStaleSubmission = async (idSubmission, operationId) => {
    const failed = await query(`
        UPDATE envio_ejercicio
           SET estado_evaluacion = 'fallido'
         WHERE id_envio_ejercicio = $1
           AND estado_evaluacion IN ('pendiente', 'procesando')
        RETURNING id_envio_ejercicio;
    `, [idSubmission]);
    if (failed.rowCount === 0) return false;
    await query(`
        SELECT confirmar_uso_ia(id_operacion, 0, false)
          FROM uso_ia
         WHERE id_operacion = $1
           AND estado_consumo = 'reservado';
    `, [operationId]);
    return true;
};

const getCode = (body) => {
    if (!body || typeof body.codigo_pseint !== 'string') {
        throw httpError(400, 'Debe enviar codigo_pseint como texto.', 'PSEINT_CODE_REQUIRED');
    }
    return body.codigo_pseint.replace(/\r\n?/g, '\n');
};

const getOperationId = (req) => {
    const headerValue = req.get('Idempotency-Key');
    const bodyValue = req.body?.id_operacion;
    if (headerValue && bodyValue && headerValue !== bodyValue) {
        throw httpError(400, 'El identificador de operación del encabezado y del cuerpo no coincide.', 'IDEMPOTENCY_KEY_MISMATCH');
    }
    const operationId = headerValue || bodyValue || randomUUID();
    if (!isUuid(operationId)) {
        throw httpError(400, 'Idempotency-Key debe ser un UUID válido.', 'INVALID_IDEMPOTENCY_KEY');
    }
    return operationId;
};

const getExerciseContext = async (idExercise, user) => {
    const authorized = await getAuthorizedExercise(idExercise, user);
    await getAuthorizedWorld(authorized.id_mundo, user, { enforceSequence: true });
    const result = await query(`
        SELECT e.id_ejercicio, e.id_mundo, e.id_curso, e.titulo, e.enunciado,
               e.rubrica, e.fuente_silabo, e.nivel, e.tipo, e.solucion,
               e.xp_recompensa, m.orden AS mundo_orden,
               c.id_docente, c.id_institucion, c.lenguaje
          FROM ejercicio e
          JOIN mundo m ON m.id_mundo = e.id_mundo
          JOIN curso c ON c.id_curso = e.id_curso
         WHERE e.id_ejercicio = $1
         LIMIT 1;
    `, [idExercise]);
    return result.rows[0];
};

const getActiveEnrollment = async (idCourse, idStudent) => {
    const result = await query(`
        SELECT id_matricula
          FROM matricula
         WHERE id_curso = $1
           AND id_estudiante = $2
           AND estado = 'activa'
         LIMIT 1;
    `, [idCourse, idStudent]);
    if (result.rowCount === 0) {
        throw httpError(403, 'No existe una matrícula activa para este curso.', 'ACTIVE_ENROLLMENT_REQUIRED');
    }
    return result.rows[0];
};

const getSubmission = async (idSubmission, db = { query }) => {
    const result = await db.query(`
        SELECT ee.id_envio_ejercicio, ee.id_operacion, ee.id_ejercicio,
               ee.codigo_pseint, ee.sintaxis_valida, ee.mensaje_sintaxis,
               ee.estado_evaluacion, ee.fecha_envio,
               ev.id_evaluacion, ev.puntaje, ev.retroalimentacion,
               ev.categoria_error, ev.sugerencias, ev.eficiencia_algoritmica,
               ev.codigo_sugerido_mejora, ev.modelo_ia, ev.fecha_evaluacion,
               ev.defensa, ev.defensa_en, ev.defensa_correcta,
               COALESCE(xm.cantidad, 0)::integer AS xp_ganada
          FROM envio_ejercicio ee
          LEFT JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
          LEFT JOIN xp_movimiento xm ON xm.id_evaluacion = ev.id_evaluacion
         WHERE ee.id_envio_ejercicio = $1
         LIMIT 1;
    `, [idSubmission]);
    const row = result.rows[0] || null;
    if (row) {
        // La pregunta pendiente sale SIN la respuesta correcta.
        row.defensa_pendiente = row.defensa && !row.defensa_en ? { pregunta: row.defensa.pregunta, opciones: row.defensa.opciones } : null;
        delete row.defensa;
    }
    return row;
};

const respondExistingSubmission = async (res, submission) => {
    const unfinished = submission.estado_evaluacion === 'procesando' || submission.estado_evaluacion === 'pendiente';
    if (unfinished && Number(submission.edad_ms) > getStaleSubmissionMs()
        && await failStaleSubmission(submission.id_envio_ejercicio, submission.id_operacion)) {
        submission = { ...submission, estado_evaluacion: 'fallido' };
    }
    const data = await getSubmission(submission.id_envio_ejercicio);
    if (submission.estado_evaluacion === 'procesando' || submission.estado_evaluacion === 'pendiente') {
        return res.status(202).json({
            success: true,
            message: 'La evaluación ya está en proceso.',
            data
        });
    }
    if (submission.estado_evaluacion === 'rechazado_local') {
        return res.status(422).json({
            success: false,
            message: 'El código no superó la validación estructural local.',
            data
        });
    }
    if (submission.estado_evaluacion === 'fallido') {
        return res.status(409).json({
            success: false,
            message: 'Esta operación falló. Envíe nuevamente usando otro Idempotency-Key.',
            data
        });
    }
    return res.json({
        success: true,
        message: 'La operación ya había sido completada; no se consumieron tokens nuevamente.',
        data
    });
};

const validateCode = async (req, res, next) => {
    try {
        const exercise = await getExerciseContext(req.params.id_ejercicio, req.user);
        await getActiveEnrollment(exercise.id_curso, req.user.id_usuario);
        // Predecir, completar y ordenar no son código: no hay sintaxis que revisar.
        if (exercise.tipo !== 'escribir' && exercise.tipo !== 'corregir') {
            return res.json({ success: true, valido: true, consume_tokens_ia: false, validacion: { valid: true, errors: [], warnings: [], summary: 'No aplica.' } });
        }
        const code = getCode(req.body);
        const validation = getLanguage(exercise.lenguaje).validate(code, { maxLength: DEFAULT_MAX_CODE_LENGTH });
        return res.json({
            success: true,
            valido: validation.valid,
            consume_tokens_ia: false,
            validacion: validation
        });
    } catch (error) {
        next(error);
    }
};

const submitAndEvaluate = async (req, res, next) => {
    let operationId;
    let submissionId;
    let reservationCreated = false;
    try {
        operationId = getOperationId(req);
        const exercise = await getExerciseContext(req.params.id_ejercicio, req.user);
        const enrollment = await getActiveEnrollment(exercise.id_curso, req.user.id_usuario);
        // Tipos con corrección local (sin IA ni cuota): predecir, completar, ordenar y corregir.
        const local = exercise.tipo !== 'escribir';
        const isCode = !local || exercise.tipo === 'corregir';
        const code = isCode ? getCode(req.body) : readAnswer(exercise.tipo, req.body);
        const validation = isCode
            ? getLanguage(exercise.lenguaje).validate(code, { maxLength: DEFAULT_MAX_CODE_LENGTH })
            : { valid: true, errors: [], warnings: [], summary: 'No aplica.' };
        const validationMessage = JSON.stringify({
            resumen: validation.summary,
            errores: validation.errors,
            advertencias: validation.warnings
        });

        // Integridad académica: señales del navegador + similitud con otros estudiantes. Es evidencia para el
        // docente; nunca bloquea el envío y un fallo aquí no debe impedir que el estudiante entregue.
        const signals = isCode ? sanitizeSignals(req.body?.senales) : null;
        const templateRow = isCode
            ? await query('SELECT plantilla_pseint FROM ejercicio WHERE id_ejercicio = $1;', [exercise.id_ejercicio]).catch(() => ({ rows: [] }))
            : { rows: [] };
        const similar = isCode
            ? await findMostSimilar({
                idEjercicio: exercise.id_ejercicio, idEstudiante: req.user.id_usuario, code,
                language: exercise.lenguaje, template: templateRow.rows[0]?.plantilla_pseint || ''
            }).catch(() => ({ similitud: 0, id_envio_similar: null }))
            : { similitud: 0, id_envio_similar: null };
        const risk = assessRisk({ senales: signals, codeLength: code.length, similitud: similar.similitud });

        const client = await getClient();
        let submission;
        let created = false;
        try {
            await client.query('BEGIN');
            const existing = await client.query(`
                SELECT id_envio_ejercicio, id_operacion, id_estudiante, id_ejercicio,
                       codigo_pseint, estado_evaluacion,
                       (EXTRACT(EPOCH FROM (now() - fecha_envio)) * 1000)::bigint AS edad_ms
                  FROM envio_ejercicio
                 WHERE id_operacion = $1
                 FOR UPDATE;
            `, [operationId]);

            if (existing.rowCount > 0) {
                submission = existing.rows[0];
                if (submission.id_estudiante !== req.user.id_usuario
                    || submission.id_ejercicio !== exercise.id_ejercicio
                    || submission.codigo_pseint !== code) {
                    throw httpError(409, 'El Idempotency-Key ya fue usado con otros datos.', 'IDEMPOTENCY_KEY_REUSED');
                }
            } else {
                const inserted = await client.query(`
                    INSERT INTO envio_ejercicio (
                        id_operacion, id_matricula, id_estudiante, id_ejercicio,
                        id_curso, codigo_pseint, sintaxis_valida,
                        mensaje_sintaxis, estado_evaluacion,
                        senales, riesgo, motivos_riesgo, similitud, id_envio_similar
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::jsonb, $13, $14)
                    RETURNING id_envio_ejercicio, id_estudiante, id_ejercicio,
                              codigo_pseint, estado_evaluacion;
                `, [
                    operationId,
                    enrollment.id_matricula,
                    req.user.id_usuario,
                    exercise.id_ejercicio,
                    exercise.id_curso,
                    code,
                    validation.valid,
                    validationMessage,
                    validation.valid ? 'pendiente' : 'rechazado_local',
                    signals ? JSON.stringify(signals) : null,
                    risk.riesgo,
                    JSON.stringify(risk.motivos),
                    similar.similitud,
                    similar.id_envio_similar
                ]);
                submission = inserted.rows[0];
                created = true;
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }

        submissionId = submission.id_envio_ejercicio;
        if (!created) return respondExistingSubmission(res, submission);

        if (!validation.valid) {
            return res.status(422).json({
                success: false,
                message: 'El código fue guardado, pero no superó la validación estructural local.',
                consume_tokens_ia: false,
                data: await getSubmission(submissionId),
                validacion: validation
            });
        }

        const claimed = await query(`
            UPDATE envio_ejercicio
               SET estado_evaluacion = 'procesando'
             WHERE id_envio_ejercicio = $1
               AND estado_evaluacion = 'pendiente'
            RETURNING id_envio_ejercicio;
        `, [submissionId]);
        if (claimed.rowCount === 0) {
            return respondExistingSubmission(res, await getSubmission(submissionId));
        }

        const reservedTokens = parsePositiveInteger(process.env.GEMINI_TOKEN_RESERVATION, 16000);
        try {
            // La corrección local no usa IA: no reserva ni consume cuota del docente.
            if (!local) {
                await query(
                    `SELECT * FROM reservar_uso_ia($1, $2, 'evaluacion', $3, $4, NULL);`,
                    [exercise.id_docente, operationId, reservedTokens, submissionId]
                );
                reservationCreated = true;
            }
        } catch (error) {
            await query(
                `UPDATE envio_ejercicio SET estado_evaluacion = 'fallido' WHERE id_envio_ejercicio = $1;`,
                [submissionId]
            ).catch(() => {});
            if (error.code === '23514') {
                throw httpError(409, 'El docente no dispone de una cuota de IA vigente o suficiente.', 'AI_QUOTA_UNAVAILABLE');
            }
            throw error;
        }

        const geminiResult = local
            ? {
                evaluation: gradeLocal({ tipo: exercise.tipo, solucion: exercise.solucion, answer: code, language: exercise.lenguaje }),
                integrity: null,
                usage: { prompt_tokens: 0, response_tokens: 0, thinking_tokens: 0, total_tokens: 0 },
                model: 'local',
                response_id: null
            }
            : await evaluatePseIntWithGemini({ exercise, code });
        const evaluation = geminiResult.evaluation;
        const integrity = geminiResult.integrity || { manipulacion: false, motivos: [], puntaje_modelo: null };
        const finalClient = await getClient();
        try {
            await finalClient.query('BEGIN');
            const insertedEvaluation = await finalClient.query(`
                INSERT INTO evaluacion_ia (
                    id_envio_ejercicio, id_estudiante, id_curso, puntaje,
                    retroalimentacion, categoria_error, sugerencias,
                    eficiencia_algoritmica, codigo_sugerido_mejora,
                    modelo_ia, id_respuesta_proveedor,
                    alerta_manipulacion, motivos_alerta, puntaje_modelo, defensa
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13::jsonb, $14, $15::jsonb)
                RETURNING id_evaluacion;
            `, [
                submissionId,
                req.user.id_usuario,
                exercise.id_curso,
                evaluation.puntaje,
                evaluation.retroalimentacion,
                evaluation.categoria_error,
                JSON.stringify(evaluation.sugerencias),
                evaluation.eficiencia_algoritmica,
                evaluation.codigo_sugerido_mejora,
                geminiResult.model,
                geminiResult.response_id,
                integrity.manipulacion,
                JSON.stringify(integrity.motivos),
                integrity.puntaje_modelo,
                // La defensa solo se propone si aprobó y no hubo alerta de manipulación.
                evaluation.pregunta_defensa && evaluation.puntaje >= 70 && !integrity.manipulacion ? JSON.stringify(evaluation.pregunta_defensa) : null
            ]);
            const evaluationId = insertedEvaluation.rows[0].id_evaluacion;

            let xpEarned = 0;
            if (evaluation.puntaje >= 70) {
                const xpResult = await finalClient.query(`
                    INSERT INTO xp_movimiento (
                        id_estudiante, id_curso, id_evaluacion,
                        id_ejercicio, cantidad, origen
                    ) VALUES ($1, $2, $3, $4, $5, 'evaluacion_ia')
                    ON CONFLICT (id_estudiante, id_curso, id_ejercicio)
                        WHERE origen = 'evaluacion_ia'
                    DO NOTHING
                    RETURNING cantidad;
                `, [
                    req.user.id_usuario,
                    exercise.id_curso,
                    evaluationId,
                    exercise.id_ejercicio,
                    exercise.xp_recompensa
                ]);
                xpEarned = xpResult.rows[0]?.cantidad || 0;
            }

            await finalClient.query(`
                INSERT INTO progreso_mundo (
                    id_matricula, id_mundo, id_curso, estado, fecha_inicio
                ) VALUES ($1, $2, $3, 'en_progreso', now())
                ON CONFLICT (id_matricula, id_mundo) DO UPDATE
                   SET estado = CASE
                           WHEN progreso_mundo.estado = 'completado' THEN 'completado'
                           ELSE 'en_progreso'
                       END,
                       fecha_inicio = COALESCE(progreso_mundo.fecha_inicio, now());
            `, [enrollment.id_matricula, exercise.id_mundo, exercise.id_curso]);

            const progress = await finalClient.query(`
                SELECT count(*)::integer AS total,
                       count(*) FILTER (WHERE EXISTS (
                           SELECT 1
                             FROM envio_ejercicio ee
                             JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
                            WHERE ee.id_matricula = $2
                              AND ee.id_ejercicio = e.id_ejercicio
                              AND ev.puntaje >= 70
                       ))::integer AS aprobados
                  FROM ejercicio e
                 WHERE e.id_mundo = $1;
            `, [exercise.id_mundo, enrollment.id_matricula]);
            const worldCompleted = progress.rows[0].total > 0
                && progress.rows[0].aprobados >= progress.rows[0].total;

            if (worldCompleted) {
                await finalClient.query(`
                    UPDATE progreso_mundo
                       SET estado = 'completado', fecha_completado = COALESCE(fecha_completado, now())
                     WHERE id_matricula = $1 AND id_mundo = $2;
                `, [enrollment.id_matricula, exercise.id_mundo]);
                await finalClient.query(`
                    INSERT INTO progreso_mundo (
                        id_matricula, id_mundo, id_curso, estado, fecha_inicio
                    )
                    SELECT $1, siguiente.id_mundo, $2, 'en_progreso', now()
                      FROM mundo siguiente
                     WHERE siguiente.id_curso = $2
                       AND siguiente.orden = $3 + 1
                    ON CONFLICT (id_matricula, id_mundo) DO UPDATE
                       SET estado = CASE
                               WHEN progreso_mundo.estado = 'completado' THEN 'completado'
                               ELSE 'en_progreso'
                           END,
                           fecha_inicio = COALESCE(progreso_mundo.fecha_inicio, now());
                `, [enrollment.id_matricula, exercise.id_curso, exercise.mundo_orden]);
            }

            if (integrity.manipulacion) {
                // Un intento de manipular la nota siempre queda en rojo para la revisión del docente.
                await finalClient.query(`
                    UPDATE envio_ejercicio
                       SET riesgo = 'rojo',
                           motivos_riesgo = CASE WHEN motivos_riesgo ? 'INTENTO_DE_MANIPULACION' THEN motivos_riesgo
                                                 ELSE motivos_riesgo || '"INTENTO_DE_MANIPULACION"'::jsonb END
                     WHERE id_envio_ejercicio = $1;
                `, [submissionId]);
            }

            const logrosDesbloqueados = await unlockAchievements(finalClient, req.user.id_usuario);

            if (!local) {
                await finalClient.query(`
                    UPDATE uso_ia
                       SET proveedor_ia = 'gemini', modelo_ia = $2
                     WHERE id_operacion = $1;
                `, [operationId, geminiResult.model]);
                await finalClient.query(
                    'SELECT * FROM confirmar_uso_ia($1, $2, true);',
                    [operationId, geminiResult.usage.total_tokens]
                );
            }
            await finalClient.query(`
                UPDATE envio_ejercicio
                   SET estado_evaluacion = 'completado'
                 WHERE id_envio_ejercicio = $1;
            `, [submissionId]);
            await finalClient.query('COMMIT');

            const data = await getSubmission(submissionId);
            data.xp_ganada = xpEarned;
            data.mundo_completado = worldCompleted;
            data.uso_tokens = geminiResult.usage;
            data.logros_desbloqueados = logrosDesbloqueados;
            // El resumen es informativo: un fallo aquí no debe invalidar una evaluación ya confirmada.
            data.gamificacion = await getEstudianteGamificationSummary(req.user.id_usuario).catch(() => null);
            return res.status(201).json({
                success: true,
                message: evaluation.puntaje >= 70
                    ? 'Solución evaluada y aprobada.'
                    : 'Solución evaluada; revisa la retroalimentación antes de reintentar.',
                data
            });
        } catch (error) {
            await finalClient.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            finalClient.release();
        }
    } catch (error) {
        if (reservationCreated && operationId) {
            await query('SELECT * FROM confirmar_uso_ia($1, 0, false);', [operationId]).catch(() => {});
        }
        if (submissionId) {
            await query(`
                UPDATE envio_ejercicio
                   SET estado_evaluacion = 'fallido'
                 WHERE id_envio_ejercicio = $1
                   AND estado_evaluacion <> 'completado';
            `, [submissionId]).catch(() => {});
        }
        next(error);
    }
};

/**
 * El estudiante responde la pregunta de defensa de su envío aprobado.
 * POST /api/ejercicios/:id_ejercicio/envios/:id_envio/defensa   { respuesta: 0..3 }
 * Se corrige aquí (la respuesta correcta nunca viaja antes). Una respuesta incorrecta suma una señal de
 * integridad para el docente; no cambia la nota ni da XP.
 */
const answerDefense = async (req, res, next) => {
    try {
        const { id_ejercicio: idEjercicio, id_envio: idEnvio } = req.params;
        if (!isUuid(idEnvio)) throw httpError(400, 'Identificador de envío no válido.', 'INVALID_ID');
        const answer = req.body?.respuesta;
        if (!Number.isInteger(answer) || answer < 0 || answer > 3) {
            throw httpError(400, 'Elige una de las cuatro opciones.', 'INVALID_ANSWER');
        }
        await getAuthorizedExercise(idEjercicio, req.user);

        const found = await query(`
            SELECT ee.id_envio_ejercicio, ee.codigo_pseint, ee.senales, ee.similitud,
                   ev.id_evaluacion, ev.defensa, ev.defensa_en, ev.alerta_manipulacion
              FROM envio_ejercicio ee
              JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
             WHERE ee.id_envio_ejercicio = $1 AND ee.id_ejercicio = $2 AND ee.id_estudiante = $3
             LIMIT 1;
        `, [idEnvio, idEjercicio, req.user.id_usuario]);
        if (found.rowCount === 0) throw httpError(404, 'Envío no encontrado.', 'NOT_FOUND');
        const row = found.rows[0];
        if (!row.defensa) throw httpError(409, 'Este envío no tiene pregunta de defensa.', 'DEFENSE_UNAVAILABLE');
        if (row.defensa_en) throw httpError(409, 'Ya respondiste esta pregunta.', 'DEFENSE_DONE');

        const correct = answer === row.defensa.correcta;
        const saved = await query(`
            UPDATE evaluacion_ia
               SET defensa_respuesta = $2, defensa_correcta = $3, defensa_en = now()
             WHERE id_evaluacion = $1 AND defensa_en IS NULL
            RETURNING id_evaluacion;
        `, [row.id_evaluacion, answer, correct]);
        if (saved.rowCount === 0) throw httpError(409, 'Ya respondiste esta pregunta.', 'DEFENSE_DONE');

        if (!correct) {
            // Suma una señal de integridad: se recalcula el semáforo del envío con lo ya registrado.
            const risk = assessRisk({
                senales: row.senales, codeLength: row.codigo_pseint.length,
                similitud: Number(row.similitud || 0), manipulacion: row.alerta_manipulacion, defensaFallida: true
            });
            await query(`
                UPDATE envio_ejercicio
                   SET riesgo = CASE WHEN $2 = 'rojo' OR riesgo = 'rojo' THEN 'rojo'
                                     WHEN $2 = 'ambar' OR riesgo = 'ambar' THEN 'ambar' ELSE 'verde' END,
                       motivos_riesgo = $3::jsonb
                 WHERE id_envio_ejercicio = $1;
            `, [idEnvio, risk.riesgo, JSON.stringify(risk.motivos)]);
        }
        return res.json({ success: true, data: { correcta: correct, respuesta_correcta: row.defensa.correcta } });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    validateCode,
    submitAndEvaluate,
    answerDefense
};
