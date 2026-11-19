'use strict';

const express = require('express');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { listNotifications, markRead, prune } = require('../services/notificationService');
const { isUuid } = require('../utils/validation');
const { httpError } = require('../utils/httpError');

const router = express.Router();

// Las del usuario autenticado (la campana); cada usuario solo ve las suyas.
router.get('/', authenticateJWT, async (req, res, next) => {
    try {
        prune(req.user.id_usuario);
        res.json({ success: true, ...(await listNotifications(req.user.id_usuario)) });
    } catch (error) { next(error); }
});

// Marca todas como leídas
router.post('/leer', authenticateJWT, async (req, res, next) => {
    try {
        res.json({ success: true, marcadas: await markRead(req.user.id_usuario) });
    } catch (error) { next(error); }
});

// Marca una como leída
router.post('/:id_notificacion/leer', authenticateJWT, async (req, res, next) => {
    try {
        if (!isUuid(req.params.id_notificacion)) throw httpError(400, 'Identificador no válido.', 'INVALID_ID');
        res.json({ success: true, marcadas: await markRead(req.user.id_usuario, req.params.id_notificacion) });
    } catch (error) { next(error); }
});

module.exports = router;
