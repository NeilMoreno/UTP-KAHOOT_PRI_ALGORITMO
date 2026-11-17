// ==============================================================
// codeInt - Rutas de Analíticas Académicas (/api/analiticas)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(authenticateJWT);
router.use(authorizeRoles('docente', 'superadministrador'));

router.get('/cursos', analyticsController.getCoursesSummary);
router.get('/curso/:id_curso', analyticsController.getCourseDetail);
router.get('/curso/:id_curso/estudiante/:id_estudiante', analyticsController.getStudentDetail);

module.exports = router;
