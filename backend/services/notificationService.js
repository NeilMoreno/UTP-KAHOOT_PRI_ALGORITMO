'use strict';

// Notificaciones dentro de la app. Son informativas: crear una nunca debe romper la operación que la origina
// (por eso `notify` traga sus propios errores) y el texto lo arma siempre el servidor.

const { query } = require('../config/database');

const MAX_PER_USER = 40; // se conservan las más recientes

const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// db: { query } (el pool o el cliente de una transacción). Devuelve true si se creó.
const notify = async (db, { idUsuario, tipo, titulo, mensaje, enlace = null }) => {
    try {
        await db.query(
            `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje, enlace) VALUES ($1, $2, $3, $4, $5);`,
            [idUsuario, tipo, clip(titulo, 80), clip(mensaje, 200), enlace]
        );
        return true;
    } catch (error) {
        // En una transacción un error aborta el bloque: no se traga ahí, se relanza para no ocultar el fallo.
        if (db.release) throw error;
        return false;
    }
};

const notifyMany = async (db, ids, payload) => {
    let created = 0;
    for (const idUsuario of ids) if (await notify(db, { ...payload, idUsuario })) created += 1;
    return created;
};

const listNotifications = async (idUsuario, limit = 20) => {
    const [items, unread] = await Promise.all([
        query(
            `SELECT id_notificacion, tipo, titulo, mensaje, enlace, leida_en, fecha_creacion
               FROM notificacion WHERE id_usuario = $1 ORDER BY fecha_creacion DESC LIMIT $2;`,
            [idUsuario, Math.min(Math.max(Number(limit) || 20, 1), MAX_PER_USER)]
        ),
        query('SELECT count(*)::int AS total FROM notificacion WHERE id_usuario = $1 AND leida_en IS NULL;', [idUsuario])
    ]);
    return { data: items.rows, sin_leer: unread.rows[0].total };
};

// idNotificacion null = todas las del usuario.
const markRead = async (idUsuario, idNotificacion = null) => {
    const result = await query(
        `UPDATE notificacion SET leida_en = now()
          WHERE id_usuario = $1 AND leida_en IS NULL AND ($2::uuid IS NULL OR id_notificacion = $2::uuid);`,
        [idUsuario, idNotificacion]
    );
    return result.rowCount;
};

// Borra las más antiguas de un usuario (se llama al listar; mantiene la tabla acotada).
const prune = async (idUsuario) => query(
    `DELETE FROM notificacion WHERE id_usuario = $1 AND id_notificacion NOT IN (
        SELECT id_notificacion FROM notificacion WHERE id_usuario = $1 ORDER BY fecha_creacion DESC LIMIT $2);`,
    [idUsuario, MAX_PER_USER]
).catch(() => {});

module.exports = { notify, notifyMany, listNotifications, markRead, prune, MAX_PER_USER };
