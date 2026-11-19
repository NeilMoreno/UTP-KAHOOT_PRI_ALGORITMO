// Cliente del API de codeInt. El JWT vive solo en sessionStorage (se borra al cerrar la pestaña).

const TOKEN_KEY = 'codeint.token';

export class ApiError extends Error {
    constructor(status, body) {
        super((body && body.message) || 'Ocurrió un error inesperado.');
        this.name = 'ApiError';
        this.status = status;
        this.body = body || {};
        this.code = this.body.error || this.body.code || null;
    }
}

let refreshTimer = null;
let memoryToken = null; // respaldo si el almacenamiento está bloqueado

// Milisegundos hasta 2 minutos antes de que venza el token (se renueva a tiempo, sin esperar un 401).
const msUntilRenewal = (token) => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return Math.max(30_000, payload.exp * 1000 - Date.now() - 120_000);
    } catch { return null; }
};

export const tokenStore = {
    get() {
        try { return sessionStorage.getItem(TOKEN_KEY) || memoryToken; } catch { return memoryToken; }
    },
    set(token) {
        memoryToken = token;
        try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* almacenamiento bloqueado */ }
        clearTimeout(refreshTimer);
        const delay = msUntilRenewal(token);
        if (delay !== null) refreshTimer = setTimeout(() => { refreshAccessToken(); }, delay);
    },
    clear() {
        memoryToken = null;
        clearTimeout(refreshTimer);
        try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* almacenamiento bloqueado */ }
    }
};

// Pide un token de acceso nuevo con la cookie de refresco (HttpOnly). Una sola petición a la vez.
let refreshing = null;
export function refreshAccessToken() {
    if (!refreshing) {
        refreshing = fetch('/api/auth/refresh', { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then(async (response) => {
                if (!response.ok) return false;
                const body = await response.json().catch(() => null);
                if (!body?.token) return false;
                tokenStore.set(body.token);
                window.dispatchEvent(new CustomEvent('auth:refreshed'));
                return true;
            })
            .catch(() => false)
            .finally(() => { refreshing = null; });
    }
    return refreshing;
}

// Devuelve { status, body }. Lanza ApiError ante respuestas no exitosas.
// Si el body es FormData se envía tal cual (sin Content-Type manual) para
// permitir cargas multipart como el CSV de matrículas.
export async function request(path, { method = 'GET', body, headers = {}, auth = true, _retried = false } = {}) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const finalHeaders = { Accept: 'application/json', ...headers };
    if (body !== undefined && !isFormData) finalHeaders['Content-Type'] = 'application/json';
    const token = tokenStore.get();
    if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;

    const response = await fetch(`/api${path}`, {
        method,
        headers: finalHeaders,
        body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body))
    });

    let parsed = null;
    try { parsed = await response.json(); } catch { /* respuesta sin cuerpo JSON */ }

    if (!response.ok) {
        // Token vencido: se renueva en silencio una vez y se repite la petición.
        if (response.status === 401 && auth && token && !_retried && parsed?.error === 'TOKEN_EXPIRED' && await refreshAccessToken()) {
            return request(path, { method, body, headers, auth, _retried: true });
        }
        if (response.status === 401 && auth && token) {
            tokenStore.clear();
            window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw new ApiError(response.status, parsed);
    }
    return { status: response.status, body: parsed };
}

export const api = async (path, options) => (await request(path, options)).body;
