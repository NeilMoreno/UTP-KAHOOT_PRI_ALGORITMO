'use strict';

const { query } = require('../config/database');
const { getAuthorizedCourse } = require('../services/authorizationService');
const { httpError } = require('../utils/httpError');
const { isUuid } = require('../utils/validation');

// GET /api/cursos/:id_curso/banco — preguntas del curso (por defecto solo las activas)
const listBank = async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user);
        const all = req.query.todas === '1';
        const result = await query(
            `SELECT b.id_banco_pregunta, b.id_mundo, m.nombre AS mundo_nombre, b.enunciado, b.opciones, b.origen, b.activa
               FROM banco_pregunta b LEFT JOIN mundo m ON m.id_mundo = b.id_mundo
              WHERE b.id_curso = $1 AND ($2::boolean OR b.activa)
              ORDER BY m.orden NULLS LAST, b.fecha_creacion, b.id_banco_pregunta
              LIMIT 500;`,
            [req.params.id_curso, all]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

// PATCH /api/cursos/:id_curso/banco/:id_pregunta — activar o desactivar una pregunta
const setActive = async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user, { write: true });
        if (!isUuid(req.params.id_pregunta)) throw httpError(400, 'Identificador de pregunta no válido.', 'INVALID_ID');
        if (typeof req.body?.activa !== 'boolean') throw httpError(400, 'Indica si la pregunta queda activa.', 'INVALID_BODY');
        const result = await query(
            `UPDATE banco_pregunta SET activa = $3 WHERE id_banco_pregunta = $2 AND id_curso = $1 RETURNING id_banco_pregunta, activa;`,
            [req.params.id_curso, req.params.id_pregunta, req.body.activa]
        );
        if (result.rowCount === 0) throw httpError(404, 'Pregunta no encontrada.', 'NOT_FOUND');
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

module.exports = { listBank, setActive };
