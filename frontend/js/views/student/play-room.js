import {
    h, icon, skeleton, errorMessage, formatNumber
} from '../../ui.js';
import { api } from '../../api.js';
import {
    createKahootSocket, emitAck, roomErrorMessage, connectErrorMessage
} from '../../socket.js';
import { refreshUser } from '../../state.js';

const NICK_KEY = 'codeint.kahoot.nick';
const LABELS = ['A', 'B', 'C', 'D'];
const MEDALS = ['🥇', '🥈', '🥉'];

const answerShape = (label) => h('span', { class: `answer-shape ${label.toLowerCase()}`, 'aria-hidden': 'true' });

export default async function playRoomView({ root, params, user }) {
    const pin = String(params.pin || '').trim();
    document.title = `Sala ${pin} · codeInt`;

    const headerHost = h('div', {}, skeleton(64));
    const statusHost = h('div', { class: 'stack' });
    const stageHost = h('div', {}, skeleton(360));

    root.append(h('div', { class: 'container narrow' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Inicio'), ' / ',
            h('a', { href: '#/jugar' }, 'Jugar'), ' / ',
            `Sala ${pin}`),
        headerHost,
        statusHost,
        stageHost));

    let savedNick = '';
    try { savedNick = sessionStorage.getItem(NICK_KEY) || ''; } catch { /* almacenamiento bloqueado */ }

    let socket = null;
    let info = null;
    let joined = false;
    let joinRequested = false;
    let nick = savedNick || user.nombre || '';
    let totalPlayers = 0;
    let screen = 'join';
    let currentQuestion = null;
    let selectedOption = null;
    let answered = false;
    let timerInterval = null;
    let questionDeadline = 0;
    let leaving = false;

    const setStatus = (text, tone = '') => {
        statusHost.replaceChildren(text ? h('div', { class: `status-banner ${tone}`.trim() }, text) : '');
    };

    const clearTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
    };

    const renderHeader = () => {
        headerHost.replaceChildren(h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, `Sala ${pin}`),
                h('p', {}, info ? `${info.curso.nombre} · ${info.docente}` : 'Cargando sala…')),
            h('div', { class: 'room-meta' },
                h('span', { class: 'pin-badge' }, h('span', {}, 'PIN'), h('strong', {}, pin)),
                h('a', { class: 'btn ghost small', href: '#/jugar' }, 'Salir'))));
    };

    const renderStage = (content) => {
        stageHost.replaceChildren(h('section', { class: 'play-stage' }, content));
    };

    const startTimer = (bar, secondsHost, limitMs, remainingMs) => {
        clearTimer();
        questionDeadline = Date.now() + Math.max(0, remainingMs ?? limitMs);
        const tick = () => {
            const left = Math.max(0, questionDeadline - Date.now());
            const percent = Math.max(0, Math.min(100, (left / limitMs) * 100));
            bar.style.setProperty('--value', `${percent}%`);
            bar.classList.toggle('is-low', percent < 25);
            secondsHost.textContent = `${Math.ceil(left / 1000)} s`;
            if (left <= 0) clearTimer();
        };
        tick();
        timerInterval = setInterval(tick, 200);
    };

    const renderJoin = (errorText = '') => {
        screen = 'join';
        const nickInput = h('input', {
            class: 'input', id: 'sala-nick', type: 'text', maxlength: 30, autocomplete: 'nickname',
            value: nick, placeholder: 'Tu apodo en la partida',
            onInput: (event) => { nick = event.target.value; }
        });
        const errorBox = h('div', { role: 'alert', hidden: !errorText },
            errorText ? h('div', { class: 'alert error' }, errorText) : '');
        const button = h('button', { class: 'btn block', type: 'button' }, icon('play', 16), 'Entrar a la partida');

        const submit = () => {
            const cleanNick = nickInput.value.trim();
            if (!cleanNick) {
                errorBox.hidden = false;
                errorBox.replaceChildren(h('div', { class: 'alert error' }, 'Ingresa un apodo para entrar.'));
                return;
            }
            nick = cleanNick;
            try { sessionStorage.setItem(NICK_KEY, nick); } catch { /* almacenamiento bloqueado */ }
            button.disabled = true;
            connectAndJoin();
        };

        nickInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); submit(); }
        });
        button.addEventListener('click', submit);

        renderStage(h('div', { class: 'join-card' },
            h('h2', { style: { marginBottom: '8px' } }, 'Unirme a la partida'),
            h('p', { class: 'muted small' }, 'Confirma tu apodo. Debe ser único dentro de la sala.'),
            info
                ? h('div', { class: 'info-list', style: { marginBottom: '16px' } },
                    h('div', { class: 'info-row' }, h('span', {}, 'Curso'), h('strong', {}, info.curso.nombre)),
                    h('div', { class: 'info-row' }, h('span', {}, 'Docente'), h('strong', {}, info.docente)),
                    h('div', { class: 'info-row' }, h('span', {}, 'Preguntas'), h('strong', {}, formatNumber(info.total_preguntas))),
                    h('div', { class: 'info-row' }, h('span', {}, 'Conectados'), h('strong', {}, formatNumber(info.total_participantes))))
                : null,
            info && info.estado === 'en_curso'
                ? h('div', { class: 'status-banner warn', style: { marginBottom: '14px' } },
                    'La partida ya comenzó. Solo pueden volver a entrar quienes ya estaban dentro.')
                : (info && !info.lista_para_unirse
                    ? h('div', { class: 'status-banner', style: { marginBottom: '14px' } },
                        'La sala está preparada, pero el docente todavía no la abrió.')
                    : null),
            h('div', { class: 'field' }, h('label', { for: 'sala-nick' }, 'Apodo'), nickInput),
            errorBox,
            button));
        nickInput.focus();
    };

    const renderLobby = (data = {}) => {
        screen = 'lobby';
        clearTimer();
        totalPlayers = Number(data.totalPlayers) || totalPlayers;
        renderStage([
            h('div', { class: 'stage-top' },
                h('span', { class: 'status-banner success' }, h('span', { class: 'live-dot' }), 'Estás dentro'),
                h('span', { class: 'chip' }, `${totalPlayers || '—'} jugadores`)),
            h('div', { class: 'pin-display' },
                h('span', {}, 'PIN de la sala'),
                h('strong', {}, pin),
                h('small', {}, nick)),
            h('div', { style: { textAlign: 'center' } },
                h('h2', {}, 'Esperando al docente'),
                h('p', { class: 'muted', style: { marginTop: '6px' } }, 'La partida comenzará en cuanto el anfitrión la inicie.'))]);
    };

    const renderStarting = () => {
        screen = 'countdown';
        clearTimer();
        renderStage(h('div', { class: 'countdown-stage' },
            h('span', { class: 'chip blue' }, 'La partida comenzó'),
            h('div', { class: 'countdown-number' }, '…'),
            h('p', { class: 'muted' }, 'Prepárate para la primera pregunta.')));
    };

    const renderCountdown = (data) => {
        screen = 'countdown';
        clearTimer();
        setStatus('');
        renderStage([
            h('div', { class: 'stage-top' },
                h('span', { class: 'chip blue' }, `Pregunta ${data.numero} de ${data.total}`),
                h('span', { class: 'chip' }, nick)),
            h('div', { class: 'countdown-stage' },
                h('div', { class: 'countdown-number' }, data.count),
                h('p', { class: 'muted' }, 'Prepárate para responder.'))]);
    };

    const paintAnswerState = () => {
        const buttons = stageHost.querySelectorAll('.answer-btn');
        buttons.forEach((button) => {
            const isSelected = button.dataset.opcion === selectedOption;
            button.disabled = answered;
            button.classList.toggle('is-selected', isSelected);
            button.classList.toggle('is-dimmed', answered && !isSelected);
        });
    };

    const submitAnswer = async (idOpcion) => {
        if (answered || screen !== 'question') return;
        answered = true;
        selectedOption = idOpcion;
        paintAnswerState();
        setStatus('Respuesta enviada. Esperando el cierre de la pregunta…', 'success');

        const result = await emitAck(socket, 'answer:submit', { id_opcion: idOpcion });
        if (!result.success) {
            if (result.error === 'YA_ENVIASTE_TU_RESPUESTA_A_ESTA_PREGUNTA') return;
            answered = false;
            selectedOption = null;
            setStatus(roomErrorMessage(result), 'error');
            paintAnswerState();
            if (result.error === 'NO_HAY_PREGUNTA_ACTIVA_EN_ESTE_MOMENTO') clearTimer();
        }
    };

    const renderQuestion = (question, remainingMs, alreadyAnswered = false) => {
        screen = 'question';
        currentQuestion = question;
        answered = Boolean(alreadyAnswered);
        selectedOption = null;
        setStatus(alreadyAnswered ? 'Ya enviaste tu respuesta. Esperando el cierre de la pregunta…' : '');

        const limitMs = Number(question.tiempo_limite_seg) * 1000 || 30000;
        const secondsHost = h('span', { class: 'chip' }, '— s');
        const timerBar = h('div', { class: 'timer-track' }, h('span', { style: { '--value': '100%' } }));

        renderStage([
            h('div', { class: 'stage-top' },
                h('div', { class: 'room-meta' },
                    h('span', { class: 'chip blue' }, `Pregunta ${question.numero} de ${question.total}`),
                    h('span', { class: 'chip xp' }, `${formatNumber(question.puntos_base)} pts`)),
                secondsHost),
            timerBar,
            h('h2', { class: 'question-title' }, question.enunciado),
            h('div', { class: 'answer-grid' }, question.opciones.map((opcion, index) => {
                const label = opcion.etiqueta || LABELS[index] || 'A';
                const button = h('button', {
                    class: `answer-btn ${String(opcion.etiqueta || label).toLowerCase()}`,
                    type: 'button', dataset: { opcion: opcion.id_opcion },
                    disabled: answered
                },
                answerShape(String(opcion.etiqueta || label)),
                h('div', {}, h('span', { class: 'answer-label' }, `Opción ${opcion.etiqueta || label}`), h('div', {}, opcion.texto)));
                button.addEventListener('click', () => submitAnswer(opcion.id_opcion));
                return button;
            }))]);

        startTimer(timerBar, secondsHost, limitMs, remainingMs);
        paintAnswerState();
    };

    const renderResult = (data) => {
        screen = 'result';
        clearTimer();
        setStatus('');
        const correctOption = (currentQuestion?.opciones || []).find(
            (option) => option.etiqueta === data.opcionCorrecta
        );
        renderStage([
            h('div', { class: 'countdown-stage' },
                h('div', { class: 'countdown-number', style: { color: data.correct ? 'var(--positive)' : 'var(--negative)' } },
                    data.correct ? '✓' : '×'),
                h('h2', {}, data.correct ? '¡Correcto!' : 'Incorrecto'),
                h('div', { class: 'room-meta', style: { justifyContent: 'center' } },
                    h('span', { class: `chip ${data.correct ? 'green' : 'red'}` }, `+${formatNumber(data.puntaje)} pts`),
                    h('span', { class: 'chip xp' }, `${formatNumber(data.puntajeTotal)} pts acumulados`),
                    h('span', { class: 'chip blue' }, `Puesto ${data.posicion}`)),
                correctOption
                    ? h('p', { class: 'muted' }, `La respuesta correcta era ${data.opcionCorrecta}: ${correctOption.texto}`)
                    : h('p', { class: 'muted' }, 'Esperando la siguiente pregunta…'),
                h('p', { class: 'small muted' }, 'Prepárate para la siguiente pregunta.'))]);
    };

    const renderWaitingClosed = () => {
        screen = 'result';
        clearTimer();
        renderStage(h('div', { class: 'countdown-stage' },
            h('div', { class: 'countdown-number' }, '✓'),
            h('h2', {}, 'Pregunta cerrada'),
            h('p', { class: 'muted' }, 'Esperando la siguiente pregunta del docente…')));
    };

    const renderPodium = (data) => {
        screen = 'podium';
        clearTimer();
        setStatus('');
        const podium = data.podio || [];
        const logros = Array.isArray(data.logros_desbloqueados) ? data.logros_desbloqueados : [];
        const puesto = Number(data.tuPuesto) || 0;

        const step = (participant, place) => participant
            ? h('div', { class: `podium-step ${place}` },
                h('span', { class: 'medal' }, MEDALS[['first', 'second', 'third'].indexOf(place)] || '🏅'),
                h('strong', {}, participant.nick),
                h('small', {}, `${formatNumber(participant.puntaje)} pts`))
            : h('div', { class: `podium-step ${place}` }, h('span', { class: 'muted small' }, '—'));

        renderStage([
            h('div', { class: 'stage-top' },
                h('span', { class: 'status-banner success' }, icon('trophy', 16), 'Partida finalizada'),
                h('span', { class: 'chip xp' }, `${formatNumber(data.xpGanado)} XP ganados`)),
            h('div', { class: 'countdown-stage', style: { gap: '8px' } },
                h('div', { class: 'countdown-number' }, puesto ? `#${puesto}` : '✓'),
                h('h2', {}, puesto > 0 && puesto <= 3 ? '¡Estás en el podio!' : 'Buen trabajo'),
                h('p', { class: 'muted' }, `Tu puntaje: ${formatNumber(data.tuPuntaje)} puntos · ${formatNumber(data.xpGanado)} XP`)),
            h('div', { class: 'podium' }, step(podium[1], 'second'), step(podium[0], 'first'), step(podium[2], 'third')),
            logros.length
                ? h('div', { class: 'card flat', style: { border: '1px solid var(--border)' } },
                    h('h3', {}, 'Logros desbloqueados'),
                    h('ul', { class: 'tips' }, logros.map((logro) => h('li', {}, logro.nombre))))
                : null,
            h('div', { class: 'form-actions' },
                h('a', { class: 'btn', href: '#/jugar' }, 'Volver a jugar'),
                h('a', { class: 'btn ghost', href: '#/' }, 'Ir al inicio'))]);
    };

    const renderCancelled = () => {
        screen = 'cancelled';
        clearTimer();
        renderStage(h('div', { class: 'countdown-stage' },
            h('div', { class: 'countdown-number' }, '—'),
            h('h2', {}, 'Sala cancelada'),
            h('p', { class: 'muted' }, 'El docente cerró la sala antes de comenzar.'),
            h('a', { class: 'btn', href: '#/jugar' }, 'Volver a jugar')));
    };

    const renderFinished = () => {
        screen = 'finished';
        clearTimer();
        renderStage(h('div', { class: 'countdown-stage' },
            h('div', { class: 'countdown-number' }, '✓'),
            h('h2', {}, 'La partida terminó'),
            h('p', { class: 'muted' }, 'El docente cerró la partida.'),
            h('a', { class: 'btn', href: '#/jugar' }, 'Volver a jugar')));
    };

    const renderReplaced = () => {
        screen = 'replaced';
        clearTimer();
        leaving = true;
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            socket = null;
        }
        setStatus('Tu sesión se abrió en otro dispositivo o pestaña.', 'warn');
        renderStage(h('div', { class: 'countdown-stage' },
            h('div', { class: 'countdown-number' }, '!'),
            h('h2', {}, 'Sesión reemplazada'),
            h('p', { class: 'muted' }, 'Solo puede haber una conexión activa por estudiante en la sala.'),
            h('a', { class: 'btn', href: '#/jugar' }, 'Volver a jugar')));
    };

    const renderFatal = (message) => {
        clearTimer();
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            socket = null;
        }
        headerHost.replaceChildren(h('h1', {}, `Sala ${pin}`));
        setStatus('', '');
        renderStage(h('div', { class: 'countdown-stage' },
            h('div', { class: 'countdown-number' }, '!'),
            h('h2', {}, 'No pudimos entrar a la sala'),
            h('p', { class: 'muted' }, message),
            h('a', { class: 'btn', href: '#/jugar' }, 'Volver a jugar')));
    };

    const applySnapshot = (snapshot) => {
        if (!snapshot) return;
        if (snapshot.totalPreguntas) info = { ...(info || {}), total_preguntas: snapshot.totalPreguntas };
        switch (snapshot.estado) {
            case 'espera':
                if (joined) renderLobby();
                break;
            case 'countdown':
                renderCountdown({ count: '…', numero: snapshot.numero || 1, total: snapshot.totalPreguntas || '—' });
                break;
            case 'pregunta':
                if (snapshot.pregunta) {
                    const alreadyAnswered = Boolean(snapshot.yaRespondio);
                    renderQuestion(snapshot.pregunta, snapshot.pregunta.tiempo_restante_ms, alreadyAnswered);
                } else {
                    renderStarting();
                }
                break;
            case 'estadisticas_pregunta':
                renderWaitingClosed();
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

    const attemptJoin = async () => {
        const result = await emitAck(socket, 'room:join', { pin, nick });
        if (!result.success) {
            const message = roomErrorMessage(result);
            if (joined) {
                setStatus(message, 'warn');
            } else {
                renderJoin(message);
            }
            return;
        }

        joined = true;
        const data = result.data || {};
        if (data.nick) nick = data.nick;
        if (data.totalPlayers) totalPlayers = data.totalPlayers;
        if (['join', 'lobby'].includes(screen)) renderLobby(data);
    };

    const setupSocket = async () => {
        try {
            socket = await createKahootSocket();
        } catch {
            renderFatal('No se pudo cargar el cliente de tiempo real. Recarga la página.');
            return;
        }

        socket.on('connect', () => {
            setStatus('');
            if (joinRequested && !leaving) attemptJoin();
        });
        socket.on('connect_error', (error) => {
            const code = error?.message;
            const authCodes = new Set([
                'AUTHENTICATION_REQUIRED', 'INVALID_TOKEN', 'TOKEN_EXPIRED',
                'SESSION_REVOKED', 'ACCOUNT_NOT_ACTIVE'
            ]);
            if (authCodes.has(code)) renderFatal(connectErrorMessage(error));
            else setStatus('No se pudo conectar. Reintentando automáticamente…', 'warn');
        });
        socket.on('disconnect', () => {
            if (leaving) return;
            setStatus('Conexión perdida. Reintentando automáticamente…', 'warn');
        });

        socket.on('room:joined_success', (data) => {
            joined = true;
            nick = data.nick || nick;
            totalPlayers = Number(data.totalPlayers) || totalPlayers;
            if (['join', 'lobby'].includes(screen)) renderLobby(data);
        });
        socket.on('room:state', applySnapshot);
        socket.on('game:started', renderStarting);
        socket.on('question:countdown', renderCountdown);
        socket.on('question:show', (question) => {
            setStatus('');
            renderQuestion(question);
        });
        socket.on('answer:result', renderResult);
        socket.on('game:podium', (data) => {
            renderPodium(data);
            refreshUser().catch(() => { /* el podio ya muestra el XP de la partida */ });
        });
        socket.on('room:cancelled', renderCancelled);
        socket.on('room:replaced', renderReplaced);
        socket.on('host:disconnected', () => {
            if (screen === 'podium' || screen === 'finished' || screen === 'cancelled') return;
            setStatus('El docente se desconectó. Esperando su reconexión…', 'warn');
        });
    };

    const connectAndJoin = async () => {
        joinRequested = true;
        if (!socket) {
            await setupSocket();
            return; // el evento connect hará el room:join
        }
        if (socket.connected) {
            await attemptJoin();
        }
    };

    const load = async () => {
        headerHost.replaceChildren(skeleton(64));
        stageHost.replaceChildren(skeleton(360));

        if (!/^\d{6}$/.test(pin)) {
            renderFatal('El PIN de la sala no es válido.');
            return;
        }

        try {
            const response = await api(`/salas/${pin}/info`);
            info = response.data;
            totalPlayers = Number(info.total_participantes) || 0;
            renderHeader();
            renderJoin();
        } catch (error) {
            renderFatal(errorMessage(error));
        }
    };

    await load();

    return () => {
        leaving = true;
        clearTimer();
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            socket = null;
        }
    };
}
