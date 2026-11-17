'use strict';

const crypto = require('crypto');

/**
 * Genera un código PIN aleatorio de 6 dígitos numéricos (100000 - 999999).
 * @returns {string} PIN de 6 dígitos.
 */
const generateRoomPin = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Calcula el puntaje de una respuesta en una partida estilo Kahoot.
 * Fórmula oficial de codeInt (PLAN_CODEINT.md):
 * puntaje = round( puntos_base * ( 1 - tiempo_respuesta_seg / (2 * tiempo_limite_seg) ) )
 *
 * Si la respuesta es incorrecta o excede el tiempo límite, el puntaje es 0.
 *
 * @param {Object} params
 * @param {boolean} params.isCorrect - Si la respuesta elegida es correcta.
 * @param {number} params.tiempoRespuestaSeg - Tiempo de respuesta en segundos (puede ser decimal).
 * @param {number} [params.tiempoLimiteSeg=30] - Tiempo límite de la pregunta en segundos.
 * @param {number} [params.puntosBase=1000] - Puntos base de la pregunta.
 * @returns {number} Puntaje entero (0 a puntosBase).
 */
const calculateKahootScore = ({
    isCorrect,
    tiempoRespuestaSeg,
    tiempoLimiteSeg = 30,
    puntosBase = 1000
}) => {
    if (!isCorrect) return 0;

    const base = Number.isInteger(puntosBase) && puntosBase >= 0 ? puntosBase : 1000;
    const limite = Number.isInteger(tiempoLimiteSeg) && tiempoLimiteSeg > 0 ? tiempoLimiteSeg : 30;
    const tiempo = typeof tiempoRespuestaSeg === 'number' && !Number.isNaN(tiempoRespuestaSeg)
        ? Math.max(0, tiempoRespuestaSeg)
        : limite;

    if (tiempo > limite) {
        return 0;
    }

    const ratio = tiempo / (2 * limite);
    const score = Math.round(base * (1 - ratio));

    return Math.max(0, Math.min(base, score));
};

/**
 * Recompensas de XP al cerrar la partida (podio y participación).
 */
const XP_PODIUM_REWARDS = Object.freeze({
    1: 150,
    2: 100,
    3: 50,
    PARTICIPATION: 20
});

/**
 * Ordena participantes por puntaje descendente. El empate se resuelve por el
 * menor tiempo total de respuesta y, en última instancia, por el apodo, de modo
 * que el ranking sea determinista. No modifica el arreglo recibido.
 */
const rankParticipants = (participants) => [...participants].sort((a, b) => (
    (b.puntajeTotal - a.puntajeTotal)
    || ((a.tiempoTotalMs || 0) - (b.tiempoTotalMs || 0))
    || String(a.nombre).localeCompare(String(b.nombre), 'es')
));

/**
 * XP de cierre para una posición. Quien no respondió ninguna pregunta no recibe XP.
 */
const calculatePodiumXp = (position, answeredCount) => {
    if (!(answeredCount > 0)) return 0;
    return XP_PODIUM_REWARDS[position] || XP_PODIUM_REWARDS.PARTICIPATION;
};

module.exports = {
    XP_PODIUM_REWARDS,
    generateRoomPin,
    calculateKahootScore,
    rankParticipants,
    calculatePodiumXp
};
