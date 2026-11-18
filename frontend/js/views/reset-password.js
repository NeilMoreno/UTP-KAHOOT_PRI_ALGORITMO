import { h, setBusy, errorMessage } from '../ui.js';
import { api } from '../api.js';
import { authShell } from './auth-shell.js';
import { createPasswordField, createPasswordConfirm } from '../password-field.js';

export default async function resetPasswordView({ root, query }) {
    document.title = 'Restablecer contraseña · codeInt';

    const card = h('div', { class: 'card' });
    root.append(authShell({
        title: 'Nueva contraseña',
        subtitle: 'Crea una contraseña nueva para tu cuenta de codeInt.',
        content: card
    }));

    const token = (query.get('token') || '').trim();
    if (!token) {
        card.append(
            h('div', { class: 'alert error' }, 'El enlace no incluye un token de recuperación.'),
            h('p', { class: 'muted' }, 'Solicita un enlace nuevo para continuar.'),
            h('a', { class: 'btn block', href: '#/recuperar-password' }, 'Solicitar enlace'),
            h('p', { class: 'small muted', style: { textAlign: 'center', marginTop: '16px', marginBottom: 0 } },
                h('a', { href: '#/login' }, 'Volver a iniciar sesión')));
        return;
    }

    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn block', type: 'submit' }, 'Restablecer contraseña');
    const submitHint = h('p', { class: 'small muted', id: 'reset-submit-hint' });
    submit.setAttribute('aria-describedby', 'reset-submit-hint');
    // El servidor además comprueba que no incluya tu nombre o correo (el enlace no los entrega al navegador).
    const passwordField = createPasswordField({ id: 'password', label: 'Nueva contraseña', onChange: () => syncSubmit() });
    const confirmField = createPasswordConfirm({ id: 'password2', label: 'Repite la nueva contraseña', primary: passwordField.input, onChange: () => syncSubmit() });
    const password = passwordField.input;
    const confirmation = confirmField.input;
    function syncSubmit() {
        const ready = passwordField.isValid() && confirmField.matches();
        submit.disabled = !ready;
        submitHint.textContent = ready ? '' : 'Completa los requisitos y repite la contraseña para continuar.';
    }
    syncSubmit();

    const showError = (message) => {
        errorBox.className = 'alert error';
        errorBox.hidden = false;
        errorBox.textContent = message;
    };

    const form = h('form', {
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;
            if (!password.value || !confirmation.value) return showError('Completa ambos campos.');
            if (password.value !== confirmation.value) return showError('Las contraseñas no coinciden.');
            setBusy(submit, true, 'Actualizando…');
            try {
                const response = await api('/auth/password/reset', {
                    method: 'POST', auth: false,
                    body: { token, new_password: password.value }
                });
                card.replaceChildren(
                    h('div', { class: 'alert success' }, response.message || 'Contraseña restablecida.'),
                    h('p', { class: 'small muted' }, 'Por seguridad, todas las sesiones anteriores fueron revocadas.'),
                    h('a', { class: 'btn block', href: '#/login' }, 'Iniciar sesión'));
            } catch (error) {
                showError(errorMessage(error));
                setBusy(submit, false);
            }
        }
    },
    passwordField.element,
    confirmField.element,
    errorBox,
    submit,
    submitHint);

    card.append(form,
        h('p', { class: 'small muted', style: { marginTop: '16px', marginBottom: 0 } },
            'Si el enlace venció, ',
            h('a', { href: '#/recuperar-password' }, 'solicita uno nuevo'),
            '.'));
    password.focus();
}
