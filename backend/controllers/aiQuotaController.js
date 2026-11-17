'use strict';

const { query } = require('../config/database');
const { httpError } = require('../utils/httpError');
const { isUuid } = require('../utils/validation');

const parseDate = (value, field) => {
    if (typeof value !== 'string') throw httpError(400, `${field} es obligatorio.`, 'INVALID_DATE');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw httpError(400, `${field} no es una fecha válida.`, 'INVALID_DATE');
    return date;
};

const createQuota = async (req, res, next) => {
    try {
        const { id_docente, limite_tokens, fecha_inicio, fecha_fin } = req.body || {};
        if (!isUuid(id_docente)) {
            throw httpError(400, 'id_docente debe ser un UUID válido.', 'INVALID_TEACHER_ID');
        }
        const limit = Number(limite_tokens);
        if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1000000000) {
            throw httpError(400, 'limite_tokens debe ser un entero entre 1 y 1,000,000,000.', 'INVALID_TOKEN_LIMIT');
        }
        const start = parseDate(fecha_inicio, 'fecha_inicio');
        const end = parseDate(fecha_fin, 'fecha_fin');
        if (end <= start) {
            throw httpError(400, 'fecha_fin debe ser posterior a fecha_inicio.', 'INVALID_QUOTA_RANGE');
        }

        const result = await query(`
            INSERT INTO asignacion_tokens (
                id_docente_beneficiario, id_superadmin_asignador,
                limite_tokens, fecha_inicio, fecha_fin
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id_asignacion_tokens, id_docente_beneficiario,
                      limite_tokens, fecha_inicio, fecha_fin;
        `, [id_docente, req.user.id_usuario, limit, start.toISOString(), end.toISOString()]);

        return res.status(201).json({
            success: true,
            message: 'Cuota de IA asignada correctamente.',
            data: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23P01') {
            return next(httpError(409, 'El docente ya tiene una cuota que se superpone con ese periodo.', 'AI_QUOTA_OVERLAP'));
        }
        next(error);
    }
};

const listQuotas = async (req, res, next) => {
    try {
        const result = await query(`
            SELECT a.id_asignacion_tokens,
                   a.id_docente_beneficiario AS id_docente,
                   concat_ws(' ', u.nombre, u.apellido) AS docente,
                   u.email,
                   a.limite_tokens,
                   a.fecha_inicio,
                   a.fecha_fin,
                   COALESCE(sum(
                       CASE
                           WHEN ui.estado_consumo = 'reservado' THEN ui.tokens_reservados
                           WHEN ui.estado_consumo = 'confirmado' THEN ui.tokens_consumidos
                           ELSE 0
                       END
                   ), 0)::bigint AS tokens_comprometidos
              FROM asignacion_tokens a
              JOIN usuario u ON u.id_usuario = a.id_docente_beneficiario
              LEFT JOIN uso_ia ui
                ON ui.id_docente = a.id_docente_beneficiario
               AND ui.fecha_uso >= a.fecha_inicio
               AND ui.fecha_uso < a.fecha_fin
             GROUP BY a.id_asignacion_tokens, u.nombre, u.apellido, u.email
             ORDER BY a.fecha_inicio DESC;
        `);
        return res.json({ success: true, total: result.rowCount, data: result.rows });
    } catch (error) {
        next(error);
    }
};

const parsePage = (value, fallback, max) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

// Consumo de IA de un docente: el docente consulta el suyo; el superadministrador
// indica el docente con ?id_docente=.
const getConsumption = async (req, res, next) => {
    try {
        let idTeacher = req.user.id_usuario;
        if (req.user.rol === 'superadministrador') {
            idTeacher = req.query.id_docente;
            if (!isUuid(idTeacher)) {
                throw httpError(400, 'Indique id_docente como UUID válido.', 'INVALID_TEACHER_ID');
            }
        }
        const limit = parsePage(req.query.limite, 50, 200);
        const offset = (parsePage(req.query.pagina, 1, 100000) - 1) * limit;

        const [quota, summary, operations] = await Promise.all([
            query(`
                SELECT a.id_asignacion_tokens, a.limite_tokens, a.fecha_inicio, a.fecha_fin,
                       COALESCE(sum(ui.tokens_consumidos) FILTER (WHERE ui.estado_consumo = 'confirmado'), 0)::bigint AS tokens_consumidos,
                       COALESCE(sum(ui.tokens_reservados) FILTER (WHERE ui.estado_consumo = 'reservado'), 0)::bigint AS tokens_reservados
                  FROM asignacion_tokens a
                  LEFT JOIN uso_ia ui
                    ON ui.id_docente = a.id_docente_beneficiario
                   AND ui.fecha_uso >= a.fecha_inicio
                   AND ui.fecha_uso < a.fecha_fin
                 WHERE a.id_docente_beneficiario = $1
                   AND now() >= a.fecha_inicio AND now() < a.fecha_fin
                 GROUP BY a.id_asignacion_tokens;
            `, [idTeacher]),
            query(`
                SELECT count(*)::integer AS operaciones,
                       count(*) FILTER (WHERE estado_consumo = 'confirmado')::integer AS exitosas,
                       count(*) FILTER (WHERE estado_consumo = 'fallido')::integer AS fallidas,
                       count(*) FILTER (WHERE estado_consumo = 'reservado')::integer AS en_proceso
                  FROM uso_ia
                 WHERE id_docente = $1;
            `, [idTeacher]),
            query(`
                SELECT ui.id_operacion, ui.fecha_uso, ui.tipo_operacion, ui.estado_consumo,
                       ui.tokens_reservados, ui.tokens_consumidos, ui.modelo_ia,
                       concat_ws(' ', est.nombre, est.apellido) AS estudiante,
                       ej.titulo AS ejercicio, cu.nombre AS curso
                  FROM uso_ia ui
                  LEFT JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ui.id_envio_ejercicio
                  LEFT JOIN usuario est ON est.id_usuario = ee.id_estudiante
                  LEFT JOIN ejercicio ej ON ej.id_ejercicio = ee.id_ejercicio
                  LEFT JOIN curso cu ON cu.id_curso = ee.id_curso
                 WHERE ui.id_docente = $1
                 ORDER BY ui.fecha_uso DESC
                 LIMIT $2 OFFSET $3;
            `, [idTeacher, limit, offset])
        ]);

        const current = quota.rows[0] || null;
        const cuotaVigente = current && {
            ...current,
            tokens_disponibles: Math.max(0,
                Number(current.limite_tokens) - Number(current.tokens_consumidos) - Number(current.tokens_reservados))
        };
        return res.json({
            success: true,
            data: {
                cuota_vigente: cuotaVigente,
                resumen: summary.rows[0],
                operaciones: operations.rows
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createQuota, listQuotas, getConsumption };
