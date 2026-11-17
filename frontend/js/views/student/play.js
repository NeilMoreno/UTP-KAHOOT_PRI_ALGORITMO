import { h, icon, skeleton, errorMessage, formatNumber } from '../../ui.js';
import { api } from '../../api.js';
import { navigate } from '../../router.js';
import { statusChip } from '../teacher/helpers.js';

const NICK_KEY = 'codeint.kahoot.nick';

const activeRoomCard = (sala, onJoin) => h('article', { class: 'card' },
    h('div', { class: 'section-heading' },
        h('h3', {}, sala.curso_nombre),
        statusChip(sala.estado)),
    h('p', { class: 'muted small' }, `${sala.codigo_curso} · ${formatNumber(sala.total_preguntas)} preguntas`),
    h('div', { class: 'info-list' },
        h('div', { class: 'info-row' }, h('span', {}, 'PIN'), h('strong', { style: { letterSpacing: '.12em' } }, sala.pin_sala)),
        h('div', { class: 'info-row' }, h('span', {}, 'Jugadores'), h('strong', {}, formatNumber(sala.total_participantes)))),
    h('div', { class: 'form-actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => onJoin(sala.pin_sala) }, icon('play', 15), 'Unirme')));

export default async function playView({ root, user }) {
    document.title = 'Jugar · codeInt';

    let savedNick = '';
    try { savedNick = sessionStorage.getItem(NICK_KEY) || ''; } catch { /* almacenamiento bloqueado */ }

    const pinInput = h('input', {
        class: 'input pin-input', id: 'jugar-pin', type: 'text', inputmode: 'numeric',
        autocomplete: 'off', maxlength: 6, pattern: '\\d{6}', placeholder: '000000',
        'aria-label': 'PIN de 6 dígitos'
    });
    const nickInput = h('input', {
        class: 'input', id: 'jugar-nick', type: 'text', maxlength: 30, autocomplete: 'nickname',
        value: savedNick || user.nombre || '', placeholder: 'Tu apodo en la partida'
    });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn block', type: 'submit' }, icon('play', 16), 'Entrar a la sala');

    const showError = (message) => {
        errorBox.className = 'alert error';
        errorBox.hidden = false;
        errorBox.textContent = message;
    };

    const goToRoom = (pin) => {
        const nick = nickInput.value.trim();
        if (!/^\d{6}$/.test(pin)) return showError('El PIN debe tener exactamente 6 dígitos.');
        if (!nick) return showError('Ingresa un apodo para la partida.');
        try { sessionStorage.setItem(NICK_KEY, nick); } catch { /* almacenamiento bloqueado */ }
        navigate(`/jugar/${pin}`);
    };

    const form = h('form', {
        novalidate: true,
        onSubmit: (event) => {
            event.preventDefault();
            errorBox.hidden = true;
            goToRoom(pinInput.value.trim());
        }
    },
    h('div', { class: 'field' }, h('label', { for: 'jugar-pin' }, 'PIN de la sala'), pinInput),
    h('div', { class: 'field' }, h('label', { for: 'jugar-nick' }, 'Apodo'), nickInput,
        h('span', { class: 'hint' }, 'Será visible para el docente y el resto de la clase.')),
    errorBox,
    submit);

    const roomsHost = h('div', { class: 'grid cols-3' }, skeleton(170), skeleton(170), skeleton(170));

    root.append(h('div', { class: 'container' },
        h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, 'Jugar'),
                h('p', {}, 'Ingresa el PIN que proyecta tu docente y demuestra lo que sabes.')),
            h('a', { class: 'btn ghost', href: '#/' }, 'Volver al inicio')),
        h('div', { class: 'grid cols-2', style: { alignItems: 'start' } },
            h('div', { class: 'card' },
                h('h2', { style: { marginBottom: '12px' } }, 'Unirme a una partida'),
                form),
            h('div', { class: 'card flat', style: { border: '1px solid var(--border)' } },
                h('h2', { style: { marginBottom: '10px' } }, 'Antes de entrar'),
                h('ul', { class: 'tips' },
                    h('li', {}, 'Usa el PIN de 6 dígitos de la pantalla del docente.'),
                    h('li', {}, 'Necesitas una matrícula activa en el curso de la sala.'),
                    h('li', {}, 'El apodo debe ser único dentro de la partida.'),
                    h('li', {}, 'Si recargas la página, vuelve a entrar con el mismo PIN y apodo.')))),
        h('section', { style: { marginTop: '26px' } },
            h('div', { class: 'section-heading' },
                h('h2', {}, 'Salas abiertas en tus cursos'),
                h('span', { class: 'muted small' }, 'Se actualizan al recargar')),
            roomsHost)));

    try {
        const { data: salas } = await api('/salas/activas');
        roomsHost.replaceChildren(...(salas.length
            ? salas.map((sala) => activeRoomCard(sala, goToRoom))
            : [h('div', { class: 'empty-state' },
                h('strong', {}, 'No hay salas abiertas ahora'),
                h('p', {}, 'Cuando tu docente abra una sala, aparecerá aquí. También puedes ingresar el PIN manualmente.'))]));
    } catch (error) {
        roomsHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
    }

    if (!savedNick) nickInput.focus();
    else pinInput.focus();
}
