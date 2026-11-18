import { h, setBusy, errorMessage } from '../ui.js';
import { login } from '../state.js';
import { navigate } from '../router.js';
import { authShell } from './auth-shell.js';

const PENDING_PIN_KEY = 'codeint.pendingPin'; // lo guarda la landing (views/landing.js)

const readPendingPin = () => {
    try { return sessionStorage.getItem(PENDING_PIN_KEY) || ''; } catch { return ''; }
};
const clearPendingPin = () => {
    try { sessionStorage.removeItem(PENDING_PIN_KEY); } catch { /* almacenamiento bloqueado */ }
};

export default function loginView({ root }) {
    document.title = 'Iniciar sesión · codeInt';

    const errorBox = h('div', { role: 'alert', hidden: true });
    const email = h('input', { class: 'input', id: 'email', type: 'email', autocomplete: 'username', required: true, placeholder: 'tu.correo@institucion.edu' });
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
                const { user } = await login(email.value.trim(), password.value);
                const pin = readPendingPin();
                clearPendingPin();
                navigate(pin && /^\d{6}$/.test(pin) && user.rol === 'estudiante' ? `/jugar/${pin}` : '/');
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

    root.append(authShell({
        title: 'Bienvenido de nuevo',
        subtitle: 'Entra con tu correo institucional para seguir tu ruta.',
        content: form,
        footer: h('p', { class: 'auth-foot' },
            '¿Tienes una invitación? ', h('a', { href: '#/registro' }, 'Crea tu cuenta'))
    }));

    if (new URLSearchParams(location.hash.split('?')[1] || '').get('expired')) {
        showError('Tu sesión expiró. Inicia sesión de nuevo.');
    }
    const pendingPin = readPendingPin();
    if (pendingPin && /^\d{6}$/.test(pendingPin)) {
        errorBox.className = 'alert info';
        errorBox.hidden = false;
        errorBox.textContent = `Inicia sesión para entrar a la sala ${pendingPin}.`;
    }
    email.focus();
}
