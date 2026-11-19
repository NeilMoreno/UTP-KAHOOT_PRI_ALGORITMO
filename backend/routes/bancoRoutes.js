'use strict';

const express = require('express');
const bancoController = require('../controllers/bancoController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router({ mergeParams: true });
const teacherOnly = [authenticateJWT, authorizeRoles('docente', 'superadministrador')];

router.get('/', ...teacherOnly, bancoController.listBank);
router.patch('/:id_pregunta', ...teacherOnly, bancoController.setActive);

module.exports = router;
