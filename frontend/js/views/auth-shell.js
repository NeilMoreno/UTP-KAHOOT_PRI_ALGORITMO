import { h } from '../ui.js';
import { createAvatar } from '../characters.js';
import { CLASES, PRESETS } from '../avatar-parts.js';

// Líneas decorativas de la mini-terminal (texto fijo: nada del usuario llega aquí).
const CODE = [
    'Algoritmo promedio',
    '  Leer a, b',
    '  p <- (a + b) / 2',
    '  Escribir p',
    'FinAlgoritmo'
];

const showcase = () => h('aside', { class: 'auth-showcase', 'aria-hidden': 'true' },
    h('a', { class: 'auth-brand', href: '#/inicio', tabindex: '-1' },
        h('span', { class: 'brand-mark' }, 'ci'), h('span', {}, 'code', h('strong', {}, 'Int'))),
    h('div', { class: 'auth-pitch' },
        h('p', { class: 'auth-headline' }, 'Programa. Compite. ', h('em', {}, 'Sube de nivel.')),
        h('p', { class: 'auth-sub' }, 'Retos de PSeInt, salas en vivo con tu curso y un avatar que desbloqueas jugando.')),
    h('div', { class: 'auth-cast' }, CLASES.map((clase, index) => h('div', { class: 'auth-cast-item', style: { '--delay': `${index * 0.3}s` } },
        createAvatar(PRESETS[clase.id], { size: 64, label: '' })))),
    h('div', { class: 'auth-terminal' },
        h('div', { class: 'terminal-bar' }, h('i'), h('i'), h('i'), h('span', {}, 'ejercicio.psc')),
        h('pre', {}, CODE.join('\n')),
        h('p', { class: 'terminal-result' }, '✓ aprobado  +50 XP')));

// Carcasa común de las pantallas de cuenta: panel llamativo a la izquierda y formulario a la derecha.
export const authShell = ({ title, subtitle, content, footer = null }) => h('div', { class: 'auth-split' },
    showcase(),
    h('section', { class: 'auth-panel' },
        h('div', { class: 'auth-panel-inner' },
            h('a', { class: 'auth-back', href: '#/inicio' }, '← Volver al inicio'),
            h('div', { class: 'auth-head' },
                h('span', { class: 'brand-mark auth-mobile-mark', 'aria-hidden': 'true' }, 'ci'),
                h('h1', {}, title),
                subtitle ? h('p', { class: 'muted' }, subtitle) : null),
            content,
            footer)));
