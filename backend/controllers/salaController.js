'use strict';

// ==============================================================
// codeInt - Controlador REST para Salas Multijugador (/api/salas)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const { query } = require('../config/database');
const { activeRooms } = require('../sockets/kahootHandler');
const { createRoom } = require('../services/salaService');
const { isUuid } = require('../utils/validation');

/**
 * Consulta la información básica de una sala por su PIN
 * Endpoint accesible para estudiantes antes de unirse al lobby
 * GET /api/salas/:pin/info
 */
const getSalaInfoByPin = async (req, res, next) => {
    try {
        const { pin } = req.params;
        const cleanPin = (pin || '').trim();

        if (!/^\d{6}$/.test(cleanPin)) {
            return res.status(400).json({
                success: false,
                message: 'El PIN debe ser un número de exactamente 6 dígitos.'
            });
        }

        // Consultar en memoria o en base de datos
        const memoryRoom = activeRooms.get(cleanPin);

        const sql = `
            SELECT s.id_sala, s.pin_sala, s.estado, s.fecha_creacion,
                   c.id_curso, c.nombre AS curso_nombre, c.codigo_curso,
                   u.nombre AS docente_nombre, u.apellido AS docente_apellido,
                   (SELECT count(*)::INTEGER FROM pregunta WHERE id_sala = s.id_sala) AS total_preguntas,
                   (SELECT count(*)::INTEGER FROM participante_sala WHERE id_sala = s.id_sala) AS total_participantes
            FROM sala_multijugador s
            JOIN curso c ON c.id_curso = s.id_curso
            JOIN usuario u ON u.id_usuario = c.id_docente
            WHERE s.pin_sala = $1 AND s.estado IN ('espera', 'en_curso')
              AND (
                  $2 = 'superadministrador'
                  OR ($2 = 'docente' AND c.id_docente = $3)
                  OR ($2 = 'estudiante' AND EXISTS (
                      SELECT 1 FROM matricula m
                       WHERE m.id_curso = c.id_curso AND m.id_estudiante = $3 AND m.estado = 'activa'
                  ))
              )
            LIMIT 1;
        `;
        const result = await query(sql, [cleanPin, req.user.rol, req.user.id_usuario]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró una sala activa con el PIN proporcionado.'
            });
        }

        const sala = result.rows[0];

        res.json({
            success: true,
            data: {
                id_sala: sala.id_sala,
                pin: sala.pin_sala,
                estado: memoryRoom ? memoryRoom.estado : sala.estado,
                lista_para_unirse: Boolean(memoryRoom && memoryRoom.estado === 'espera'),
                curso: {
                    id_curso: sala.id_curso,
                    nombre: sala.curso_nombre,
                    codigo: sala.codigo_curso
                },
                docente: `${sala.docente_nombre} ${sala.docente_apellido}`,
                total_preguntas: sala.total_preguntas,
                total_participantes: memoryRoom ? memoryRoom.participantes.size : sala.total_participantes
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lista las salas activas en los cursos en los que el estudiante está matriculado
 * GET /api/salas/activas
 */
const getSalasActivasEstudiante = async (req, res, next) => {
    try {
        const id_estudiante = req.user.id_usuario;

        const sql = `
            SELECT s.id_sala, s.pin_sala, s.estado, s.fecha_creacion,
                   c.id_curso, c.nombre AS curso_nombre, c.codigo_curso,
                   u.nombre AS docente_nombre, u.apellido AS docente_apellido,
                   (SELECT count(*)::INTEGER FROM pregunta WHERE id_sala = s.id_sala) AS total_preguntas,
                   (SELECT count(*)::INTEGER FROM participante_sala WHERE id_sala = s.id_sala) AS total_participantes
            FROM sala_multijugador s
            JOIN curso c ON c.id_curso = s.id_curso
            JOIN matricula m ON m.id_curso = c.id_curso AND m.id_estudiante = $1 AND m.estado = 'activa'
            JOIN usuario u ON u.id_usuario = c.id_docente
            WHERE s.estado IN ('espera', 'en_curso')
            ORDER BY s.fecha_creacion DESC;
        `;
        const result = await query(sql, [id_estudiante]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lista el historial y salas del docente autenticado
 * GET /api/salas/docente
 */
const getSalasDocente = async (req, res, next) => {
    try {
        const id_docente = req.user.id_usuario;

        const sql = `
            SELECT s.id_sala, s.pin_sala, s.estado, s.fecha_creacion, s.fecha_inicio, s.fecha_fin,
                   c.id_curso, c.nombre AS curso_nombre, c.codigo_curso,
                   (SELECT count(*)::INTEGER FROM pregunta WHERE id_sala = s.id_sala) AS total_preguntas,
                   (SELECT count(*)::INTEGER FROM participante_sala WHERE id_sala = s.id_sala) AS total_participantes
            FROM sala_multijugador s
            JOIN curso c ON c.id_curso = s.id_curso
            WHERE c.id_docente = $1 OR $2 = 'superadministrador'
            ORDER BY s.fecha_creacion DESC
            LIMIT 50;
        `;
        const result = await query(sql, [id_docente, req.user.rol]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Consulta el detalle completo de una sala (preguntas, opciones y participantes)
 * GET /api/salas/:id_sala/detalle
 */
const getSalaDetalle = async (req, res, next) => {
    try {
        const { id_sala } = req.params;
        if (!isUuid(id_sala)) {
            return res.status(400).json({
                success: false,
                message: 'id_sala debe ser un UUID válido.'
            });
        }

        const salaSql = `
            SELECT s.id_sala, s.pin_sala, s.estado, s.fecha_creacion, s.fecha_inicio, s.fecha_fin,
                   c.id_curso, c.nombre AS curso_nombre, c.codigo_curso, c.id_docente
            FROM sala_multijugador s
            JOIN curso c ON c.id_curso = s.id_curso
            WHERE s.id_sala = $1;
        `;
        const salaRes = await query(salaSql, [id_sala]);

        if (salaRes.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Sala no encontrada.'
            });
        }

        const sala = salaRes.rows[0];

        // Validar permisos del docente
        if (req.user.rol === 'docente' && sala.id_docente !== req.user.id_usuario) {
            return res.status(403).json({
                success: false,
                message: 'No tienes autorización para consultar esta sala.'
            });
        }

        // Obtener preguntas con sus opciones
        const pregSql = `
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
            ORDER BY p.orden ASC;
        `;
        const pregRes = await query(pregSql, [id_sala]);

        // Obtener participantes y su posición/puntaje
        const partSql = `
            SELECT ps.id_participante, ps.puntaje_final, ps.posicion_final, ps.fecha_ingreso,
                   u.id_usuario, u.nombre, u.apellido, u.email
            FROM participante_sala ps
            JOIN usuario u ON u.id_usuario = ps.id_estudiante
            WHERE ps.id_sala = $1
            ORDER BY ps.posicion_final ASC NULLS LAST, ps.puntaje_final DESC;
        `;
        const partRes = await query(partSql, [id_sala]);

        res.json({
            success: true,
            data: {
                ...sala,
                preguntas: pregRes.rows,
                participantes: partRes.rows
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Prepara una sala (en estado "espera") con sus preguntas mediante API REST.
 * El docente la abre luego por Socket.io con el evento room:host { pin }.
 * POST /api/salas
 */
const createSalaRest = async (req, res, next) => {
    try {
        const room = await createRoom(req.user, req.body?.id_curso, req.body?.preguntas);
        res.status(201).json({
            success: true,
            data: {
                id_sala: room.id_sala,
                pin: room.pin,
                estado: 'espera',
                curso: room.curso_nombre,
                total_preguntas: room.preguntas.length
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSalaInfoByPin,
    getSalasActivasEstudiante,
    getSalasDocente,
    getSalaDetalle,
    createSalaRest
};
