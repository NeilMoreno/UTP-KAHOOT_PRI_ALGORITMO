// ==============================================================
// codeInt - Rutas de Ejercicios PSeInt (/api/ejercicios)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const express = require('express');
const router = express.Router();
const ejercicioController = require('../controllers/ejercicioController');
const evaluationController = require('../controllers/evaluationController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { aiEvaluationLimiter } = require('../config/security');

// Listado de ejercicios pertenecientes a un mundo (valida desbloqueo para estudiantes)
router.get('/mundo/:id_mundo', authenticateJWT, ejercicioController.getEjerciciosByMundo);

// Detalle de un ejercicio para el editor de código PSeInt
router.get('/:id_ejercicio', authenticateJWT, ejercicioController.getEjercicioById);

// Historial de entregas y evaluaciones del estudiante en este ejercicio
router.get('/:id_ejercicio/historial', authenticateJWT, ejercicioController.getHistorialEnvios);

// Validación local gratuita y envío idempotente para evaluación por IA
router.post('/:id_ejercicio/validar',
    authenticateJWT,
    authorizeRoles('estudiante'),
    evaluationController.validateCode
);
router.post('/:id_ejercicio/envios',
    authenticateJWT,
    authorizeRoles('estudiante'),
    aiEvaluationLimiter,
    evaluationController.submitAndEvaluate
);

// Creación de ejercicio nuevo (Docentes y Administradores)
router.post('/', authenticateJWT, authorizeRoles('docente', 'superadministrador'), ejercicioController.createEjercicio);

// Actualización de ejercicio (Docentes y Administradores)
router.put('/:id_ejercicio', authenticateJWT, authorizeRoles('docente', 'superadministrador'), ejercicioController.updateEjercicio);

module.exports = router;
