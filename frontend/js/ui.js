// Utilidades de interfaz. Todo el contenido dinámico se inserta con textContent/nodos:
// nunca con innerHTML, para que los datos del servidor no puedan inyectar HTML.

const append = (el, children) => {
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
};

export const h = (tag, props = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key === 'style' && typeof value === 'object') {
            for (const [prop, val] of Object.entries(value)) {
                if (prop.startsWith('--')) el.style.setProperty(prop, val);
                else el.style[prop] = val;
            }
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) el.setAttribute(key, '');
        else el.setAttribute(key, value);
    }
    append(el, children);
    return el;
};

// Iconos SVG estáticos (contenido propio, no proviene de datos).
const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    play: '<path d="M6 4v16l14-8z"/>',
    sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4M5 17v4M3 19h4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    medal: '<circle cx="12" cy="15" r="6"/><path d="m8.5 3 3.5 6 3.5-6M9 21l3-3 3 3"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    arrow: '<path d="m15 18-6-6 6-6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    brand: '<path d="m8 6-5 6 5 6M16 6l5 6-5 6M13 4l-2 16"/>'
};

export const icon = (name, size = 18) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name] || '';
    return svg;
};

export const clear = (el) => {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
};

// ---------- Avisos ----------
let toastHost = null;
export const toast = (message, type = 'info', ms = 4500) => {
    if (!toastHost) {
        toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
        document.body.append(toastHost);
    }
    const node = h('div', { class: `toast ${type}` }, message);
    toastHost.append(node);
    setTimeout(() => node.remove(), ms);
};

// ---------- Modal accesible ----------
export const openModal = (content, { label = 'Diálogo', onClose } = {}) => {
    const previousFocus = document.activeElement;
    const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1' }, content);
    const backdrop = h('div', { class: 'modal-backdrop' }, dialog);

    const close = () => {
        document.removeEventListener('keydown', onKey);
        backdrop.remove();
        document.body.style.overflow = '';
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        if (onClose) onClose();
    };
    function onKey(event) {
        if (event.key === 'Escape') return close();
        if (event.key !== 'Tab') return;
        const focusable = dialog.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    document.body.append(backdrop);
    dialog.focus();
    return close;
};

// ---------- Formato ----------
const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : '—');
export const formatNumber = (value) => new Intl.NumberFormat('es-PE').format(Number(value) || 0);

export const setBusy = (button, busy, busyLabel = 'Procesando…') => {
    if (busy) {
        if (!button._idle) button._idle = [...button.childNodes];
        button.disabled = true;
        button.replaceChildren(h('span', { class: 'spinner' }), busyLabel);
    } else {
        button.disabled = false;
        if (button._idle) {
            button.replaceChildren(...button._idle);
            button._idle = null;
        }
    }
};

export const skeleton = (height = 90) => h('div', { class: 'skeleton', style: { height: `${height}px` } });

export const errorMessage = (error) => {
    if (error && error.name === 'ApiError') return error.message;
    return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
};
