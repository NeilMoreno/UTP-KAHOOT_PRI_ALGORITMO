'use strict';

const { normalizeEmail } = require('../utils/validation');

class EmailDeliveryError extends Error {
    constructor(message = 'No fue posible entregar el correo transaccional.') {
        super(message);
        this.name = 'EmailDeliveryError';
        this.status = 503;
    }
}

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// El frontend es una SPA con router por hash (`/#/registro`). Cuando la URL base
// usa hash, el token debe viajar dentro de la ruta para que `currentQuery()` lo lea.
const buildActionUrl = (baseValue, token) => {
    const url = new URL(baseValue);
    if (url.hash) {
        const route = new URL(url.hash.slice(1) || '/', 'http://codeint.local');
        route.searchParams.set('token', token);
        url.hash = `${route.pathname}${route.search}`;
        return url.toString();
    }
    url.searchParams.set('token', token);
    return url.toString();
};

const buildInvitationUrl = (token) => buildActionUrl(
    process.env.FRONTEND_INVITATION_URL || 'http://localhost:5173/registro',
    token
);

const buildPasswordResetUrl = (token) => buildActionUrl(
    process.env.FRONTEND_PASSWORD_RESET_URL || 'http://localhost:5173/restablecer-password',
    token
);

const getCloudflareConfig = () => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
    const fromAddress = normalizeEmail(process.env.EMAIL_FROM_ADDRESS);
    const fromName = process.env.EMAIL_FROM_NAME || 'codeInt';
    if (!accountId || !apiToken || !fromAddress) return null;
    return { accountId, apiToken, fromAddress, fromName };
};

const delay = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const sendCloudflareEmail = async ({ to, subject, text, html }) => {
    const config = getCloudflareConfig();
    if (!config) throw new EmailDeliveryError('El proveedor de correo no está configurado.');

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/email/sending/send`;
    const body = {
        to,
        from: { address: config.fromAddress, name: config.fromName },
        subject,
        text,
        html
    };
    if (process.env.EMAIL_REPLY_TO) body.reply_to = process.env.EMAIL_REPLY_TO;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        let response;
        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10000)
            });
        } catch (error) {
            if (attempt < 2) {
                await delay(500 * (2 ** attempt));
                continue;
            }
            throw new EmailDeliveryError();
        }

        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.success === true) {
            return { sent: true, provider: 'cloudflare' };
        }

        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
            await delay(500 * (2 ** attempt));
            continue;
        }
        throw new EmailDeliveryError();
    }

    throw new EmailDeliveryError();
};

const sendTransactionalEmail = async (message) => {
    const to = normalizeEmail(message.to);
    if (!to) throw new EmailDeliveryError('El destinatario no es válido.');
    const provider = (process.env.EMAIL_PROVIDER || 'disabled').toLowerCase();
    if (provider === 'cloudflare') return sendCloudflareEmail({ ...message, to });
    if (provider === 'disabled') return { sent: false, provider: 'disabled' };
    throw new EmailDeliveryError('El proveedor de correo configurado no es compatible.');
};

const sendInvitationEmail = async ({ to, token, institutionName, role, expiresAt }) => {
    const actionUrl = buildInvitationUrl(token);
    const safeInstitution = escapeHtml(institutionName);
    const safeRole = escapeHtml(role);
    const safeUrl = escapeHtml(actionUrl);
    const expiration = new Date(expiresAt).toISOString();
    return sendTransactionalEmail({
        to,
        subject: `Invitación a codeInt — ${institutionName}`,
        text: `Has sido invitado como ${role} en ${institutionName}. Completa tu registro antes de ${expiration}: ${actionUrl}`,
        html: `<p>Has sido invitado como <strong>${safeRole}</strong> en <strong>${safeInstitution}</strong>.</p><p><a href="${safeUrl}">Completar registro en codeInt</a></p><p>El enlace vence el ${escapeHtml(expiration)} y solo puede usarse una vez.</p>`
    });
};

const sendPasswordResetEmail = async ({ to, token, expiresAt }) => {
    const actionUrl = buildPasswordResetUrl(token);
    const safeUrl = escapeHtml(actionUrl);
    const expiration = new Date(expiresAt).toISOString();
    return sendTransactionalEmail({
        to,
        subject: 'Restablecimiento de contraseña de codeInt',
        text: `Usa este enlace antes de ${expiration} para restablecer tu contraseña: ${actionUrl}`,
        html: `<p>Se solicitó restablecer tu contraseña de codeInt.</p><p><a href="${safeUrl}">Restablecer contraseña</a></p><p>El enlace vence el ${escapeHtml(expiration)} y solo puede usarse una vez. Si no lo solicitaste, ignora este mensaje.</p>`
    });
};

module.exports = {
    EmailDeliveryError,
    buildInvitationUrl,
    buildPasswordResetUrl,
    sendInvitationEmail,
    sendPasswordResetEmail
};
