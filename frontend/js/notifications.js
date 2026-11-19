// Campana de notificaciones de la barra superior: contador de pendientes, lista desplegable y marcar como leídas.
// Consulta el servidor al abrir y cada minuto mientras la campana siga en pantalla. Todo el texto se inserta con
// nodos (nunca innerHTML) y el enlace solo se sigue si es una ruta interna (#/...).
import { h, icon, formatDate } from './ui.js';
import { api } from './api.js';
import { navigate } from './router.js';

const POLL_MS = 60000;
const safeRoute = (link) => (typeof link === 'string' && /^#\/[A-Za-z0-9/_?=&.-]*$/.test(link) ? link.slice(1) : null);

export const createBell = () => {
    let items = [];
    let unread = 0;
    let open = false;
    let timer = null;

    const badge = h('span', { class: 'bell-badge', hidden: true, 'aria-hidden': 'true' }, '0');
    const button = h('button', { class: 'topbar-icon bell', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-label': 'Notificaciones' }, icon('bell', 18), badge);
    const panel = h('div', { class: 'bell-panel', role: 'region', 'aria-label': 'Notificaciones', hidden: true });
    const root = h('div', { class: 'bell-wrap' }, button, panel);

    const paintBadge = () => {
        badge.textContent = unread > 9 ? '9+' : String(unread);
        badge.hidden = unread === 0;
        button.setAttribute('aria-label', unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones');
    };

    const markRead = async (id) => {
        await api(id ? `/notificaciones/${id}/leer` : '/notificaciones/leer', { method: 'POST' }).catch(() => {});
    };

    const paintPanel = () => {
        panel.replaceChildren(
            h('div', { class: 'bell-head' }, h('strong', {}, 'Notificaciones'),
                h('button', { class: 'text-action', type: 'button', disabled: unread === 0, onClick: async () => { await markRead(null); await load(); } }, 'Marcar todas')),
            items.length === 0
                ? h('p', { class: 'muted small', style: { padding: '12px' } }, 'Todavía no tienes notificaciones.')
                : h('ul', { class: 'bell-list' }, items.map((item) => h('li', {},
                    h('button', {
                        class: `bell-item${item.leida_en ? '' : ' is-unread'}`, type: 'button',
                        onClick: async () => {
                            const route = safeRoute(item.enlace);
                            if (!item.leida_en) await markRead(item.id_notificacion);
                            setOpen(false);
                            await load();
                            if (route) navigate(route);
                        }
                    }, h('strong', {}, item.titulo), h('span', {}, item.mensaje), h('small', { class: 'muted' }, formatDate(item.fecha_creacion)))))));
    };

    const load = async () => {
        try {
            const body = await api('/notificaciones');
            items = body.data;
            unread = body.sin_leer;
        } catch { /* sin conexión: se conserva lo último */ }
        paintBadge();
        if (open) paintPanel();
    };

    const setOpen = (value) => {
        open = value;
        panel.hidden = !value;
        button.setAttribute('aria-expanded', String(value));
        if (value) { paintPanel(); load(); }
    };

    button.addEventListener('click', () => setOpen(!open));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && open) { setOpen(false); button.focus(); } });
    document.addEventListener('click', (event) => { if (open && !root.contains(event.target)) setOpen(false); });

    const tick = () => {
        if (!root.isConnected) { clearInterval(timer); return; } // la carcasa se redibujó: un nuevo timbre toma el relevo
        load();
    };
    timer = setInterval(tick, POLL_MS);
    load();
    return root;
};
