// ==============================================================
// codeInt - Rutas de Analíticas Académicas (/api/analiticas)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Solo el superadministrador ve estadísticas de edad (se declara antes del filtro de docentes).
router.get('/demografia', authenticateJWT, authorizeRoles('superadministrador'), analyticsController.getDemographicsSummary);

router.use(authenticateJWT);
router.use(authorizeRoles('docente', 'superadministrador'));

router.get('/cursos', analyticsController.getCoursesSummary);
router.get('/curso/:id_curso', analyticsController.getCourseDetail);
router.get('/curso/:id_curso/estudiante/:id_estudiante', analyticsController.getStudentDetail);
router.get('/curso/:id_curso/integridad', analyticsController.getIntegrityReport);
router.patch('/curso/:id_curso/integridad/:id_envio', analyticsController.reviewIntegrityItem);

module.exports = router;
