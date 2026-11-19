'use strict';

const { getAuthorizedCourse } = require('../services/authorizationService');
const { getDiagnostic, gradeDiagnostic } = require('../services/diagnosticService');

// GET /api/cursos/:id_curso/diagnostico
const getDiagnostico = async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user);
        res.json({ success: true, data: await getDiagnostic(req.params.id_curso, req.user.id_usuario) });
    } catch (error) { next(error); }
};

// POST /api/cursos/:id_curso/diagnostico  { respuestas: [{ id_banco_pregunta, respuesta }] }
const enviarDiagnostico = async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user);
        res.json({ success: true, data: await gradeDiagnostic(req.params.id_curso, req.user.id_usuario, req.body?.respuestas) });
    } catch (error) { next(error); }
};

module.exports = { getDiagnostico, enviarDiagnostico };
