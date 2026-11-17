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

export const tokenStore = {
    get() {
        try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
    },
    set(token) {
        try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* almacenamiento bloqueado */ }
    },
    clear() {
        try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* almacenamiento bloqueado */ }
    }
};

// Devuelve { status, body }. Lanza ApiError ante respuestas no exitosas.
// Si el body es FormData se envía tal cual (sin Content-Type manual) para
// permitir cargas multipart como el CSV de matrículas.
export async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
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
        if (response.status === 401 && auth && token) {
            tokenStore.clear();
            window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw new ApiError(response.status, parsed);
    }
    return { status: response.status, body: parsed };
}

export const api = async (path, options) => (await request(path, options)).body;
