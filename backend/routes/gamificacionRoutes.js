'use strict';

const express = require('express');
const { query } = require('../config/database');
const { listAchievementProgress } = require('../services/achievementService');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// Catálogo de logros con el avance del estudiante autenticado
router.get('/logros', authenticateJWT, authorizeRoles('estudiante'), async (req, res, next) => {
    try {
        const data = await listAchievementProgress({ query }, req.user.id_usuario);
        res.json({ success: true, total: data.length, data });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
