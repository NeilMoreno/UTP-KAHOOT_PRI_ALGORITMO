'use strict';

const express = require('express');
const controller = require('../controllers/diagnosticoController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router({ mergeParams: true });
const studentOnly = [authenticateJWT, authorizeRoles('estudiante')];

router.get('/', ...studentOnly, controller.getDiagnostico);
router.post('/', ...studentOnly, controller.enviarDiagnostico);

module.exports = router;
