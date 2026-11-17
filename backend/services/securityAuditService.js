'use strict';

const net = require('net');
const { query } = require('../config/database');

const normalizeIp = (value) => {
    if (typeof value !== 'string') return null;
    const candidate = value.trim();
    return net.isIP(candidate) ? candidate : null;
};

const getRequestIp = (req) => normalizeIp(req?.ip || req?.socket?.remoteAddress);

const recordSecurityEvent = async (executor, {
    actorId = null,
    institutionId = null,
    action,
    targetType = null,
    targetId = null,
    result = 'exitoso',
    ip = null,
    metadata = {}
}) => {
    const runQuery = executor && typeof executor.query === 'function'
        ? executor.query.bind(executor)
        : query;

    await runQuery(`
        INSERT INTO auditoria_seguridad (
            id_actor,
            id_institucion,
            accion,
            tipo_objetivo,
            id_objetivo,
            resultado,
            direccion_ip,
            metadatos
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb);
    `, [
        actorId,
        institutionId,
        action,
        targetType,
        targetId,
        result,
        normalizeIp(ip),
        JSON.stringify(metadata)
    ]);
};

module.exports = { getRequestIp, recordSecurityEvent };
