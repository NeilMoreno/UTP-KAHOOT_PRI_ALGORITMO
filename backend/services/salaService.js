'use strict';

// ==============================================================
// codeInt - Servicio de Salas Multijugador (creación y carga desde PostgreSQL)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const { query, getClient } = require('../config/database');
const { generateRoomPin } = require('../utils/kahootScoring');
const { httpError } = require('../utils/httpError');
const { isUuid } = require('../utils/validation');
const { notifyMany } = require('./notificationService');

const LIMITS = Object.freeze({
    MAX_QUESTIONS: 50,
    MAX_STATEMENT_LENGTH: 500,
    MAX_OPTION_LENGTH: 200,
    MIN_TIME_SECONDS: 5,
    MAX_TIME_SECONDS: 120,
    DEFAULT_TIME_SECONDS: 30,
    MIN_POINTS: 100,
    MAX_POINTS: 5000,
    DEFAULT_POINTS: 1000
});
const LABELS = Object.freeze(['A', 'B', 'C', 'D']);
const PIN_ATTEMPTS = 10;

const invalid = (message) => httpError(400, message, 'INVALID_QUESTIONS');

const readInteger = (value, fallback, min, max, label) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw invalid(`${label} debe ser un entero entre ${min} y ${max}.`);
    }
    return parsed;
};

const readText = (value, max, label) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length === 0) throw invalid(`${label} no puede estar vacío.`);
    if (text.length > max) throw invalid(`${label} no puede superar ${max} caracteres.`);
    return text;
};

/**
 * Valida y normaliza las preguntas recibidas del cliente. Las etiquetas A-D se
 * asignan por posición (nunca se confía en las enviadas) y cada pregunta debe
 * tener exactamente una opción correcta.
 */
const validateQuestions = (rawQuestions) => {
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        throw invalid('Debe incluir al menos una pregunta.');
    }
    if (rawQuestions.length > LIMITS.MAX_QUESTIONS) {
        throw invalid(`Una sala admite como máximo ${LIMITS.MAX_QUESTIONS} preguntas.`);
    }

    return rawQuestions.map((raw, index) => {
        const label = `Pregunta ${index + 1}`;
        if (!raw || typeof raw !== 'object') throw invalid(`${label} no es válida.`);

        const rawOptions = Array.isArray(raw.opciones) ? raw.opciones : [];
        if (rawOptions.length < 2 || rawOptions.length > LABELS.length) {
            throw invalid(`${label} debe tener entre 2 y ${LABELS.length} opciones.`);
        }
        const opciones = rawOptions.map((option, optionIndex) => {
            if (!option || typeof option !== 'object') {
                throw invalid(`${label}: la opción ${LABELS[optionIndex]} no es válida.`);
            }
            return {
                etiqueta: LABELS[optionIndex],
                texto: readText(option.texto, LIMITS.MAX_OPTION_LENGTH, `${label}: el texto de la opción ${LABELS[optionIndex]}`),
                es_correcta: option.es_correcta === true
            };
        });
        if (opciones.filter((option) => option.es_correcta).length !== 1) {
            throw invalid(`${label} debe tener exactamente una opción correcta.`);
        }

        return {
            orden: index + 1,
            enunciado: readText(raw.enunciado, LIMITS.MAX_STATEMENT_LENGTH, `${label}: el enunciado`),
            tiempo_limite_seg: readInteger(
                raw.tiempo_limite_seg, LIMITS.DEFAULT_TIME_SECONDS,
                LIMITS.MIN_TIME_SECONDS, LIMITS.MAX_TIME_SECONDS, `${label}: tiempo_limite_seg`
            ),
            puntos_base: readInteger(
                raw.puntos_base, LIMITS.DEFAULT_POINTS,
                LIMITS.MIN_POINTS, LIMITS.MAX_POINTS, `${label}: puntos_base`
            ),
            opciones
        };
    });
};

const fetchQuestions = async (db, idRoom) => {
    const result = await db.query(`
        SELECT p.id_pregunta, p.orden, p.enunciado, p.tiempo_limite_seg, p.puntos_base,
               json_agg(json_build_object(
                   'id_opcion', o.id_opcion,
                   'etiqueta', o.etiqueta,
                   'texto', o.texto,
                   'es_correcta', o.es_correcta
               ) ORDER BY o.etiqueta) AS opciones
          FROM pregunta p
          JOIN opcion o ON o.id_pregunta = p.id_pregunta
         WHERE p.id_sala = $1
         GROUP BY p.id_pregunta, p.orden, p.enunciado, p.tiempo_limite_seg, p.puntos_base
         ORDER BY p.orden;
    `, [idRoom]);
    return result.rows;
};

// El índice único parcial uq_sala_pin_activa garantiza PIN único entre salas activas;
// ante colisión (23505) se reintenta con otro PIN dentro de un SAVEPOINT.
const insertRoomWithUniquePin = async (client, idCourse) => {
    for (let attempt = 0; attempt < PIN_ATTEMPTS; attempt++) {
        await client.query('SAVEPOINT pin_attempt');
        try {
            const result = await client.query(`
                INSERT INTO sala_multijugador (id_curso, pin_sala, estado)
                VALUES ($1, $2, 'espera')
                RETURNING id_sala, pin_sala, estado, fecha_creacion;
            `, [idCourse, generateRoomPin()]);
            await client.query('RELEASE SAVEPOINT pin_attempt');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK TO SAVEPOINT pin_attempt');
            if (error.code !== '23505') throw error;
        }
    }
    throw httpError(503, 'No fue posible asignar un PIN único. Intente nuevamente.', 'NO_UNIQUE_PIN_AVAILABLE');
};

const toDescriptor = (sala, course, preguntas) => ({
    id_sala: sala.id_sala,
    pin: sala.pin_sala.trim(),
    id_curso: course.id_curso,
    id_docente: course.id_docente,
    curso_nombre: course.nombre,
    preguntas
});

/**
 * Crea una sala en estado "espera" con sus preguntas y opciones en una sola
 * transacción. Solo el docente propietario del curso (o el superadministrador) puede hacerlo.
 */
const createRoom = async (user, idCourse, rawQuestions) => {
    if (!isUuid(idCourse)) {
        throw httpError(400, 'id_curso debe ser un UUID válido.', 'INVALID_COURSE_ID');
    }
    const questions = validateQuestions(rawQuestions);

    const course = await query(`
        SELECT id_curso, nombre, id_docente
          FROM curso
         WHERE id_curso = $1
           AND estado = 'activo'
           AND (id_docente = $2 OR $3 = 'superadministrador');
    `, [idCourse, user.id_usuario, user.rol]);
    if (course.rowCount === 0) {
        throw httpError(403, 'No tienes permisos para crear salas en este curso.', 'COURSE_FORBIDDEN');
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');
        const sala = await insertRoomWithUniquePin(client, idCourse);
        for (const question of questions) {
            const inserted = await client.query(`
                INSERT INTO pregunta (id_sala, orden, enunciado, tiempo_limite_seg, puntos_base)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id_pregunta;
            `, [sala.id_sala, question.orden, question.enunciado, question.tiempo_limite_seg, question.puntos_base]);
            for (const option of question.opciones) {
                await client.query(`
                    INSERT INTO opcion (id_pregunta, etiqueta, texto, es_correcta)
                    VALUES ($1, $2, $3, $4);
                `, [inserted.rows[0].id_pregunta, option.etiqueta, option.texto, option.es_correcta]);
            }
        }
        const preguntas = await fetchQuestions(client, sala.id_sala);
        await client.query('COMMIT');
        // Aviso a los estudiantes matriculados (informativo: si falla, la sala igual existe).
        query(`SELECT id_estudiante FROM matricula WHERE id_curso = $1 AND estado = 'activa';`, [idCourse])
            .then((students) => notifyMany({ query }, students.rows.map((row) => row.id_estudiante), {
                tipo: 'sala', titulo: 'Sala preparada', mensaje: `Tu docente preparó una sala en ${course.rows[0].nombre}. Entra con el PIN cuando la abra.`, enlace: '#/jugar'
            }))
            .catch(() => {});
        return toDescriptor(sala, course.rows[0], preguntas);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Carga una sala en "espera" creada previamente (p. ej. por REST) para que su
 * docente anfitrión la active en memoria. Devuelve null si no existe o no le pertenece.
 */
const loadWaitingRoom = async (user, pin) => {
    const result = await query(`
        SELECT s.id_sala, s.pin_sala, c.id_curso, c.nombre, c.id_docente
          FROM sala_multijugador s
          JOIN curso c ON c.id_curso = s.id_curso
         WHERE s.pin_sala = $1
           AND s.estado = 'espera'
           AND (c.id_docente = $2 OR $3 = 'superadministrador');
    `, [pin, user.id_usuario, user.rol]);
    if (result.rowCount === 0) return null;

    const row = result.rows[0];
    const preguntas = await fetchQuestions({ query }, row.id_sala);
    if (preguntas.length === 0) return null;
    return toDescriptor(row, row, preguntas);
};

// Al reiniciar el servidor el estado en memoria se pierde: las salas que
// quedaron activas en PostgreSQL no pueden continuar y se cancelan.
const cancelOrphanRooms = async () => {
    const result = await query(`
        UPDATE sala_multijugador
           SET estado = 'cancelada', fecha_fin = now()
         WHERE estado IN ('espera', 'en_curso')
        RETURNING id_sala;
    `);
    return result.rowCount;
};

module.exports = {
    LIMITS,
    validateQuestions,
    createRoom,
    loadWaitingRoom,
    cancelOrphanRooms
};
