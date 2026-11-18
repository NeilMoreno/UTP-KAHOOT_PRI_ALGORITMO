import { h, setBusy, errorMessage } from '../ui.js';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { authShell } from './auth-shell.js';

const PASSWORD_HINT = 'Mínimo 10 caracteres, con mayúsculas, minúsculas y números.';

export default async function registerView({ root, query }) {
    document.title = 'Crear cuenta · codeInt';

    const card = h('div', { class: 'auth-form' });
    root.append(authShell({
        title: 'Crear cuenta',
        subtitle: 'El registro es solo por invitación institucional.',
        content: card,
        footer: h('p', { class: 'auth-foot' }, h('a', { href: '#/login' }, 'Volver a iniciar sesión'))
    }));

    const showTokenForm = (initial = '') => {
        const token = h('input', { class: 'input', id: 'token', value: initial, autocomplete: 'off', required: true });
        const error = h('div', { role: 'alert', hidden: true });
        const submit = h('button', { class: 'btn block', type: 'submit' }, 'Validar invitación');
        card.replaceChildren(h('form', {
            onSubmit: async (event) => {
                event.preventDefault();
                error.hidden = true;
                setBusy(submit, true, 'Validando…');
                try {
                    const { invitation } = await api('/auth/invitation/inspect', {
                        method: 'POST', body: { invitation_token: token.value.trim() }, auth: false
                    });
                    showRegistration(token.value.trim(), invitation);
                } catch (e) {
                    error.className = 'alert error';
                    error.hidden = false;
                    error.textContent = errorMessage(e);
                    setBusy(submit, false);
                }
            }
        },
        h('div', { class: 'field' },
            h('label', { for: 'token' }, 'Código de tu invitación'), token,
            h('span', { class: 'hint' }, 'Está en el enlace del correo que te envió tu institución. Si abres el enlace, se completa solo.')),
        error, submit,
        h('p', { class: 'small muted', style: { textAlign: 'center', marginTop: '14px', marginBottom: 0 } },
            'Si el enlace venció o ya fue usado, solicita una nueva invitación a tu institución.')));
    };

    const showRegistration = (invitationToken, invitation) => {
        const field = (id, label, attrs = {}, hint) => h('div', { class: 'field' },
            h('label', { for: id }, label), h('input', { class: 'input', id, required: true, ...attrs }),
            hint ? h('span', { class: 'hint' }, hint) : null);
        const genero = h('select', { class: 'input', id: 'genero', required: true },
            h('option', { value: '' }, 'Selecciona…'),
            h('option', { value: 'femenino' }, 'Femenino'),
            h('option', { value: 'masculino' }, 'Masculino'));
        const error = h('div', { role: 'alert', hidden: true });
        const submit = h('button', { class: 'btn block', type: 'submit' }, 'Crear cuenta');
        const form = h('form', {
            onSubmit: async (event) => {
                event.preventDefault();
                error.hidden = true;
                const value = (id) => form.querySelector(`#${id}`).value;
                if (value('password') !== value('password2')) {
                    error.className = 'alert error';
                    error.hidden = false;
                    error.textContent = 'Las contraseñas no coinciden.';
                    return;
                }
                setBusy(submit, true, 'Creando cuenta…');
                try {
                    const response = await api('/auth/register', {
                        method: 'POST', auth: false,
                        body: {
                            invitation_token: invitationToken,
                            nombre: value('nombre').trim(),
                            apellido: value('apellido').trim(),
                            genero: value('genero'),
                            password: value('password')
                        }
                    });
                    card.replaceChildren(
                        h('div', { class: 'alert success' }, response.message || 'Cuenta creada correctamente.'),
                        h('p', { style: { marginTop: '14px' } }, 'Ya puedes iniciar sesión con tu correo institucional.'),
                        h('button', { class: 'btn block', type: 'button', onClick: () => navigate('/login') }, 'Ir a iniciar sesión'));
                } catch (e) {
                    error.className = 'alert error';
                    error.hidden = false;
                    error.textContent = errorMessage(e);
                    setBusy(submit, false);
                }
            }
        },
        h('p', { class: 'small muted' }, `Invitación para ${invitation.email} · ${invitation.institucion_nombre}`),
        field('nombre', 'Nombre', { autocomplete: 'given-name' }),
        field('apellido', 'Apellido', { autocomplete: 'family-name' }),
        h('div', { class: 'field' }, h('label', { for: 'genero' }, 'Género'), genero),
        field('password', 'Contraseña', { type: 'password', autocomplete: 'new-password' }, PASSWORD_HINT),
        field('password2', 'Repite la contraseña', { type: 'password', autocomplete: 'new-password' }),
        error, submit);
        card.replaceChildren(form);
    };

    const initialToken = query.get('token') || '';
    showTokenForm(initialToken);
}
