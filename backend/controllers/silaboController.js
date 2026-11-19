'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { query, getClient } = require('../config/database');
const { getAuthorizedCourse } = require('../services/authorizationService');
const { getLanguage } = require('../config/languages');
const { generateCourseDraft, validateDraftContent, XP_BY_LEVEL, DraftValidationError } = require('../services/syllabusService');
const { generateLessons } = require('../services/lessonService');
const { recordSecurityEvent, getRequestIp } = require('../services/securityAuditService');
const { httpError } = require('../utils/httpError');
const { isUuid } = require('../utils/validation');

const MAX_BYTES = 10 * 1024 * 1024;
const PDF_SIGNATURE = Buffer.from('%PDF-');

const positiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getSilabo = async (idCurso, idSilabo) => {
    if (!isUuid(idSilabo)) throw httpError(400, 'El identificador del sílabo no es válido.', 'INVALID_ID');
    const result = await query(
        `SELECT id_silabo, id_curso, nombre_archivo, ruta_archivo, estado_procesamiento, mensaje_error, tamano_bytes, fecha_carga
           FROM silabo WHERE id_silabo = $1 AND id_curso = $2;`,
        [idSilabo, idCurso]
    );
    if (result.rowCount === 0) throw httpError(404, 'Sílabo no encontrado en este curso.', 'SYLLABUS_NOT_FOUND');
    return result.rows[0];
};

const publicSilabo = ({ ruta_archivo: _path, ...rest }) => rest;

const getLatestDraft = async (idCurso) => {
    const result = await query(
        `SELECT id_borrador, id_silabo, contenido, estado, modelo_ia, fecha_creacion, fecha_actualizacion
           FROM borrador_curso
          WHERE id_curso = $1 AND estado <> 'descartado'
          ORDER BY fecha_creacion DESC LIMIT 1;`,
        [idCurso]
    );
    return result.rows[0] || null;
};

/**
 * Estado del sílabo más reciente y su borrador
 * GET /api/cursos/:id_curso/silabo
 */
const getEstado = async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user, { write: true });
        const silabo = await query(
            `SELECT id_silabo, nombre_archivo, estado_procesamiento, mensaje_error, tamano_bytes, fecha_carga
               FROM silabo WHERE id_curso = $1 ORDER BY fecha_carga DESC LIMIT 1;`,
            [req.params.id_curso]
        );
        res.json({ success: true, silabo: silabo.rows[0] || null, borrador: await getLatestDraft(req.params.id_curso) });
    } catch (error) {
        next(error);
    }
};

/**
 * Sube el sílabo en PDF
 * POST /api/cursos/:id_curso/silabo   (multipart, campo "file")
 */
const subirSilabo = async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user, { write: true });
        const file = req.file;
        if (!file) throw httpError(400, 'Adjunta el sílabo en formato PDF.', 'FILE_REQUIRED');
        if (file.size > MAX_BYTES) throw httpError(413, 'El PDF no puede superar los 10 MB.', 'FILE_TOO_LARGE');
        // El tipo MIME lo declara el cliente; la firma del contenido es lo que realmente se verifica.
        if (!file.buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
            throw httpError(400, 'El archivo no es un PDF válido.', 'INVALID_FILE_TYPE');
        }

        const idSilabo = crypto.randomUUID();
        // El nombre original solo se guarda como etiqueta; nunca se usa para construir rutas.
        const label = path.basename(String(file.originalname || 'silabo.pdf')).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 200) || 'silabo.pdf';
        const inserted = await query(
            `INSERT INTO silabo (id_silabo, id_curso, nombre_archivo, contenido_pdf, estado_procesamiento, tamano_bytes, sha256)
             VALUES ($1, $2, $3, $4, 'cargado', $5, $6)
             RETURNING id_silabo, nombre_archivo, estado_procesamiento, tamano_bytes, fecha_carga;`,
            [idSilabo, req.params.id_curso, label, file.buffer, file.size, crypto.createHash('sha256').update(file.buffer).digest('hex')]
        );
        res.status(201).json({ success: true, message: 'Sílabo cargado. Ya puedes generar el borrador del curso.', silabo: inserted.rows[0] });
    } catch (error) {
        next(error);
    }
};

/**
 * Genera el borrador con IA (consume cuota del docente del curso)
 * POST /api/cursos/:id_curso/silabo/:id_silabo/generar
 */
const generarBorrador = async (req, res, next) => {
    let operationId = null;
    let reserved = false;
    let idSilabo = null;
    try {
        const course = await getAuthorizedCourse(req.params.id_curso, req.user, { write: true });
        const silabo = await getSilabo(req.params.id_curso, req.params.id_silabo);
        idSilabo = silabo.id_silabo;

        // Un solo procesamiento a la vez por sílabo (evita doble gasto de cuota por doble clic).
        const claimed = await query(
            `UPDATE silabo SET estado_procesamiento = 'procesando', mensaje_error = NULL
              WHERE id_silabo = $1 AND estado_procesamiento <> 'procesando' RETURNING id_silabo;`,
            [idSilabo]
        );
        if (claimed.rowCount === 0) throw httpError(409, 'Este sílabo ya se está procesando.', 'SYLLABUS_BUSY');

        operationId = crypto.randomUUID();
        try {
            await query(
                `SELECT * FROM reservar_uso_ia($1, $2, 'generacion_mundo', $3, NULL, $4);`,
                [course.id_docente, operationId, positiveInt(process.env.GEMINI_SYLLABUS_TOKEN_RESERVATION, 60000), idSilabo]
            );
            reserved = true;
        } catch (error) {
            if (error.code === '23514') {
                throw httpError(409, 'El docente no dispone de una cuota de IA vigente o suficiente.', 'AI_QUOTA_UNAVAILABLE');
            }
            throw error;
        }

        const stored = await query('SELECT contenido_pdf FROM silabo WHERE id_silabo = $1;', [silabo.id_silabo]);
        // Los silabos anteriores a la migracion 019 siguen en disco.
        const pdfBuffer = stored.rows[0]?.contenido_pdf
            || await fs.readFile(path.resolve(__dirname, '../..', silabo.ruta_archivo));
        const courseRow = await query('SELECT nombre, lenguaje FROM curso WHERE id_curso = $1;', [req.params.id_curso]);
        const result = await generateCourseDraft({
            pdfBuffer, courseName: courseRow.rows[0]?.nombre, language: getLanguage(courseRow.rows[0]?.lenguaje)
        });

        const client = await getClient();
        try {
            await client.query('BEGIN');
            await client.query('SELECT * FROM confirmar_uso_ia($1, $2, true);', [operationId, result.usage.total_tokens]);
            reserved = false;
            await client.query(`UPDATE borrador_curso SET estado = 'descartado', fecha_actualizacion = now()
                                 WHERE id_curso = $1 AND estado IN ('generado', 'editado');`, [req.params.id_curso]);
            const draft = await client.query(
                `INSERT INTO borrador_curso (id_silabo, id_curso, contenido, estado, modelo_ia)
                 VALUES ($1, $2, $3::jsonb, 'generado', $4)
                 RETURNING id_borrador, estado, modelo_ia, fecha_creacion;`,
                [idSilabo, req.params.id_curso, JSON.stringify(result.draft), result.model]
            );
            await client.query(`UPDATE silabo SET estado_procesamiento = 'procesado' WHERE id_silabo = $1;`, [idSilabo]);
            await client.query('COMMIT');
            res.status(201).json({
                success: true,
                message: 'Borrador generado. Revísalo antes de publicarlo.',
                borrador: { ...draft.rows[0], contenido: result.draft },
                uso_tokens: result.usage
            });
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        if (reserved) await query('SELECT * FROM confirmar_uso_ia($1, 0, false);', [operationId]).catch(() => {});
        if (idSilabo && error.code !== 'SYLLABUS_BUSY') {
            await query(
                `UPDATE silabo SET estado_procesamiento = CASE WHEN estado_procesamiento = 'procesando' THEN 'error' ELSE estado_procesamiento END,
                        mensaje_error = $2 WHERE id_silabo = $1;`,
                [idSilabo, String(error.message || 'Error de generación').slice(0, 300)]
            ).catch(() => {});
        }
        next(error);
    }
};

/**
 * Borrador vigente  GET /api/cursos/:id_curso/silabo/borrador
 */
const getBorrador = async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user, { write: true });
        const borrador = await getLatestDraft(req.params.id_curso);
        if (!borrador) throw httpError(404, 'Este curso aún no tiene un borrador.', 'DRAFT_NOT_FOUND');
        res.json({ success: true, borrador });
    } catch (error) {
        next(error);
    }
};

/**
 * El docente edita el borrador  PUT /api/cursos/:id_curso/silabo/borrador
 */
const actualizarBorrador = async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user, { write: true });
        const current = await getLatestDraft(req.params.id_curso);
        if (!current || !['generado', 'editado'].includes(current.estado)) {
            throw httpError(409, 'No hay un borrador editable. Genera uno nuevo.', 'DRAFT_NOT_EDITABLE');
        }
        const content = validateDraftContent(req.body?.contenido);
        const updated = await query(
            `UPDATE borrador_curso SET contenido = $1::jsonb, estado = 'editado', fecha_actualizacion = now()
              WHERE id_borrador = $2
              RETURNING id_borrador, estado, fecha_actualizacion;`,
            [JSON.stringify(content), current.id_borrador]
        );
        res.json({ success: true, message: 'Borrador guardado.', borrador: { ...updated.rows[0], contenido: content } });
    } catch (error) {
        next(error instanceof DraftValidationError ? httpError(400, error.message, 'INVALID_DRAFT') : error);
    }
};

/**
 * Publica el borrador: crea los mundos y ejercicios reales
 * POST /api/cursos/:id_curso/silabo/borrador/publicar
 */
const publicarBorrador = async (req, res, next) => {
    let client = null;
    try {
        const course = await getAuthorizedCourse(req.params.id_curso, req.user, { write: true });
        client = await getClient();
        await client.query('BEGIN');

        const draftResult = await client.query(
            `SELECT id_borrador, id_silabo, contenido, estado FROM borrador_curso
              WHERE id_curso = $1 AND estado IN ('generado', 'editado')
              ORDER BY fecha_creacion DESC LIMIT 1 FOR UPDATE;`,
            [req.params.id_curso]
        );
        if (draftResult.rowCount === 0) throw httpError(409, 'No hay un borrador por publicar.', 'DRAFT_NOT_FOUND');
        const draft = draftResult.rows[0];
        const content = validateDraftContent(draft.contenido); // se revalida: nunca se confía en lo almacenado

        // Con actividad de estudiantes no se borra nada: lo nuevo se añade después de lo existente.
        const activity = await client.query(
            'SELECT EXISTS (SELECT 1 FROM envio_ejercicio WHERE id_curso = $1) AS hay;',
            [req.params.id_curso]
        );
        const hasActivity = activity.rows[0].hay;
        let startOrder = 0;
        if (hasActivity) {
            const max = await client.query('SELECT COALESCE(max(orden), 0)::int AS max FROM mundo WHERE id_curso = $1;', [req.params.id_curso]);
            startOrder = max.rows[0].max;
        } else {
            await client.query('DELETE FROM progreso_mundo WHERE id_curso = $1;', [req.params.id_curso]);
            await client.query('DELETE FROM ejercicio WHERE id_curso = $1;', [req.params.id_curso]);
            await client.query("DELETE FROM banco_pregunta WHERE id_curso = $1 AND origen = 'ia';", [req.params.id_curso]);
            await client.query('DELETE FROM mundo WHERE id_curso = $1;', [req.params.id_curso]);
        }

        let exercises = 0;
        for (const unit of content.unidades) {
            const world = await client.query(
                `INSERT INTO mundo (id_curso, id_silabo, orden, nombre, descripcion, tipo_origen, leccion)
                 VALUES ($1, $2, $3, $4, $5, 'personalizado', $6::jsonb) RETURNING id_mundo;`,
                [req.params.id_curso, draft.id_silabo, startOrder + unit.orden, unit.nombre, unit.descripcion || null,
                    unit.leccion ? JSON.stringify(unit.leccion) : null]
            );
            for (const question of unit.preguntas_sala) {
                await client.query(
                    `INSERT INTO banco_pregunta (id_curso, id_mundo, enunciado, opciones, origen)
                     VALUES ($1, $2, $3, $4::jsonb, 'ia');`,
                    [req.params.id_curso, world.rows[0].id_mundo, question.enunciado, JSON.stringify(question.opciones)]
                );
            }
            let order = 1;
            for (const exercise of unit.ejercicios) {
                await client.query(
                    `INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa, nivel, rubrica, fuente_silabo)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10);`,
                    [world.rows[0].id_mundo, req.params.id_curso, exercise.titulo, exercise.enunciado,
                        exercise.plantilla || null, order, XP_BY_LEVEL[exercise.nivel], exercise.nivel,
                        JSON.stringify(exercise.rubrica), exercise.fuente || null]
                );
                order += 1;
                exercises += 1;
            }
        }

        await client.query(`UPDATE borrador_curso SET estado = 'publicado', fecha_actualizacion = now() WHERE id_borrador = $1;`, [draft.id_borrador]);
        await recordSecurityEvent(client, {
            actorId: req.user.id_usuario,
            institutionId: course.id_institucion,
            action: 'CURSO_PUBLICADO_DESDE_SILABO',
            targetType: 'curso',
            targetId: req.params.id_curso,
            result: 'exitoso',
            ip: getRequestIp(req),
            metadata: { unidades: content.unidades.length, ejercicios: exercises, reemplazo: !hasActivity }
        });
        await client.query('COMMIT');

        res.json({
            success: true,
            message: hasActivity
                ? 'Mundos añadidos al final del curso (ya había actividad de estudiantes, no se borró nada).'
                : 'Curso publicado: los mundos del sílabo reemplazaron al contenido base.',
            unidades: content.unidades.length,
            ejercicios: exercises,
            reemplazo: !hasActivity
        });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        next(error instanceof DraftValidationError ? httpError(400, error.message, 'INVALID_DRAFT') : error);
    } finally {
        if (client) client.release();
    }
};

/**
 * Genera con IA la mini-lección de cada unidad del borrador (solo texto: barata y repetible).
 * POST /api/cursos/:id_curso/silabo/borrador/lecciones
 */
const generarLecciones = async (req, res, next) => {
    let operationId = null;
    let reserved = false;
    try {
        const course = await getAuthorizedCourse(req.params.id_curso, req.user, { write: true });
        const current = await getLatestDraft(req.params.id_curso);
        if (!current || !['generado', 'editado'].includes(current.estado)) {
            throw httpError(409, 'No hay un borrador editable. Genera uno primero.', 'DRAFT_NOT_EDITABLE');
        }
        const content = validateDraftContent(current.contenido);

        operationId = crypto.randomUUID();
        try {
            await query(
                `SELECT * FROM reservar_uso_ia($1, $2, 'generacion_mundo', $3, NULL, $4);`,
                [course.id_docente, operationId, positiveInt(process.env.GEMINI_LESSON_TOKEN_RESERVATION, 30000), current.id_silabo]
            );
            reserved = true;
        } catch (error) {
            if (error.code === '23514') {
                throw httpError(409, 'El docente no dispone de una cuota de IA vigente o suficiente.', 'AI_QUOTA_UNAVAILABLE');
            }
            throw error;
        }

        const courseRow = await query('SELECT nombre, lenguaje FROM curso WHERE id_curso = $1;', [req.params.id_curso]);
        const result = await generateLessons({
            units: content.unidades, courseName: courseRow.rows[0]?.nombre, language: getLanguage(courseRow.rows[0]?.lenguaje)
        });
        const merged = validateDraftContent({
            unidades: content.unidades.map((unit, index) => ({ ...unit, leccion: result.lessons[index] }))
        });

        const client = await getClient();
        try {
            await client.query('BEGIN');
            await client.query('SELECT * FROM confirmar_uso_ia($1, $2, true);', [operationId, result.usage.total_tokens]);
            reserved = false;
            await client.query(
                `UPDATE borrador_curso SET contenido = $1::jsonb, estado = 'editado', fecha_actualizacion = now() WHERE id_borrador = $2;`,
                [JSON.stringify(merged), current.id_borrador]
            );
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
        res.json({ success: true, message: 'Lecciones generadas. Revísalas y edítalas antes de publicar.', contenido: merged, uso_tokens: result.usage });
    } catch (error) {
        if (reserved) await query('SELECT * FROM confirmar_uso_ia($1, 0, false);', [operationId]).catch(() => {});
        next(error instanceof DraftValidationError ? httpError(400, error.message, 'INVALID_DRAFT') : error);
    }
};

module.exports = { getEstado, subirSilabo, generarBorrador, getBorrador, actualizarBorrador, publicarBorrador, generarLecciones, publicSilabo };
