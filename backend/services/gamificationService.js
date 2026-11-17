// ==============================================================
// codeInt - Servicio de Gamificación (Cálculo Dinámico de XP y Niveles)
// Universidad Tecnológica del Perú (UTP) - 2026
// ==============================================================

const { query } = require('../config/database');

/**
 * Obtiene el total de XP acumulado por un estudiante
 * @param {string} id_estudiante - UUID del estudiante
 * @returns {Promise<number>}
 */
const getEstudianteTotalXP = async (id_estudiante) => {
    const sql = `
        SELECT COALESCE(SUM(cantidad), 0)::INTEGER AS total_xp
        FROM xp_movimiento
        WHERE id_estudiante = $1;
    `;
    const result = await query(sql, [id_estudiante]);
    return result.rows[0].total_xp || 0;
};

/**
 * Calcula dinámicamente el nivel actual y progreso al siguiente nivel
 * según la tabla de niveles y el XP acumulado
 * @param {number} totalXP - Puntos de experiencia
 * @returns {Promise<Object>}
 */
const calculateNivelFromXP = async (totalXP) => {
    // Obtener catálogo de niveles ordenados de forma ascendente
    const sql = `
        SELECT id_nivel, numero, nombre, xp_requerido
        FROM nivel
        ORDER BY numero ASC;
    `;
    const result = await query(sql);
    const niveles = result.rows;

    if (niveles.length === 0) {
        return {
            nivel_actual: 1,
            nombre_nivel: 'Novato',
            xp_actual: totalXP,
            xp_siguiente_nivel: 300,
            porcentaje_progreso: 0,
            xp_faltante: 300
        };
    }

    let nivelActual = niveles[0];
    let siguienteNivel = null;

    for (let i = 0; i < niveles.length; i++) {
        if (totalXP >= niveles[i].xp_requerido) {
            nivelActual = niveles[i];
            siguienteNivel = niveles[i + 1] || null;
        } else {
            break;
        }
    }

    let porcentaje = 100;
    let xpFaltante = 0;

    if (siguienteNivel) {
        const xpRango = siguienteNivel.xp_requerido - nivelActual.xp_requerido;
        const xpGanadoEnNivel = totalXP - nivelActual.xp_requerido;
        porcentaje = Math.min(100, Math.max(0, Math.round((xpGanadoEnNivel / xpRango) * 100)));
        xpFaltante = Math.max(0, siguienteNivel.xp_requerido - totalXP);
    }

    return {
        nivel_actual: nivelActual.numero,
        nombre_nivel: nivelActual.nombre,
        id_nivel: nivelActual.id_nivel,
        xp_total: totalXP,
        xp_nivel_base: nivelActual.xp_requerido,
        siguiente_nivel: siguienteNivel ? {
            numero: siguienteNivel.numero,
            nombre: siguienteNivel.nombre,
            xp_requerido: siguienteNivel.xp_requerido
        } : null,
        porcentaje_progreso: porcentaje,
        xp_faltante: xpFaltante
    };
};

/**
 * Obtiene el resumen de gamificación completo del estudiante
 * @param {string} id_estudiante
 */
const getEstudianteGamificationSummary = async (id_estudiante) => {
    const totalXP = await getEstudianteTotalXP(id_estudiante);
    const nivelInfo = await calculateNivelFromXP(totalXP);

    // Contar logros obtenidos
    const logrosSql = `
        SELECT count(*)::INTEGER AS total_logros
        FROM estudiante_logro
        WHERE id_estudiante = $1;
    `;
    const logrosRes = await query(logrosSql, [id_estudiante]);

    // Contar ejercicios aprobados (evaluaciones con puntaje >= 70)
    const ejerciciosSql = `
        SELECT count(*)::INTEGER AS aprobados
        FROM evaluacion_ia
        WHERE id_estudiante = $1 AND puntaje >= 70;
    `;
    const ejRes = await query(ejerciciosSql, [id_estudiante]);

    return {
        ...nivelInfo,
        total_logros_desbloqueados: logrosRes.rows[0].total_logros || 0,
        total_ejercicios_aprobados: ejRes.rows[0].aprobados || 0
    };
};

module.exports = {
    getEstudianteTotalXP,
    calculateNivelFromXP,
    getEstudianteGamificationSummary
};
