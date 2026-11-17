import { h, setBusy, errorMessage } from '../ui.js';
import { login } from '../state.js';
import { navigate } from '../router.js';

export default function loginView({ root }) {
    document.title = 'Iniciar sesión · codeInt';

    const errorBox = h('div', { role: 'alert', hidden: true });
    const email = h('input', { class: 'input', id: 'email', type: 'email', autocomplete: 'username', required: true, placeholder: 'tu.correo@utp.edu.pe' });
    const password = h('input', { class: 'input', id: 'password', type: 'password', autocomplete: 'current-password', required: true });
    const submit = h('button', { class: 'btn block', type: 'submit' }, 'Ingresar');

    const showError = (message) => {
        errorBox.className = 'alert error';
        errorBox.hidden = false;
        errorBox.textContent = message;
    };

    const form = h('form', {
        novalidate: true,
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;
            if (!email.value.trim() || !password.value) return showError('Ingresa tu correo y tu contraseña.');
            setBusy(submit, true, 'Ingresando…');
            try {
                await login(email.value.trim(), password.value);
                navigate('/');
            } catch (error) {
                showError(errorMessage(error));
                setBusy(submit, false);
            }
        }
    },
    h('div', { class: 'field' }, h('label', { for: 'email' }, 'Correo institucional'), email),
    h('div', { class: 'field' }, h('label', { for: 'password' }, 'Contraseña'), password),
    h('p', { class: 'small', style: { marginTop: '-6px', marginBottom: '12px' } },
        h('a', { href: '#/recuperar-password' }, '¿Olvidaste tu contraseña?')),
    errorBox,
    h('div', { style: { marginTop: '14px' } }, submit));

    root.append(h('div', { class: 'auth-wrap' },
        h('div', { class: 'auth-card' },
            h('div', { class: 'auth-logo' },
                h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'ci'),
                h('h1', {}, 'codeInt'),
                h('p', { class: 'muted' }, 'Aprende algoritmos en PSeInt jugando')),
            h('div', { class: 'card' }, form,
                h('p', { class: 'small muted', style: { marginTop: '16px', marginBottom: 0 } },
                    '¿Tienes una invitación? ', h('a', { href: '#/registro' }, 'Crea tu cuenta'))))));

    if (new URLSearchParams(location.hash.split('?')[1] || '').get('expired')) {
        showError('Tu sesión expiró. Inicia sesión de nuevo.');
    }
    email.focus();
}
