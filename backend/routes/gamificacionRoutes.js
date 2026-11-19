'use strict';

const express = require('express');
const { query } = require('../config/database');
const { listAchievementProgress } = require('../services/achievementService');
const { getStreak } = require('../services/streakService');
const { getWeeklyMissions } = require('../services/missionService');
const { getCourseRanking } = require('../services/rankingService');
const { getAuthorizedCourse } = require('../services/authorizationService');
const { buildReinforcement } = require('../services/reinforcementService');
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

// Refuerzo por errores de un curso (solo estudiantes matriculados; no usa IA)
router.get('/refuerzo/:id_curso', authenticateJWT, authorizeRoles('estudiante'), async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user);
        res.json({ success: true, data: await buildReinforcement(req.params.id_curso, req.user.id_usuario) });
    } catch (error) {
        next(error);
    }
});

// Racha diaria del estudiante autenticado
router.get('/racha', authenticateJWT, authorizeRoles('estudiante'), async (req, res, next) => {
    try {
        res.json({ success: true, ...(await getStreak({ query }, req.user.id_usuario)) });
    } catch (error) {
        next(error);
    }
});

// Misiones de la semana con su progreso y las piezas de avatar ganadas
router.get('/misiones', authenticateJWT, authorizeRoles('estudiante'), async (req, res, next) => {
    try {
        res.json({ success: true, ...(await getWeeklyMissions({ query }, req.user.id_usuario)) });
    } catch (error) {
        next(error);
    }
});

// Ranking de XP del curso (estudiante matriculado o docente dueño del curso)
router.get('/ranking/:id_curso', authenticateJWT, authorizeRoles('estudiante', 'docente', 'superadministrador'), async (req, res, next) => {
    try {
        await getAuthorizedCourse(req.params.id_curso, req.user);
        const data = await getCourseRanking({ query }, req.params.id_curso, req.user);
        res.json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
