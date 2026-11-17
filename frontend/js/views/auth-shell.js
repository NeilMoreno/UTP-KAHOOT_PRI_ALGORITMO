import { h } from '../ui.js';

// Carcasa común de las pantallas públicas de cuenta.
export const authShell = ({ title, subtitle, content }) => h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-card' },
        h('div', { class: 'auth-logo' },
            h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'ci'),
            h('h1', {}, title),
            h('p', { class: 'muted' }, subtitle)),
        content));
