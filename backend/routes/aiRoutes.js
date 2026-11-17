'use strict';

const express = require('express');
const aiQuotaController = require('../controllers/aiQuotaController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticateJWT);
router.get('/consumo', authorizeRoles('docente', 'superadministrador'), aiQuotaController.getConsumption);
router.get('/cuotas', authorizeRoles('superadministrador'), aiQuotaController.listQuotas);
router.post('/cuotas', authorizeRoles('superadministrador'), aiQuotaController.createQuota);

module.exports = router;
