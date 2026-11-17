// ==============================================================
// codeInt - Rutas de Salas Multijugador (/api/salas)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const express = require('express');
const salaController = require('../controllers/salaController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticateJWT);

// Salas abiertas en los cursos del estudiante
router.get('/activas', authorizeRoles('estudiante'), salaController.getSalasActivasEstudiante);

// Historial de salas del docente
router.get('/docente', authorizeRoles('docente', 'superadministrador'), salaController.getSalasDocente);

// Información previa al ingreso por PIN (solo para quien pertenece al curso)
router.get('/:pin(\\d{6})/info', salaController.getSalaInfoByPin);

// Detalle completo con respuestas correctas (solo docentes)
router.get('/:id_sala/detalle', authorizeRoles('docente', 'superadministrador'), salaController.getSalaDetalle);

// Preparar una sala con sus preguntas
router.post('/', authorizeRoles('docente', 'superadministrador'), salaController.createSalaRest);

module.exports = router;
