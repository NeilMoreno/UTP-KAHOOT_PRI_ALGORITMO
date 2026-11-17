// Estado de sesión compartido y preferencia de tema.
import { api, tokenStore } from './api.js';

export const state = { user: null };

export const isLoggedIn = () => Boolean(state.user);

export async function loadSession() {
    if (!tokenStore.get()) return null;
    try {
        const { user } = await api('/auth/me');
        state.user = user;
    } catch {
        tokenStore.clear();
        state.user = null;
    }
    return state.user;
}

export async function login(email, password) {
    const body = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    tokenStore.set(body.token);
    state.user = body.user;
    return body;
}

export function logout() {
    tokenStore.clear();
    state.user = null;
}

// Refresca XP y nivel (p. ej. tras una evaluación) sin recargar la página.
export async function refreshUser() {
    const { user } = await api('/auth/me');
    state.user = user;
    window.dispatchEvent(new CustomEvent('user:updated'));
    return user;
}

// ---------- Tema claro/oscuro ----------
const THEME_KEY = 'codeint.theme';

export function applyStoredTheme() {
    try {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
    } catch { /* almacenamiento bloqueado */ }
}

export function toggleTheme() {
    const root = document.documentElement;
    const current = root.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* almacenamiento bloqueado */ }
    return next;
}
