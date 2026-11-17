import { h, icon, skeleton, errorMessage, formatNumber, openModal, setBusy, toast } from '../../ui.js';
import { api } from '../../api.js';
import {
    createKahootSocket, emitAck, roomErrorMessage, connectErrorMessage
} from '../../socket.js';
import { statusChip } from './helpers.js';

const LABELS = ['A', 'B', 'C', 'D'];
const MEDALS = ['🥇', '🥈', '🥉'];

const answerShape = (label) => h('span', { class: `answer-shape ${label.toLowerCase()}`, 'aria-hidden': 'true' });

export default async function hostView({ root, params }) {
    const pin = String(params.pin || '').trim();
    document.title = `Sala ${pin} · codeInt`;

    const headerHost = h('div', {}, skeleton(64));
    const statusHost = h('div', { class: 'stack' });
    const stageHost = h('div', {}, skeleton(360));

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Panel'), ' / ',
            h('a', { href: '#/salas' }, 'Salas'), ' / ',
            `Sala ${pin}`),
        headerHost,
        statusHost,
        stageHost));

    let socket = null;
    let info = null;
    let totalQuestions = 0;
    let totalPlayers = 0;
    let answeredCount = 0;
    let players = new Map();
    let screen = 'connecting';
    let timerInterval = null;
    let answersCountHost = null;
    let currentQuestion = null;

    const setStatus = (text, tone = '') => {
        statusHost.replaceChildren(text
            ? h('div', { class: `status-banner ${tone}`.trim() }, text)
            : '');
    };

    const renderHeader = (estado) => {
        headerHost.replaceChildren(h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, `Sala ${pin}`),
                h('p', {}, info ? `${info.curso.nombre} · ${info.curso.codigo}` : 'Cargando información de la sala…')),
            h('div', { class: 'room-meta' },
                h('span', { class: 'pin-badge' }, h('span', {}, 'PIN'), h('strong', {}, pin)),
                estado ? statusChip(estado) : null,
                h('a', { class: 'btn ghost small', href: '#/salas' }, 'Volver'))));
    };

    const renderStage = (content) => {
        stageHost.replaceChildren(h('section', { class: 'host-stage' }, content));
    };

    const clearTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
    };

    const startTimer = (timerBar, secondsHost, limitMs, remainingMs) => {
        clearTimer();
        const deadline = Date.now() + Math.max(0, remainingMs ?? limitMs);
        const tick = () => {
            const left = Math.max(0, deadline - Date.now());
            const percent = Math.max(0, Math.min(100, (left / limitMs) * 100));
            timerBar.style.setProperty('--value', `${percent}%`);
            timerBar.classList.toggle('is-low', percent < 25);
            if (secondsHost) secondsHost.textContent = `${Math.ceil(left / 1000)} s`;
            if (left <= 0) clearTimer();
        };
        tick();
        timerInterval = setInterval(tick, 200);
    };

    const playersHost = () => {
        if (players.size === 0) {
            return h('div', { class: 'empty-state compact' },
                h('strong', {}, 'Todavía no se une nadie'),
                h('p', {}, 'Comparte el PIN o proyecta esta pantalla para que ingresen.'));
        }
        return h('div', { class: 'lobby-players' },
            Array.from(players.entries()).map(([nick, connected]) => h('span', {
                class: `player-chip ${connected ? '' : 'offline'}`.trim()
            }, nick)));
    };

    const confirmFinish = () => {
        const started = screen !== 'lobby';
        const close = openModal(h('div', {},
            h('div', { class: 'modal-head' }, h('h2', {}, started ? 'Finalizar la partida' : 'Cerrar la sala')),
            h('p', { class: 'muted' }, started
                ? 'Se guardará el podio, el XP y los logros obtenidos hasta ahora. No se puede deshacer.'
                : 'La sala se cancelará y no se repartirá XP.'),
            h('div', { class: 'form-actions' },
                h('button', {
                    class: 'btn danger', type: 'button',
                    onClick: async () => {
                        close();
                        const result = await emitAck(socket, 'game:finish', { pin });
                        if (!result.success) toast(roomErrorMessage(result), 'error');
                    }
                }, started ? 'Finalizar ahora' : 'Cerrar sala'),
                h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cancelar'))),
        { label: started ? 'Finalizar la partida' : 'Cerrar la sala' });
    };

    const renderLobby = () => {
        screen = 'lobby';
        clearTimer();
        renderHeader('espera');

        const startButton = h('button', { class: 'btn', type: 'button' }, icon('play', 16), 'Iniciar partida');
        startButton.disabled = players.size === 0;
        startButton.addEventListener('click', async () => {
            setBusy(startButton, true, 'Iniciando…');
            const result = await emitAck(socket, 'game:start', { pin });
            if (!result.success) {
                toast(roomErrorMessage(result), 'error');
                setBusy(startButton, false);
            }
        });

        renderStage([
            h('div', { class: 'stage-top' },
                h('div', { class: 'room-meta' },
                    h('span', { class: 'status-banner success' }, h('span', { class: 'live-dot' }), 'Sala abierta'),
                    h('span', { class: 'chip blue' }, `${totalQuestions} preguntas`)),
                h('span', { class: 'chip' }, `${players.size} conectados`)),
            h('div', { class: 'pin-display' },
                h('span', {}, 'PIN de la sala'),
                h('strong', {}, pin),
                h('small', {}, 'Los estudiantes lo ingresan desde “Jugar”.')),
            h('div', {},
                h('h2', {}, 'Esperando estudiantes'),
                h('p', { class: 'muted', style: { marginTop: '6px' } },
                    'Cuando todos estén dentro, inicia la partida. La primera pregunta empezará con una cuenta regresiva.')),
            playersHost(),
            h('div', { class: 'form-actions' },
                startButton,
                h('button', { class: 'btn ghost', type: 'button', onClick: confirmFinish }, 'Cerrar sala'))]);
    };

    const renderStarting = () => {
        screen = 'countdown';
        clearTimer();
        renderStage(h('div', { class: 'countdown-stage' },
            h('span', { class: 'chip blue' }, 'La partida comenzó'),
            h('div', { class: 'countdown-number' }, '…'),
            h('p', { class: 'muted' }, 'Preparando la primera pregunta.')));
    };

    const renderCountdown = (data) => {
        screen = 'countdown';
        clearTimer();
        renderHeader('en_curso');
        renderStage([
            h('div', { class: 'stage-top' },
                h('span', { class: 'chip blue' }, `Pregunta ${data.numero} de ${data.total}`),
                h('span', { class: 'chip' }, `${players.size} jugadores`)),
            h('div', { class: 'countdown-stage' },
                h('div', { class: 'countdown-number' }, data.count),
                h('p', { class: 'muted' }, 'Prepárense para responder.'))]);
    };

    const renderQuestion = (question, remainingMs) => {
        screen = 'question';
        currentQuestion = question;
        renderHeader('en_curso');
        answeredCount = Math.max(0, answeredCount);
        totalPlayers = Math.max(totalPlayers, players.size);
        const limitMs = Number(question.tiempo_limite_seg) * 1000;

        const secondsHost = h('span', { class: 'chip' }, '— s');
        answersCountHost = h('strong', {}, `${answeredCount} / ${totalPlayers || '—'}`);
        const timerBar = h('div', { class: 'timer-track' }, h('span', { style: { '--value': '100%' } }));

        renderStage([
            h('div', { class: 'stage-top' },
                h('div', { class: 'room-meta' },
                    h('span', { class: 'chip blue' }, `Pregunta ${question.numero} de ${question.total}`),
                    h('span', { class: 'chip xp' }, `${formatNumber(question.puntos_base)} pts`)),
                h('div', { class: 'room-meta' },
                    h('span', { class: 'chip' }, 'Respuestas: ', answersCountHost),
                    secondsHost)),
            timerBar,
            h('div', { class: 'question-stage' },
                h('h2', { class: 'question-title' }, question.enunciado),
                h('div', { class: 'answer-grid' }, question.opciones.map((opcion, index) => h('div', {
                    class: `answer-btn ${LABELS[index]?.toLowerCase() || 'a'} is-static`
                },
                answerShape(LABELS[index] || 'A'),
                h('div', {}, h('span', { class: 'answer-label' }, `Opción ${LABELS[index] || ''}`), h('div', {}, opcion.texto))))),
                h('p', { class: 'muted small' }, 'La respuesta correcta se revela al cerrar la pregunta.')),
            h('div', { class: 'form-actions' },
                h('button', {
                    class: 'btn secondary', type: 'button',
                    onClick: async () => {
                        const result = await emitAck(socket, 'question:end', { pin });
                        if (!result.success) toast(roomErrorMessage(result), 'error');
                    }
                }, 'Cerrar pregunta ahora'),
                h('button', { class: 'btn ghost', type: 'button', onClick: confirmFinish }, 'Finalizar'))]);

        startTimer(timerBar, secondsHost, limitMs || 30000, remainingMs);
    };

    const renderResultsPending = (numero) => {
        screen = 'results';
        clearTimer();
        renderStage([
            h('div', { class: 'stage-top' }, h('span', { class: 'chip blue' }, `Pregunta ${numero || ''} cerrada`)),
            h('div', { class: 'countdown-stage' },
                h('div', { class: 'countdown-number' }, '✓'),
                h('p', { class: 'muted' }, 'La pregunta ya cerró. Puedes continuar con la siguiente.')),
            h('div', { class: 'form-actions' },
                h('button', {
                    class: 'btn', type: 'button',
                    onClick: async (event) => {
                        setBusy(event.currentTarget, true, 'Avanzando…');
                        const result = await emitAck(socket, 'question:next', { pin });
                        if (!result.success) {
                            toast(roomErrorMessage(result), 'error');
                            setBusy(event.currentTarget, false);
                        }
                    }
                }, 'Siguiente pregunta'),
                h('button', { class: 'btn ghost', type: 'button', onClick: confirmFinish }, 'Finalizar'))]);
    };

    const rankingRow = (item, index, highlight = false) => h('li', { class: `ranking-row ${highlight ? 'is-me' : ''}`.trim() },
        h('span', { class: 'ranking-pos' }, item.puesto || item.posicion || index + 1),
        h('span', { class: 'ranking-nick' }, item.nick),
        h('span', { class: 'ranking-points' }, `${formatNumber(item.puntaje)} pts`));

    const renderResults = (data) => {
        screen = 'results';
        clearTimer();
        const stats = data.stats || {};
        const total = Math.max(1, totalPlayers || players.size);
        const options = (currentQuestion?.opciones || []).map((option, index) => ({
            etiqueta: option.etiqueta || LABELS[index] || 'A',
            texto: option.texto
        }));

        const bars = options.map((option, index) => {
            const count = Number(stats[option.etiqueta] || 0);
            const percent = Math.round((count / total) * 100);
            const isCorrect = data.opcion_correcta && data.opcion_correcta.etiqueta === option.etiqueta;
            return h('div', { class: 'stat-row' },
                h('header', {},
                    h('span', {}, `${option.etiqueta}. ${option.texto}${isCorrect ? ' ✓' : ''}`),
                    h('strong', {}, `${count} (${percent}%)`)),
                h('div', { class: `stat-fill ${option.etiqueta.toLowerCase()}` },
                    h('span', { style: { '--value': `${percent}%` } })),
                isCorrect ? h('span', { class: 'correct-chip' }, icon('check', 14), 'Respuesta correcta') : null);
        });

        const sinResponder = Number(stats.sin_responder || 0);
        renderStage([
            h('div', { class: 'stage-top' },
                h('span', { class: 'chip blue' }, `Resultados · Pregunta ${data.numero} de ${data.total}`),
                h('span', { class: 'chip' }, sinResponder > 0 ? `${sinResponder} sin responder` : 'Todos respondieron')),
            h('div', { class: 'results-grid' },
                h('div', {},
                    h('h2', { style: { marginBottom: '14px' } }, 'Distribución de respuestas'),
                    h('div', { class: 'stat-bars' }, bars)),
                h('section', {},
                    h('h2', { style: { marginBottom: '14px' } }, 'Top 5'),
                    data.ranking && data.ranking.length
                        ? h('ul', { class: 'ranking-list' }, data.ranking.map((item, index) => rankingRow(item, index)))
                        : h('p', { class: 'muted small' }, 'Sin respuestas registradas.'))),
            h('div', { class: 'form-actions' },
                h('button', {
                    class: 'btn', type: 'button',
                    onClick: async (event) => {
                        setBusy(event.currentTarget, true, 'Avanzando…');
                        const result = await emitAck(socket, 'question:next', { pin });
                        if (!result.success) {
                            toast(roomErrorMessage(result), 'error');
                            setBusy(event.currentTarget, false);
                        }
                    }
                }, data.esUltimaPregunta ? 'Ver podio' : 'Siguiente pregunta'),
                h('button', { class: 'btn ghost', type: 'button', onClick: confirmFinish }, 'Finalizar'))]);
    };

    const podiumStep = (participant, place) => {
        if (!participant) return h('div', { class: `podium-step ${place}` }, h('span', { class: 'muted small' }, '—'));
        return h('div', { class: `podium-step ${place}` },
            h('span', { class: 'medal' }, MEDALS[['first', 'second', 'third'].indexOf(place)] || '🏅'),
            h('strong', {}, participant.nick),
            h('small', {}, `${formatNumber(participant.puntaje)} pts`),
            participant.xpGanado !== undefined ? h('em', {}, `+${formatNumber(participant.xpGanado)} XP`) : null);
    };

    const renderPodium = (data) => {
        screen = 'podium';
        clearTimer();
        renderHeader('finalizada');
        const podium = data.podio || [];
        const ranking = data.rankingCompleto || podium;

        renderStage([
            h('div', { class: 'stage-top' },
                h('span', { class: 'status-banner success' }, icon('trophy', 16), 'Partida finalizada'),
                data.resultados_guardados === false
                    ? h('span', { class: 'status-banner warn' }, 'No se pudieron guardar los resultados')
                    : h('span', { class: 'chip green' }, 'Resultados guardados')),
            h('div', { class: 'podium' },
                podiumStep(podium[1], 'second'),
                podiumStep(podium[0], 'first'),
                podiumStep(podium[2], 'third')),
            h('section', {},
                h('h2', { style: { marginBottom: '12px' } }, 'Ranking completo'),
                h('ul', { class: 'ranking-list' }, ranking.map((item, index) => rankingRow(item, index)))),
            h('div', { class: 'form-actions' },
                h('a', { class: 'btn', href: '#/salas' }, 'Volver a las salas'),
                h('a', { class: 'btn ghost', href: '#/salas' }, 'Crear otra sala'))]);
    };

    const renderCancelled = () => {
        screen = 'cancelled';
        clearTimer();
        renderHeader('cancelada');
        renderStage(h('div', { class: 'countdown-stage' },
            h('div', { class: 'countdown-number' }, '—'),
            h('h2', {}, 'Sala cancelada'),
            h('p', { class: 'muted' }, 'La partida se cerró sin repartir XP.'),
            h('a', { class: 'btn', href: '#/salas' }, 'Volver a las salas')));
    };

    const renderFinished = () => {
        screen = 'cancelled';
        clearTimer();
        renderHeader('finalizada');
        renderStage(h('div', { class: 'countdown-stage' },
            h('div', { class: 'countdown-number' }, '✓'),
            h('h2', {}, 'La partida terminó'),
            h('p', { class: 'muted' }, 'Consulta el detalle en el historial de salas.'),
            h('a', { class: 'btn', href: '#/salas' }, 'Volver a las salas')));
    };

    const renderFatal = (message) => {
        clearTimer();
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            socket = null;
        }
        setStatus(message, 'error');
        renderStage(h('div', { class: 'countdown-stage' },
            h('div', { class: 'countdown-number' }, '!'),
            h('h2', {}, 'No pudimos abrir la sala'),
            h('p', { class: 'muted' }, message),
            h('div', { class: 'row' },
                h('button', { class: 'btn', type: 'button', onClick: () => load() }, 'Reintentar'),
                h('a', { class: 'btn ghost', href: '#/salas' }, 'Volver a las salas'))));
    };

    const applySnapshot = (snapshot) => {
        if (!snapshot) return;
        if (snapshot.id_sala) info = { ...(info || {}), id_sala: snapshot.id_sala };
        if (snapshot.totalPreguntas) totalQuestions = snapshot.totalPreguntas;
        if (Array.isArray(snapshot.jugadores)) {
            players = new Map(snapshot.jugadores.map((player) => [player.nick, Boolean(player.conectado)]));
        }
        totalPlayers = Math.max(totalPlayers, players.size);

        switch (snapshot.estado) {
            case 'espera':
                renderLobby();
                break;
            case 'countdown':
                renderCountdown({ count: '…', numero: snapshot.numero || 1, total: totalQuestions });
                break;
            case 'pregunta':
                if (snapshot.pregunta) {
                    answeredCount = 0;
                    renderQuestion(snapshot.pregunta, snapshot.pregunta.tiempo_restante_ms);
                } else {
                    renderStarting();
                }
                break;
            case 'estadisticas_pregunta':
                renderResultsPending(snapshot.numero);
                break;
            case 'finalizando':
                renderStage(h('div', { class: 'countdown-stage' },
                    h('div', { class: 'countdown-number' }, '…'),
                    h('p', { class: 'muted' }, 'Guardando resultados…')));
                break;
            case 'finalizada':
                renderFinished();
                break;
            case 'cancelada':
                renderCancelled();
                break;
            default:
                break;
        }
    };

    const setupSocket = async () => {
        try {
            socket = await createKahootSocket();
        } catch {
            renderFatal('No se pudo cargar el cliente de tiempo real. Recarga la página.');
            return;
        }

        socket.on('connect', async () => {
            setStatus('');
            const result = await emitAck(socket, 'room:host', { pin });
            if (!result.success) {
                renderFatal(roomErrorMessage(result));
                return;
            }
            applySnapshot(result.data);
        });

        socket.on('connect_error', (error) => {
            const message = connectErrorMessage(error);
            const code = error?.message;
            const authCodes = new Set([
                'AUTHENTICATION_REQUIRED', 'INVALID_TOKEN', 'TOKEN_EXPIRED',
                'SESSION_REVOKED', 'ACCOUNT_NOT_ACTIVE', 'INSTITUTION_INACTIVE'
            ]);
            if (authCodes.has(code)) {
                renderFatal(message);
            } else {
                setStatus('No se pudo conectar. Reintentando automáticamente…', 'warn');
            }
        });
        socket.on('disconnect', () => setStatus('Conexión perdida. Reintentando automáticamente…', 'warn'));

        socket.on('room:state', applySnapshot);
        socket.on('game:started', renderStarting);
        socket.on('question:countdown', renderCountdown);
        socket.on('question:show', (question) => {
            answeredCount = 0;
            renderQuestion(question);
        });
        socket.on('answers:update_count', (data) => {
            answeredCount = Number(data.count) || 0;
            totalPlayers = Number(data.totalPlayers) || totalPlayers;
            if (answersCountHost) answersCountHost.textContent = `${answeredCount} / ${totalPlayers || '—'}`;
        });
        socket.on('question:results', renderResults);
        socket.on('game:podium', renderPodium);
        socket.on('room:cancelled', renderCancelled);

        socket.on('player:joined', (data) => {
            players.set(data.nick, true);
            totalPlayers = Number(data.totalPlayers) || players.size;
            if (screen === 'lobby') renderLobby();
        });
        socket.on('player:reconnected', (data) => {
            players.set(data.nick, true);
            if (screen === 'lobby') renderLobby();
        });
        socket.on('player:disconnected', (data) => {
            if (players.has(data.nick)) players.set(data.nick, false);
            if (screen === 'lobby') renderLobby();
        });
    };

    const load = async () => {
        headerHost.replaceChildren(skeleton(64));
        stageHost.replaceChildren(skeleton(360));
        setStatus('');

        if (!/^\d{6}$/.test(pin)) {
            renderFatal('El PIN de la sala no es válido.');
            return;
        }

        try {
            const response = await api(`/salas/${pin}/info`);
            info = response.data;
            totalQuestions = Number(info.total_preguntas) || 0;
            totalPlayers = Number(info.total_participantes) || 0;
            renderHeader(info.estado);
        } catch (error) {
            renderFatal(errorMessage(error));
            return;
        }

        await setupSocket();
    };

    await load();

    return () => {
        clearTimer();
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            socket = null;
        }
    };
}
