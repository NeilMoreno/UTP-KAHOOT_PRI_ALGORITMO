'use strict';

const { randomUUID } = require('crypto');
const { query, getClient } = require('../config/database');
const { getExerciseContext, getActiveEnrollment } = require('./evaluationController');
const { generateHint, MAX_HINTS, DAILY_LIMIT } = require('../services/hintService');
const { httpError } = require('../utils/httpError');

const HINT_TOKEN_RESERVATION = () => {
    const parsed = Number.parseInt(process.env.GEMINI_HINT_TOKEN_RESERVATION, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 6000;
};

// El estado actual de las pistas de un ejercicio para el estudiante.
const hintState = async (idStudent, idExercise) => {
    const hints = await query(
        'SELECT nivel, contenido FROM pista_ia WHERE id_estudiante = $1 AND id_ejercicio = $2 ORDER BY nivel;',
        [idStudent, idExercise]
    );
    return { pistas: hints.rows, restantes: Math.max(0, MAX_HINTS - hints.rowCount), maximo: MAX_HINTS };
};

// GET /api/ejercicios/:id_ejercicio/pistas
const getHints = async (req, res, next) => {
    try {
        const exercise = await getExerciseContext(req.params.id_ejercicio, req.user);
        await getActiveEnrollment(exercise.id_curso, req.user.id_usuario);
        res.json({ success: true, data: { ...(await hintState(req.user.id_usuario, exercise.id_ejercicio)), disponible: exercise.tipo === 'escribir' } });
    } catch (error) { next(error); }
};

// POST /api/ejercicios/:id_ejercicio/pistas — la siguiente pista (3 como máximo, tras al menos un intento)
const requestHint = async (req, res, next) => {
    let operationId = null;
    let reserved = false;
    try {
        const exercise = await getExerciseContext(req.params.id_ejercicio, req.user);
        await getActiveEnrollment(exercise.id_curso, req.user.id_usuario);
        if (exercise.tipo !== 'escribir') {
            throw httpError(409, 'Este tipo de ejercicio no tiene pistas de IA: se corrige al instante y puedes repetirlo.', 'HINT_NOT_AVAILABLE');
        }

        // Debe haber un intento evaluado y no haber aprobado todavía.
        const attempt = await query(`
            SELECT ee.id_envio_ejercicio, ee.codigo_pseint, ev.retroalimentacion, ev.puntaje,
                   (SELECT COALESCE(max(ev2.puntaje), 0) FROM envio_ejercicio e2 JOIN evaluacion_ia ev2 ON ev2.id_envio_ejercicio = e2.id_envio_ejercicio
                     WHERE e2.id_ejercicio = ee.id_ejercicio AND e2.id_estudiante = ee.id_estudiante) AS mejor_puntaje
              FROM envio_ejercicio ee JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
             WHERE ee.id_ejercicio = $1 AND ee.id_estudiante = $2
             ORDER BY ee.fecha_envio DESC LIMIT 1;
        `, [exercise.id_ejercicio, req.user.id_usuario]);
        if (attempt.rowCount === 0) throw httpError(409, 'Haz primero un intento y envíalo: la pista se basa en lo que escribiste.', 'HINT_NEEDS_ATTEMPT');
        const last = attempt.rows[0];
        if (Number(last.mejor_puntaje) >= 70) throw httpError(409, 'Ya aprobaste este ejercicio: no necesitas pistas.', 'HINT_ALREADY_PASSED');

        const state = await hintState(req.user.id_usuario, exercise.id_ejercicio);
        if (state.pistas.length >= MAX_HINTS) throw httpError(409, `Ya usaste las ${MAX_HINTS} pistas de este ejercicio.`, 'HINTS_EXHAUSTED');
        const today = await query(
            `SELECT count(*)::int AS total FROM pista_ia WHERE id_estudiante = $1 AND fecha_creacion > now() - interval '24 hours';`,
            [req.user.id_usuario]
        );
        if (today.rows[0].total >= DAILY_LIMIT) throw httpError(429, 'Llegaste al límite de pistas de hoy. Vuelve mañana.', 'HINT_DAILY_LIMIT');
        const level = state.pistas.length + 1;

        operationId = randomUUID();
        try {
            await query(`SELECT * FROM reservar_uso_ia($1, $2, 'evaluacion', $3, $4, NULL);`,
                [exercise.id_docente, operationId, HINT_TOKEN_RESERVATION(), last.id_envio_ejercicio]);
            reserved = true;
        } catch (error) {
            if (error.code === '23514') throw httpError(409, 'Tu docente no tiene cuota de IA disponible por ahora.', 'AI_QUOTA_UNAVAILABLE');
            throw error;
        }

        const result = await generateHint({ exercise, code: last.codigo_pseint, feedback: last.retroalimentacion, level });

        const client = await getClient();
        try {
            await client.query('BEGIN');
            await client.query(
                `INSERT INTO pista_ia (id_estudiante, id_ejercicio, id_envio_ejercicio, nivel, contenido) VALUES ($1, $2, $3, $4, $5);`,
                [req.user.id_usuario, exercise.id_ejercicio, last.id_envio_ejercicio, level, result.pista]
            );
            await client.query(`UPDATE uso_ia SET proveedor_ia = 'gemini', modelo_ia = $2 WHERE id_operacion = $1;`, [operationId, result.model]);
            await client.query('SELECT * FROM confirmar_uso_ia($1, $2, true);', [operationId, Math.min(result.tokens, HINT_TOKEN_RESERVATION())]);
            reserved = false;
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            if (error.code === '23505') throw httpError(409, 'Esa pista ya se generó. Actualiza la pantalla.', 'HINT_DUPLICATE');
            throw error;
        } finally {
            client.release();
        }

        return res.status(201).json({
            success: true,
            data: { nivel: level, contenido: result.pista, restantes: MAX_HINTS - level, maximo: MAX_HINTS }
        });
    } catch (error) {
        if (reserved) await query('SELECT * FROM confirmar_uso_ia($1, 0, false);', [operationId]).catch(() => {});
        return next(error);
    }
};

module.exports = { getHints, requestHint };
