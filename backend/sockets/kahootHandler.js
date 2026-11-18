'use strict';

// ==============================================================
// codeInt - Motor Kahoot Multijugador en Tiempo Real (Socket.io)
// Universidad Tecnológica del Perú (UTP) - 2026
//
// El estado de la partida vive en memoria (activeRooms) para baja latencia y se
// persiste en PostgreSQL: respuestas al instante y resultados/XP al cerrar.
// Es un diseño de una sola instancia: no escalar horizontalmente sin un adaptador.
// ==============================================================

const { query, getClient } = require('../config/database');
const { loadUserFromToken } = require('../middleware/authMiddleware');
const {
    XP_PODIUM_REWARDS,
    calculateKahootScore,
    rankParticipants,
    calculatePodiumXp
} = require('../utils/kahootScoring');
const { createRoom, loadWaitingRoom } = require('../services/salaService');
const { unlockAchievements } = require('../services/achievementService');
const { resolveAvatar } = require('../utils/avatarCatalog');

// Map<pin, RoomState>
const activeRooms = new Map();

// Map<socketId, { pin, userId, role: 'host' | 'player' }>
const socketRegistry = new Map();

const ANSWER_GRACE_MS = 1200; // margen de red tras el tiempo límite
const MAX_ACTIVE_ROOMS_PER_TEACHER = 5;
const EVENT_WINDOW_MS = 10000;
const EVENT_LIMIT_PER_WINDOW = 60;
const NICK_MAX_LENGTH = 30;
const CLOSED_STATES = new Set(['finalizando', 'finalizada', 'cancelada']);

const positiveIntEnv = (name, fallback) => {
    const parsed = Number.parseInt(process.env[name], 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const countdownSeconds = () => positiveIntEnv('KAHOOT_COUNTDOWN_SECONDS', 3);
const hostGraceMs = () => positiveIntEnv('KAHOOT_HOST_GRACE_MS', 10 * 60 * 1000);
const closedRoomTtlMs = () => positiveIntEnv('KAHOOT_CLOSED_ROOM_TTL_MS', 10 * 60 * 1000);

// Error esperado de la lógica de salas: su código se devuelve tal cual al cliente.
class RoomError extends Error {
    constructor(code) {
        super(code);
        this.code = code;
    }
}

const roomChannel = (room) => `room:${room.pin}`;
const hostChannel = (room) => `host:${room.pin}`;

const cleanPin = (value) => {
    const pin = (value === undefined || value === null ? '' : String(value)).trim();
    if (!/^\d{6}$/.test(pin)) throw new RoomError('PIN_INVALIDO');
    return pin;
};

const sanitizeNick = (value, fallback) => {
    const clean = (text) => String(text || '')
        .replace(/[\u0000-\u001f\u007f<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, NICK_MAX_LENGTH);
    return clean(value) || clean(fallback) || 'Estudiante';
};

/**
 * Autenticación de Socket.io: mismas reglas que el API REST (firma, emisor,
 * audiencia, sesión no revocada, correo verificado y cuenta activa).
 */
const socketAuthMiddleware = async (socket, next) => {
    try {
        const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
        if (typeof rawToken !== 'string' || rawToken.trim() === '') {
            return next(new Error('AUTHENTICATION_REQUIRED'));
        }
        const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7).trim() : rawToken.trim();
        socket.data.user = await loadUserFromToken(token);
        return next();
    } catch (err) {
        if (err.status === 401 || err.status === 403) return next(new Error(err.code || 'INVALID_TOKEN'));
        console.error(`[Kahoot] Error autenticando socket: ${err.message}`);
        return next(new Error('AUTH_UNAVAILABLE'));
    }
};

// Límite de eventos por socket para frenar inundaciones desde un cliente.
const allowEvent = (socket) => {
    const now = Date.now();
    const bucket = socket.data.eventBucket;
    if (!bucket || now >= bucket.resetAt) {
        socket.data.eventBucket = { count: 1, resetAt: now + EVENT_WINDOW_MS };
        return true;
    }
    bucket.count++;
    return bucket.count <= EVENT_LIMIT_PER_WINDOW;
};

const safeHandler = (socket, event, handler) => {
    socket.on(event, async (data, callback) => {
        const cb = typeof callback === 'function' ? callback : () => {};
        try {
            if (!allowEvent(socket)) throw new RoomError('DEMASIADOS_EVENTOS');
            const payload = await handler(data && typeof data === 'object' ? data : {});
            cb({ success: true, ...(payload || {}) });
        } catch (err) {
            if (err instanceof RoomError) return cb({ success: false, error: err.code });
            if (err.status && err.status < 500) {
                return cb({ success: false, error: err.code || 'SOLICITUD_INVALIDA', message: err.message });
            }
            console.error(`[Kahoot] Error en ${event}: ${err.message}`);
            cb({ success: false, error: 'ERROR_INTERNO' });
        }
    });
};

const buildRoomState = (descriptor, hostSocketId) => ({
    id_sala: descriptor.id_sala,
    pin: descriptor.pin,
    id_curso: descriptor.id_curso,
    id_docente: descriptor.id_docente,
    curso_nombre: descriptor.curso_nombre,
    estado: 'espera',
    hostSocketId,
    preguntas: descriptor.preguntas,
    preguntaActualIndex: -1,
    fechaAperturaPregunta: null,
    timer: null,
    countdownTimer: null,
    hostGraceTimer: null,
    questionToken: 0,
    finishing: false,
    participantes: new Map(),
    respuestasActuales: new Set()
});

const clearRoundTimers = (room) => {
    if (room.timer) clearTimeout(room.timer);
    if (room.countdownTimer) clearInterval(room.countdownTimer);
    room.timer = null;
    room.countdownTimer = null;
};

const questionPayload = (room, q, index) => ({
    id_pregunta: q.id_pregunta,
    numero: index + 1,
    total: room.preguntas.length,
    enunciado: q.enunciado,
    tiempo_limite_seg: q.tiempo_limite_seg,
    puntos_base: q.puntos_base,
    opciones: q.opciones.map((opt) => ({
        id_opcion: opt.id_opcion,
        etiqueta: opt.etiqueta,
        texto: opt.texto // nunca se envía es_correcta antes del cierre de la pregunta
    }))
});

const playerList = (room) => Array.from(room.participantes.values()).map((p) => ({
    id_participante: p.id_participante,
    nick: p.nombre,
    avatar: p.avatar,
    conectado: Boolean(p.socketId)
}));

// Estado actual de la sala para quien se (re)conecta a mitad de la partida.
const buildSnapshot = (room, participant = null) => {
    const index = room.preguntaActualIndex;
    const q = room.preguntas[index];
    const open = room.estado === 'pregunta' && q;
    return {
        pin: room.pin,
        estado: room.estado,
        totalPreguntas: room.preguntas.length,
        numero: index + 1,
        jugadores: participant ? undefined : playerList(room),
        pregunta: open ? {
            ...questionPayload(room, q, index),
            tiempo_restante_ms: Math.max(0, q.tiempo_limite_seg * 1000 - (Date.now() - room.fechaAperturaPregunta))
        } : null,
        yaRespondio: participant && q ? participant.respuestas.has(q.id_pregunta) : undefined
    };
};

/**
 * Inicia la cuenta regresiva y luego la presentación de una pregunta.
 */
const startQuestion = (io, room, questionIndex) => {
    if (questionIndex >= room.preguntas.length) {
        return finishGame(io, room);
    }

    clearRoundTimers(room);
    const token = ++room.questionToken;
    room.preguntaActualIndex = questionIndex;
    room.estado = 'countdown';
    room.respuestasActuales.clear();

    const q = room.preguntas[questionIndex];
    const total = room.preguntas.length;
    let count = countdownSeconds();

    const emitCountdown = () => io.to(roomChannel(room)).emit('question:countdown', {
        count,
        numero: questionIndex + 1,
        total
    });

    const openQuestion = () => {
        if (room.questionToken !== token || room.estado !== 'countdown') return;
        room.estado = 'pregunta';
        room.fechaAperturaPregunta = Date.now();

        io.to(roomChannel(room)).emit('question:show', {
            ...questionPayload(room, q, questionIndex),
            servidor_ts: room.fechaAperturaPregunta
        });

        query(
            `UPDATE sala_multijugador
                SET id_pregunta_activa = $1, fecha_apertura_pregunta = now()
              WHERE id_sala = $2`,
            [q.id_pregunta, room.id_sala]
        ).catch((err) => console.error(`[Kahoot] Error actualizando pregunta activa: ${err.message}`));

        // El cronómetro de la verdad es el del servidor.
        room.timer = setTimeout(() => endQuestion(io, room), q.tiempo_limite_seg * 1000 + ANSWER_GRACE_MS);
    };

    emitCountdown();
    room.countdownTimer = setInterval(() => {
        count--;
        if (count > 0) return emitCountdown();
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        openQuestion();
    }, 1000);
};

/**
 * Cierra la pregunta activa, calcula estadísticas y ranking parcial.
 */
const endQuestion = (io, room) => {
    if (room.estado !== 'pregunta') return;
    clearRoundTimers(room);
    room.estado = 'estadisticas_pregunta';

    const q = room.preguntas[room.preguntaActualIndex];
    const correctOption = q.opciones.find((opt) => opt.es_correcta);

    const stats = { sin_responder: 0 };
    for (const opt of q.opciones) stats[opt.etiqueta] = 0;

    const ranked = rankParticipants(Array.from(room.participantes.values()));
    ranked.forEach((p, idx) => {
        p.posicionActual = idx + 1;
        const answer = p.respuestas.get(q.id_pregunta);
        const opt = answer && q.opciones.find((o) => o.id_opcion === answer.id_opcion);
        if (opt) stats[opt.etiqueta]++;
        else stats.sin_responder++;
    });

    io.to(hostChannel(room)).emit('question:results', {
        id_pregunta: q.id_pregunta,
        numero: room.preguntaActualIndex + 1,
        total: room.preguntas.length,
        opcion_correcta: correctOption ? {
            id_opcion: correctOption.id_opcion,
            etiqueta: correctOption.etiqueta,
            texto: correctOption.texto
        } : null,
        stats,
        ranking: ranked.slice(0, 5).map((p) => ({
            posicion: p.posicionActual,
            nick: p.nombre,
            avatar: p.avatar,
            puntaje: p.puntajeTotal
        })),
        esUltimaPregunta: room.preguntaActualIndex >= room.preguntas.length - 1
    });

    for (const p of ranked) {
        if (!p.socketId) continue;
        const answer = p.respuestas.get(q.id_pregunta);
        io.to(p.socketId).emit('answer:result', {
            correct: answer ? answer.es_correcta : false,
            puntaje: answer ? answer.puntos : 0,
            puntajeTotal: p.puntajeTotal,
            posicion: p.posicionActual,
            opcionCorrecta: correctOption ? correctOption.etiqueta : null
        });
    }
};

/**
 * Persiste en una sola transacción el cierre de la sala, las posiciones, el XP
 * y los logros de cada participante.
 */
const persistResults = async (room, ranked, gameStarted) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE sala_multijugador
                SET estado = $2, fecha_fin = now(), id_pregunta_activa = NULL
              WHERE id_sala = $1`,
            [room.id_sala, gameStarted ? 'finalizada' : 'cancelada']
        );
        if (gameStarted) {
            for (const p of ranked) {
                await client.query(
                    `UPDATE participante_sala
                        SET puntaje_final = $1, posicion_final = $2
                      WHERE id_participante = $3`,
                    [p.puntajeTotal, p.posicionFinal, p.id_participante]
                );
                if (p.xpGanado > 0) {
                    await client.query(
                        `INSERT INTO xp_movimiento (
                            id_estudiante, id_curso, id_participante_sala, cantidad, origen
                        ) VALUES ($1, $2, $3, $4, 'participante_sala')
                        ON CONFLICT (id_participante_sala) WHERE id_participante_sala IS NOT NULL DO NOTHING`,
                        [p.id_estudiante, room.id_curso, p.id_participante, p.xpGanado]
                    );
                }
                p.logros = await unlockAchievements(client, p.id_estudiante);
            }
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
};

const scheduleRoomCleanup = (room) => {
    const timer = setTimeout(() => {
        if (activeRooms.get(room.pin) === room) activeRooms.delete(room.pin);
        for (const [socketId, reg] of socketRegistry) {
            if (reg.pin === room.pin) socketRegistry.delete(socketId);
        }
    }, closedRoomTtlMs());
    timer.unref();
};

/**
 * Concluye la partida. Si nunca comenzó se cancela sin repartir XP.
 * Es idempotente: varios cierres simultáneos solo se ejecutan una vez.
 */
const finishGame = async (io, room) => {
    if (room.finishing || CLOSED_STATES.has(room.estado)) return;
    room.finishing = true;
    room.estado = 'finalizando'; // rechaza respuestas mientras se persiste
    room.questionToken++;
    clearRoundTimers(room);
    if (room.hostGraceTimer) {
        clearTimeout(room.hostGraceTimer);
        room.hostGraceTimer = null;
    }

    const gameStarted = room.preguntaActualIndex >= 0;
    const ranked = rankParticipants(Array.from(room.participantes.values()));
    ranked.forEach((p, idx) => {
        p.posicionFinal = idx + 1;
        p.xpGanado = gameStarted ? calculatePodiumXp(idx + 1, p.respuestas.size) : 0;
        p.logros = [];
    });

    let persisted = true;
    try {
        await persistResults(room, ranked, gameStarted);
    } catch (err) {
        persisted = false;
        console.error(`[Kahoot] Error guardando resultados de la sala ${room.id_sala}: ${err.message}`);
        ranked.forEach((p) => { p.xpGanado = 0; p.logros = []; });
    }

    room.estado = gameStarted ? 'finalizada' : 'cancelada';

    if (!gameStarted) {
        io.to(roomChannel(room)).emit('room:cancelled', { pin: room.pin });
    } else {
        const rankingCompleto = ranked.map((p, idx) => ({
            puesto: idx + 1,
            nick: p.nombre,
            avatar: p.avatar,
            puntaje: p.puntajeTotal,
            xpGanado: p.xpGanado
        }));
        const podio = rankingCompleto.slice(0, 3);

        io.to(hostChannel(room)).emit('game:podium', { podio, rankingCompleto, resultados_guardados: persisted });
        for (const p of ranked) {
            if (!p.socketId) continue;
            io.to(p.socketId).emit('game:podium', {
                tuPuesto: p.posicionFinal,
                tuPuntaje: p.puntajeTotal,
                xpGanado: p.xpGanado,
                logros_desbloqueados: p.logros,
                podio,
                resultados_guardados: persisted
            });
        }
    }

    scheduleRoomCleanup(room);
};

const bindHost = (socket, room) => {
    if (room.hostGraceTimer) {
        clearTimeout(room.hostGraceTimer);
        room.hostGraceTimer = null;
    }
    room.hostSocketId = socket.id;
    socketRegistry.set(socket.id, { pin: room.pin, userId: socket.data.user.id_usuario, role: 'host' });
    socket.join(roomChannel(room));
    socket.join(hostChannel(room));
};

const assertHost = (room, user) => {
    if (room.id_docente !== user.id_usuario && user.rol !== 'superadministrador') {
        throw new RoomError('SOLO_EL_DOCENTE_ANFITRION_PUEDE_REALIZAR_ESTA_ACCION');
    }
};

const resolveHostRoom = (socket, data) => {
    const reg = socketRegistry.get(socket.id);
    const pin = data.pin !== undefined ? cleanPin(data.pin) : reg?.pin;
    const room = pin && activeRooms.get(pin);
    if (!room) throw new RoomError('SALA_NO_ENCONTRADA');
    assertHost(room, socket.data.user);
    return room;
};

/**
 * Configura los manejadores de eventos WebSocket de Kahoot en Socket.io
 * @param {import('socket.io').Server} io
 */
const setupKahootSockets = (io) => {
    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
        const user = socket.data.user;

        // 1. Docente crea y abre una sala nueva (room:create)
        safeHandler(socket, 'room:create', async (data) => {
            if (user.rol !== 'docente' && user.rol !== 'superadministrador') {
                throw new RoomError('SOLO_DOCENTES_PUEDEN_CREAR_SALAS');
            }
            const openRooms = Array.from(activeRooms.values())
                .filter((r) => r.id_docente === user.id_usuario && !CLOSED_STATES.has(r.estado)).length;
            if (openRooms >= MAX_ACTIVE_ROOMS_PER_TEACHER) throw new RoomError('DEMASIADAS_SALAS_ACTIVAS');

            const descriptor = await createRoom(user, data.id_curso || data.cursoId, data.preguntas);
            const room = buildRoomState(descriptor, socket.id);
            activeRooms.set(room.pin, room);
            bindHost(socket, room);

            const responseData = {
                id_sala: room.id_sala,
                pin: room.pin,
                totalPreguntas: room.preguntas.length,
                curso: room.curso_nombre
            };
            socket.emit('room:created', responseData);
            return { data: responseData };
        });

        // 2. Docente activa una sala preparada por REST o recupera el control tras reconectarse (room:host)
        safeHandler(socket, 'room:host', async (data) => {
            if (user.rol !== 'docente' && user.rol !== 'superadministrador') {
                throw new RoomError('SOLO_DOCENTES_PUEDEN_ANFITRIONAR_SALAS');
            }
            const pin = cleanPin(data.pin);
            let room = activeRooms.get(pin);
            if (!room) {
                const descriptor = await loadWaitingRoom(user, pin);
                if (!descriptor) throw new RoomError('SALA_NO_ENCONTRADA_O_NO_RECUPERABLE');
                room = activeRooms.get(pin) || buildRoomState(descriptor, socket.id);
                activeRooms.set(pin, room);
            }
            assertHost(room, user);
            if (CLOSED_STATES.has(room.estado)) throw new RoomError('SALA_NO_DISPONIBLE');

            bindHost(socket, room);
            const snapshot = buildSnapshot(room);
            socket.emit('room:state', snapshot);
            return { data: { id_sala: room.id_sala, ...snapshot } };
        });

        // 3. Estudiante se une (o se reconecta) a una sala (room:join)
        safeHandler(socket, 'room:join', async (data) => {
            if (user.rol !== 'estudiante') throw new RoomError('SOLO_ESTUDIANTES_PUEDEN_UNIRSE');
            const pin = cleanPin(data.pin);
            const room = activeRooms.get(pin);
            if (!room) throw new RoomError('SALA_NO_ENCONTRADA_O_INACTIVA');
            if (CLOSED_STATES.has(room.estado)) throw new RoomError('SALA_NO_DISPONIBLE');

            let participant = room.participantes.get(user.id_usuario);
            if (!participant && room.estado !== 'espera') throw new RoomError('LA_PARTIDA_YA_HA_COMENZADO');

            const nickTaken = (nick) => Array.from(room.participantes.values()).some(
                (p) => p.id_estudiante !== user.id_usuario && p.nombre.toLowerCase() === nick.toLowerCase()
            );
            let isNew = false;

            if (!participant) {
                const nick = sanitizeNick(data.nick, user.nombre);
                if (nickTaken(nick)) throw new RoomError('NICK_EN_USO');

                // Matrícula activa en el curso de la sala (aislamiento por curso/institución)
                const enrollment = await query(
                    `SELECT id_matricula FROM matricula
                      WHERE id_curso = $1 AND id_estudiante = $2 AND estado = 'activa'`,
                    [room.id_curso, user.id_usuario]
                );
                if (enrollment.rowCount === 0) throw new RoomError('ESTUDIANTE_NO_MATRICULADO_EN_EL_CURSO');

                const stored = await query(
                    `INSERT INTO participante_sala (id_sala, id_matricula, id_estudiante, id_curso)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (id_sala, id_estudiante) DO UPDATE SET fecha_ingreso = now()
                     RETURNING id_participante`,
                    [room.id_sala, enrollment.rows[0].id_matricula, user.id_usuario, room.id_curso]
                );

                // El estado pudo cambiar mientras se esperaba a PostgreSQL.
                participant = room.participantes.get(user.id_usuario);
                if (!participant) {
                    if (room.estado !== 'espera') throw new RoomError('LA_PARTIDA_YA_HA_COMENZADO');
                    if (nickTaken(nick)) throw new RoomError('NICK_EN_USO');
                    participant = {
                        id_participante: stored.rows[0].id_participante,
                        id_estudiante: user.id_usuario,
                        id_matricula: enrollment.rows[0].id_matricula,
                        nombre: nick,
                        avatar: resolveAvatar(user.avatar_config, user.id_usuario),
                        socketId: null,
                        puntajeTotal: 0,
                        tiempoTotalMs: 0,
                        posicionActual: 0,
                        posicionFinal: 0,
                        xpGanado: 0,
                        logros: [],
                        respuestas: new Map()
                    };
                    room.participantes.set(user.id_usuario, participant);
                    isNew = true;
                }
            }

            // Una sola conexión activa por estudiante: la anterior queda reemplazada.
            if (participant.socketId && participant.socketId !== socket.id) {
                const previous = io.sockets.sockets.get(participant.socketId);
                socketRegistry.delete(participant.socketId);
                if (previous) {
                    previous.leave(roomChannel(room));
                    previous.emit('room:replaced', { pin });
                }
            }
            participant.socketId = socket.id;
            socketRegistry.set(socket.id, { pin, userId: user.id_usuario, role: 'player' });
            socket.join(roomChannel(room));

            const joinedData = {
                id_sala: room.id_sala,
                pin,
                id_participante: participant.id_participante,
                nick: participant.nombre,
                curso: room.curso_nombre,
                totalPlayers: room.participantes.size
            };
            socket.emit('room:joined_success', joinedData);

            if (isNew) {
                io.to(hostChannel(room)).emit('player:joined', {
                    id_participante: participant.id_participante,
                    id_estudiante: user.id_usuario,
                    nick: participant.nombre,
                    avatar: participant.avatar,
                    totalPlayers: room.participantes.size
                });
            } else {
                io.to(hostChannel(room)).emit('player:reconnected', { nick: participant.nombre });
            }
            if (room.estado !== 'espera') socket.emit('room:state', buildSnapshot(room, participant));

            return { data: joinedData };
        });

        // 4. Docente inicia la partida (game:start)
        safeHandler(socket, 'game:start', async (data) => {
            const room = resolveHostRoom(socket, data);
            if (room.estado !== 'espera') throw new RoomError('LA_SALA_YA_FUE_INICIADA');
            if (room.participantes.size === 0) throw new RoomError('SIN_PARTICIPANTES');

            room.estado = 'en_curso'; // se marca de inmediato para evitar un doble inicio
            try {
                await query(
                    `UPDATE sala_multijugador SET estado = 'en_curso', fecha_inicio = now() WHERE id_sala = $1`,
                    [room.id_sala]
                );
            } catch (err) {
                room.estado = 'espera';
                throw err;
            }

            io.to(roomChannel(room)).emit('game:started', { totalPreguntas: room.preguntas.length });
            startQuestion(io, room, 0);
        });

        // 5. Estudiante envía su respuesta (answer:submit)
        safeHandler(socket, 'answer:submit', async (data) => {
            const reg = socketRegistry.get(socket.id);
            const room = reg && reg.role === 'player' ? activeRooms.get(reg.pin) : null;
            if (!room || room.estado !== 'pregunta') throw new RoomError('NO_HAY_PREGUNTA_ACTIVA_EN_ESTE_MOMENTO');

            const participant = room.participantes.get(user.id_usuario);
            if (!participant || participant.socketId !== socket.id) {
                throw new RoomError('NO_ERES_PARTICIPANTE_DE_ESTA_SALA');
            }

            const q = room.preguntas[room.preguntaActualIndex];
            if (participant.respuestas.has(q.id_pregunta)) {
                throw new RoomError('YA_ENVIASTE_TU_RESPUESTA_A_ESTA_PREGUNTA');
            }
            const selected = q.opciones.find((o) => o.id_opcion === (data.id_opcion || data.opcionId));
            if (!selected) throw new RoomError('OPCION_INVALIDA');

            // Tiempo medido por el servidor, nunca por el cliente.
            const elapsedMs = Math.max(0, Date.now() - room.fechaAperturaPregunta);
            const score = calculateKahootScore({
                isCorrect: selected.es_correcta === true,
                tiempoRespuestaSeg: elapsedMs / 1000,
                tiempoLimiteSeg: q.tiempo_limite_seg,
                puntosBase: q.puntos_base
            });

            // Todo el estado en memoria se actualiza antes de cualquier await: dos envíos
            // simultáneos del mismo jugador no pueden puntuar dos veces.
            participant.respuestas.set(q.id_pregunta, {
                id_opcion: selected.id_opcion,
                es_correcta: selected.es_correcta === true,
                tiempo_ms: elapsedMs,
                puntos: score
            });
            participant.puntajeTotal += score;
            participant.tiempoTotalMs += elapsedMs;
            room.respuestasActuales.add(user.id_usuario);

            io.to(hostChannel(room)).emit('answers:update_count', {
                count: room.respuestasActuales.size,
                totalPlayers: room.participantes.size
            });

            // Si todos respondieron, la pregunta se cierra anticipadamente.
            if (room.respuestasActuales.size >= room.participantes.size) endQuestion(io, room);

            try {
                await query(
                    `INSERT INTO respuesta_sala (
                        id_participante, id_pregunta, id_opcion, id_sala, tiempo_respuesta, puntaje_obtenido
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id_participante, id_pregunta) DO NOTHING`,
                    [participant.id_participante, q.id_pregunta, selected.id_opcion, room.id_sala, Math.round(elapsedMs), score]
                );
            } catch (err) {
                console.error(`[Kahoot] Error guardando respuesta de la sala ${room.id_sala}: ${err.message}`);
            }

            // No se revela si fue correcta hasta que la pregunta cierre (answer:result).
            return { recibido: true };
        });

        // 6. Docente cierra la pregunta antes de que termine el tiempo (question:end)
        safeHandler(socket, 'question:end', async (data) => {
            const room = resolveHostRoom(socket, data);
            if (room.estado !== 'pregunta') throw new RoomError('NO_HAY_PREGUNTA_ACTIVA_EN_ESTE_MOMENTO');
            endQuestion(io, room);
        });

        // 7. Docente avanza a la siguiente pregunta (question:next)
        safeHandler(socket, 'question:next', async (data) => {
            const room = resolveHostRoom(socket, data);
            if (room.estado !== 'estadisticas_pregunta') throw new RoomError('LA_PREGUNTA_ACTUAL_AUN_NO_TERMINA');

            const nextIndex = room.preguntaActualIndex + 1;
            if (nextIndex < room.preguntas.length) {
                startQuestion(io, room, nextIndex);
                return { siguienteNumero: nextIndex + 1 };
            }
            await finishGame(io, room);
            return { finalizado: true };
        });

        // 8. Docente finaliza la partida antes de tiempo (game:finish)
        safeHandler(socket, 'game:finish', async (data) => {
            const room = resolveHostRoom(socket, data);
            await finishGame(io, room);
        });

        // 9. Desconexión de cliente
        socket.on('disconnect', () => {
            const reg = socketRegistry.get(socket.id);
            if (!reg) return;
            socketRegistry.delete(socket.id);

            const room = activeRooms.get(reg.pin);
            if (!room) return;

            if (reg.role === 'host') {
                if (room.hostSocketId !== socket.id || CLOSED_STATES.has(room.estado)) return;
                room.hostSocketId = null;
                io.to(roomChannel(room)).emit('host:disconnected', { pin: room.pin });
                // Si el anfitrión no vuelve a tiempo, la sala se cierra (o se cancela si no empezó).
                room.hostGraceTimer = setTimeout(() => {
                    room.hostGraceTimer = null;
                    finishGame(io, room).catch((err) => console.error(`[Kahoot] Error cerrando sala abandonada: ${err.message}`));
                }, hostGraceMs());
                room.hostGraceTimer.unref();
                return;
            }

            const participant = room.participantes.get(reg.userId);
            if (participant && participant.socketId === socket.id) {
                participant.socketId = null; // conserva puntaje y respuestas para la reconexión
                io.to(hostChannel(room)).emit('player:disconnected', { nick: participant.nombre });
            }
        });
    });
};

module.exports = {
    activeRooms,
    XP_PODIUM_REWARDS,
    setupKahootSockets
};
