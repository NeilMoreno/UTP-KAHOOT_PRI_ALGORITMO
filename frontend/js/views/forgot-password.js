import { h, setBusy, errorMessage } from '../ui.js';
import { api } from '../api.js';
import { authShell } from './auth-shell.js';

export default async function forgotPasswordView({ root }) {
    document.title = 'Recuperar contraseña · codeInt';

    const card = h('div', { class: 'card' });
    root.append(authShell({
        title: 'Recuperar acceso',
        subtitle: 'Te enviaremos un enlace de un solo uso a tu correo institucional.',
        content: card
    }));

    const email = h('input', {
        class: 'input', id: 'email', type: 'email', autocomplete: 'username', required: true,
        placeholder: 'tu.correo@institucion.edu'
    });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn block', type: 'submit' }, 'Enviar enlace');

    const form = h('form', {
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;
            const value = email.value.trim();
            if (!value) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = 'Ingresa tu correo institucional.';
                return;
            }
            setBusy(submit, true, 'Enviando…');
            try {
                const response = await api('/auth/password/forgot', {
                    method: 'POST', auth: false, body: { email: value }
                });
                const parts = [];
                if (response.dev_reset_url) {
                    parts.push(h('div', { class: 'alert info' },
                        'Entorno local sin correo: ',
                        h('a', { href: response.dev_reset_url }, 'abrir el enlace de restablecimiento')));
                }
                parts.push(
                    h('div', { class: 'alert success' },
                        'Si el correo corresponde a una cuenta activa, recibirás un enlace para restablecer tu contraseña.'),
                    h('p', { class: 'small muted' }, 'El enlace vence en 30 minutos y solo puede usarse una vez. Revisa también la carpeta de spam.'),
                    h('button', { class: 'btn block', type: 'button', onClick: () => { location.hash = '#/login'; } }, 'Volver a iniciar sesión'));
                card.replaceChildren(...parts);
            } catch (error) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = errorMessage(error);
                setBusy(submit, false);
            }
        }
    },
    h('div', { class: 'field' },
        h('label', { for: 'email' }, 'Correo institucional'), email,
        h('span', { class: 'hint' }, 'Usa el mismo correo con el que accedes a codeInt.')),
    errorBox,
    submit,
    h('p', { class: 'small muted', style: { textAlign: 'center', marginTop: '16px', marginBottom: 0 } },
        h('a', { href: '#/login' }, 'Volver a iniciar sesión')));

    card.append(form);
    email.focus();
}
