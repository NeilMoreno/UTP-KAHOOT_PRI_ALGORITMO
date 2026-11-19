'use strict';

const { query } = require('../config/database');
const { httpError } = require('../utils/httpError');

const MAX_QUESTIONS = 6;
const MIN_QUESTIONS = 2;

// Mundos que el estudiante convalidó con el diagnóstico (0 si no lo hizo o no tiene matrícula activa).
const getValidatedWorlds = async (idCourse, idStudent) => {
    const result = await query(
        `SELECT mundos_convalidados FROM matricula WHERE id_curso = $1 AND id_estudiante = $2 AND estado = 'activa' LIMIT 1;`,
        [idCourse, idStudent]
    );
    return result.rows[0]?.mundos_convalidados || 0;
};

const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

// Una pregunta activa por mundo, en el orden de los mundos (las primeras MAX_QUESTIONS).
const pickQuestions = async (idCourse) => {
    const result = await query(
        `SELECT DISTINCT ON (m.id_mundo) m.orden, m.nombre AS mundo_nombre, b.id_banco_pregunta, b.enunciado, b.opciones
           FROM banco_pregunta b JOIN mundo m ON m.id_mundo = b.id_mundo
          WHERE b.id_curso = $1 AND b.activa
          ORDER BY m.id_mundo, b.fecha_creacion, b.id_banco_pregunta;`,
        [idCourse]
    );
    return result.rows.sort((a, b) => a.orden - b.orden).slice(0, MAX_QUESTIONS);
};

const getEnrollment = async (idCourse, idStudent) => {
    const result = await query(
        `SELECT id_matricula, diagnostico_en, diagnostico_aciertos, diagnostico_total, mundos_convalidados
           FROM matricula WHERE id_curso = $1 AND id_estudiante = $2 AND estado = 'activa' LIMIT 1;`,
        [idCourse, idStudent]
    );
    if (result.rowCount === 0) throw httpError(403, 'No estás matriculado en este curso.', 'NOT_ENROLLED');
    return result.rows[0];
};

// Estado y preguntas (sin la respuesta correcta; las opciones salen mezcladas).
const getDiagnostic = async (idCourse, idStudent) => {
    const enrollment = await getEnrollment(idCourse, idStudent);
    if (enrollment.diagnostico_en) {
        return {
            disponible: false, realizado: true,
            aciertos: enrollment.diagnostico_aciertos, total: enrollment.diagnostico_total,
            mundos_convalidados: enrollment.mundos_convalidados
        };
    }
    const questions = await pickQuestions(idCourse);
    if (questions.length < MIN_QUESTIONS) return { disponible: false, realizado: false };
    return {
        disponible: true, realizado: false,
        preguntas: questions.map((q) => ({
            id_banco_pregunta: q.id_banco_pregunta, mundo_orden: q.orden, mundo_nombre: q.mundo_nombre, enunciado: q.enunciado,
            opciones: shuffle(q.opciones.map((option) => option.texto))
        }))
    };
};

// Corrige: un mundo se convalida si su pregunta es correcta Y todos los mundos anteriores también.
const gradeDiagnostic = async (idCourse, idStudent, answers) => {
    const enrollment = await getEnrollment(idCourse, idStudent);
    if (enrollment.diagnostico_en) throw httpError(409, 'Ya hiciste el diagnóstico de este curso.', 'DIAGNOSTIC_DONE');
    if (!Array.isArray(answers) || answers.length === 0 || answers.length > MAX_QUESTIONS) {
        throw httpError(400, 'Envía tus respuestas al diagnóstico.', 'INVALID_ANSWERS');
    }
    const questions = await pickQuestions(idCourse);
    if (questions.length < MIN_QUESTIONS) throw httpError(409, 'Este curso no tiene diagnóstico disponible.', 'DIAGNOSTIC_UNAVAILABLE');

    const byQuestion = new Map(answers.map((a) => [a?.id_banco_pregunta, typeof a?.respuesta === 'string' ? a.respuesta : null]));
    let correct = 0;
    let prefix = 0;
    let streak = true;
    const detail = questions.map((q) => {
        const right = q.opciones.find((option) => option.es_correcta === true)?.texto;
        const ok = right !== undefined && byQuestion.get(q.id_banco_pregunta) === right;
        if (ok) correct += 1;
        streak = streak && ok;
        if (streak) prefix += 1;
        return { mundo_orden: q.orden, correcta: ok };
    });

    await query(
        `UPDATE matricula SET mundos_convalidados = $2, diagnostico_aciertos = $3, diagnostico_total = $4, diagnostico_en = now()
          WHERE id_matricula = $1 AND diagnostico_en IS NULL;`,
        [enrollment.id_matricula, prefix, correct, questions.length]
    );
    return { aciertos: correct, total: questions.length, mundos_convalidados: prefix, detalle: detail };
};

module.exports = { getValidatedWorlds, getDiagnostic, gradeDiagnostic, MAX_QUESTIONS, MIN_QUESTIONS };
