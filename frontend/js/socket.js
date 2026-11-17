// Cliente Socket.IO bajo demanda y utilidades de errores de las salas.
// El script ESM lo sirve el propio backend en /socket.io/socket.io.esm.min.js,
// por lo que la CSP estricta lo permite como recurso del mismo origen.
import { tokenStore } from './api.js';

let clientPromise = null;

export async function loadSocketClient() {
    if (!clientPromise) {
        clientPromise = import('/socket.io/socket.io.esm.min.js')
            .then((module) => module.io || module.default)
            .catch((error) => {
                clientPromise = null;
                throw error;
            });
    }
    return clientPromise;
}

export async function createKahootSocket() {
    const io = await loadSocketClient();
    return io({
        auth: { token: tokenStore.get() },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 900,
        reconnectionDelayMax: 5000
    });
}

export const CONNECT_ERROR_MESSAGES = {
    AUTHENTICATION_REQUIRED: 'Tu sesión expiró. Inicia sesión de nuevo.',
    INVALID_TOKEN: 'Tu sesión no es válida. Inicia sesión de nuevo.',
    TOKEN_EXPIRED: 'Tu sesión expiró. Inicia sesión de nuevo.',
    SESSION_REVOKED: 'Tu sesión fue cerrada. Inicia sesión de nuevo.',
    ACCOUNT_NOT_ACTIVE: 'Tu cuenta no está activa. Contacta a tu docente.',
    INSTITUTION_INACTIVE: 'La institución de tu cuenta está inactiva. Contacta a la administración.',
    AUTH_UNAVAILABLE: 'No se pudo validar tu sesión. Intenta de nuevo en unos segundos.'
};

export const ROOM_ERROR_MESSAGES = {
    PIN_INVALIDO: 'El PIN debe tener exactamente 6 dígitos.',
    SALA_NO_ENCONTRADA: 'La sala ya no está disponible.',
    SALA_NO_ENCONTRADA_O_INACTIVA: 'La sala no existe, ya se cerró o el docente todavía no la abrió.',
    SALA_NO_ENCONTRADA_O_NO_RECUPERABLE: 'La sala no existe o ya no se puede recuperar.',
    SALA_NO_DISPONIBLE: 'La sala ya no está disponible.',
    NICK_EN_USO: 'Ese apodo ya está en uso en esta sala. Elige otro.',
    LA_PARTIDA_YA_HA_COMENZADO: 'La partida ya comenzó y no puedes unirte ahora.',
    LA_SALA_YA_FUE_INICIADA: 'La partida ya fue iniciada.',
    ESTUDIANTE_NO_MATRICULADO_EN_EL_CURSO: 'No estás matriculado en el curso de esta sala.',
    SOLO_ESTUDIANTES_PUEDEN_UNIRSE: 'Solo los estudiantes pueden unirse a una sala.',
    SOLO_DOCENTES_PUEDEN_CREAR_SALAS: 'Solo los docentes pueden crear salas.',
    SOLO_DOCENTES_PUEDEN_ANFITRIONAR_SALAS: 'Solo el docente anfitrión puede controlar esta sala.',
    SOLO_EL_DOCENTE_ANFITRION_PUEDE_REALIZAR_ESTA_ACCION: 'Solo el docente anfitrión puede controlar esta sala.',
    SIN_PARTICIPANTES: 'Necesitas al menos un estudiante conectado para iniciar.',
    NO_HAY_PREGUNTA_ACTIVA_EN_ESTE_MOMENTO: 'No hay una pregunta activa en este momento.',
    LA_PREGUNTA_ACTUAL_AUN_NO_TERMINA: 'La pregunta actual todavía no ha terminado.',
    YA_ENVIASTE_TU_RESPUESTA_A_ESTA_PREGUNTA: 'Ya enviaste tu respuesta a esta pregunta.',
    OPCION_INVALIDA: 'La opción seleccionada no es válida.',
    NO_ERES_PARTICIPANTE_DE_ESTA_SALA: 'No eres participante de esta sala.',
    DEMASIADOS_EVENTOS: 'Demasiadas acciones seguidas. Espera un momento.',
    DEMASIADAS_SALAS_ACTIVAS: 'Ya tienes 5 salas abiertas. Cierra una antes de crear otra.',
    ERROR_INTERNO: 'Ocurrió un error inesperado. Intenta de nuevo.'
};

export const connectErrorMessage = (error) => {
    const code = typeof error === 'string' ? error : error?.message;
    return CONNECT_ERROR_MESSAGES[code] || 'No se pudo conectar con el servidor de la sala.';
};

export const roomErrorMessage = (result, fallback = 'No se pudo completar la acción.') => {
    if (!result) return fallback;
    if (result.message) return result.message;
    return ROOM_ERROR_MESSAGES[result.error] || fallback;
};

// Envuelve un emit con ack para poder usar await y capturar errores de la sala.
export const emitAck = (socket, event, data = {}) => new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ success: false, error: 'ERROR_INTERNO', message: 'El servidor no respondió a tiempo.' });
    }, 12000);

    socket.emit(event, data, (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result || { success: false, error: 'ERROR_INTERNO' });
    });
});
