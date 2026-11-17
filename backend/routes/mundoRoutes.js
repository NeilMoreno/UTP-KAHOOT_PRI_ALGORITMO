// ==============================================================
// codeInt - Rutas de Mundos Temáticos (/api/mundos)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const express = require('express');
const router = express.Router();
const mundoController = require('../controllers/mundoController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// Listado de los 7 mundos con estado de desbloqueo dinámico para el curso
router.get('/curso/:id_curso', authenticateJWT, mundoController.getMundosByCurso);

// Detalle de un mundo específico
router.get('/:id_mundo', authenticateJWT, mundoController.getMundoById);

module.exports = router;
