'use strict';

// Cliente mínimo y compartido de Gemini (texto → JSON estructurado) con el mapeo de errores del proyecto:
//   clave inválida / solicitud no aceptada → no se reintentan; 429/5xx/tiempo agotado → reintento con espera.
// `fetchImpl` y `retryDelayMs` son inyectables para las pruebas.

const { DEFAULT_MODEL, GeminiServiceError } = require('./geminiService');

const positiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const callOnce = async ({ systemText, userText, schema, maxOutputTokens, timeoutMs, fetchImpl }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'tu_api_key_de_gemini') {
        throw new GeminiServiceError('La IA no está configurada.', { code: 'GEMINI_NOT_CONFIGURED', status: 503 });
    }
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)) {
        throw new GeminiServiceError('El modelo Gemini configurado no es válido.', { code: 'GEMINI_INVALID_MODEL', status: 500 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
        response = await fetchImpl(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemText }] },
                    contents: [{ role: 'user', parts: [{ text: userText }] }],
                    generationConfig: {
                        maxOutputTokens,
                        thinkingConfig: { thinkingLevel: 'LOW' },
                        responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } }
                    }
                }),
                signal: controller.signal
            }
        );
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new GeminiServiceError('Gemini no respondió dentro del tiempo permitido.', { code: 'GEMINI_TIMEOUT', status: 504, retryable: true, cause: error });
        }
        throw new GeminiServiceError('No fue posible conectar con Gemini.', { code: 'GEMINI_UNAVAILABLE', status: 503, retryable: true, cause: error });
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        let detail = '';
        try { detail = String((await response.json())?.error?.message || ''); } catch { /* sin cuerpo legible */ }
        if ([401, 403].includes(response.status) || /api key|permission|forbidden|unauthenticated/i.test(detail)) {
            throw new GeminiServiceError('La clave de Gemini no es válida o no tiene permisos. Avisa a la administración.', { code: 'GEMINI_AUTH_ERROR', status: 502, retryable: false });
        }
        if (response.status === 400 || response.status === 404) {
            throw new GeminiServiceError('Gemini no aceptó la solicitud (modelo o formato no compatible). Avisa a la administración.', { code: 'GEMINI_BAD_REQUEST', status: 502, retryable: false });
        }
        const retryable = response.status === 429 || response.status >= 500;
        throw new GeminiServiceError('Gemini rechazó temporalmente la solicitud.', {
            code: response.status === 429 ? 'GEMINI_RATE_LIMITED' : 'GEMINI_UPSTREAM_ERROR', status: retryable ? 503 : 502, retryable
        });
    }

    let payload;
    try {
        payload = await response.json();
    } catch (error) {
        throw new GeminiServiceError('Gemini devolvió una respuesta ilegible.', { code: 'GEMINI_INVALID_RESPONSE', cause: error });
    }
    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text).filter((part) => typeof part === 'string').join('');
    if (!text) {
        const blocked = payload?.promptFeedback?.blockReason;
        throw new GeminiServiceError(blocked ? 'Gemini bloqueó el contenido enviado.' : 'Gemini no devolvió una respuesta.', {
            code: blocked ? 'GEMINI_CONTENT_BLOCKED' : 'GEMINI_EMPTY_RESPONSE'
        });
    }
    const tokenCount = payload?.usageMetadata?.totalTokenCount;
    if (!Number.isSafeInteger(tokenCount) || tokenCount < 0) {
        throw new GeminiServiceError('Gemini no informó el consumo de tokens.', { code: 'GEMINI_MISSING_USAGE' });
    }
    let json;
    try {
        json = JSON.parse(text);
    } catch (error) {
        const invalid = new GeminiServiceError('Gemini devolvió JSON no válido.', { code: 'GEMINI_INVALID_RESPONSE', cause: error });
        invalid.tokensUsed = tokenCount;
        throw invalid;
    }
    return { json, tokens: tokenCount, model: payload.modelVersion || model };
};

// Devuelve { json, tokens, model }. Reintenta solo errores transitorios (2 veces, espera creciente).
const callGemini = async ({
    systemText, userText, schema, maxOutputTokens = 1000,
    timeoutMs = positiveInt(process.env.GEMINI_TIMEOUT_MS, 30000), fetchImpl = globalThis.fetch, retryDelayMs
}) => {
    for (let retry = 0; ; retry += 1) {
        try {
            return await callOnce({ systemText, userText, schema, maxOutputTokens, timeoutMs, fetchImpl });
        } catch (error) {
            if (!error.retryable || retry >= 2) throw error;
            await sleep(retryDelayMs ?? 2000 * (retry + 1));
        }
    }
};

module.exports = { callGemini };
