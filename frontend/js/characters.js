import { api } from './api.js';
import { state } from './state.js';
import { normalizeAvatar, renderAvatarSvg, className } from './avatar-parts.js';

export { normalizeAvatar, className };

const STORAGE_KEY = 'codeint.avatar.v2';

// Avatar actual: sesión (BD) con la caché local como respaldo.
export const getAvatarChoice = () => {
    if (state.user?.avatar) return normalizeAvatar(state.user.avatar);
    try { return normalizeAvatar(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return normalizeAvatar(null); }
};

export async function saveAvatarChoice(choice) {
    const safe = normalizeAvatar(choice);
    const body = await api('/auth/me/avatar', { method: 'PATCH', body: safe });
    const saved = normalizeAvatar(body.avatar || safe);
    if (state.user) state.user.avatar = saved;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* almacenamiento bloqueado */ }
    window.dispatchEvent(new CustomEvent('avatar:updated', { detail: saved }));
    window.dispatchEvent(new CustomEvent('user:updated')); // redibuja sidebar/topbar al instante
    return saved;
}

// <span> con el pixel art del avatar. Reutilizable en salas, perfil, sidebar y miniaturas del editor.
export function createAvatar(avatar, { size = 48, label = 'Avatar', className: extra = '' } = {}) {
    const wrapper = document.createElement('span');
    wrapper.className = `avatar ${extra}`.trim();
    wrapper.style.setProperty('--avatar-size', `${size}px`);
    if (label) {
        wrapper.setAttribute('role', 'img');
        wrapper.setAttribute('aria-label', label);
    } else {
        wrapper.setAttribute('aria-hidden', 'true');
    }
    wrapper.innerHTML = renderAvatarSvg(avatar); // SVG generado con piezas de un catálogo cerrado (ver avatar-parts.js)
    return wrapper;
}
