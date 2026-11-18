import { h, setBusy, errorMessage } from '../ui.js';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { authShell } from './auth-shell.js';
import { createPasswordField, createPasswordConfirm } from '../password-field.js';
import { birthDateLimits, checkBirthDate } from '../age.js';

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
        // Fecha de nacimiento: obligatoria para estudiantes y opcional para docentes.
        const isStudent = invitation.rol === 'estudiante';
        const limits = birthDateLimits();
        const nacimiento = h('input', { class: 'input', id: 'nacimiento', type: 'date', min: limits.min, max: limits.max, required: isStudent, 'aria-describedby': 'nacimiento-info' });
        const nacimientoInfo = h('span', { class: 'hint', id: 'nacimiento-info', 'aria-live': 'polite' },
            isStudent ? 'La usamos para calcular tu edad y para estadísticas agregadas.' : 'Opcional.');
        const tutorCheck = h('input', { type: 'checkbox', id: 'tutor' });
        const tutorRow = h('label', { class: 'check', for: 'tutor', hidden: true }, tutorCheck,
            h('span', {}, 'Soy menor de 18 años y mi madre, padre o tutor autoriza que use codeInt.'));
        const termsCheck = h('input', { type: 'checkbox', id: 'terminos', required: true });
        const termsRow = h('label', { class: 'check', for: 'terminos' }, termsCheck,
            h('span', {}, 'Acepto los ', h('a', { href: '#/terminos', target: '_blank', rel: 'noopener' }, 'términos de uso y la política de privacidad'), '.'));
        const dateState = () => checkBirthDate(nacimiento.value);
        const syncDate = () => {
            const state = dateState();
            tutorRow.hidden = !(state.ok && state.minor);
            if (tutorRow.hidden) tutorCheck.checked = false;
            nacimientoInfo.className = `hint${state.message ? ' is-error' : ''}`;
            nacimientoInfo.textContent = state.message
                || (state.ok ? `Tienes ${state.age} años.` : (isStudent ? 'La usamos para calcular tu edad y para estadísticas agregadas.' : 'Opcional.'));
            syncSubmit();
        };
        nacimiento.addEventListener('input', syncDate);
        tutorCheck.addEventListener('change', () => syncSubmit());
        termsCheck.addEventListener('change', () => syncSubmit());

        const error = h('div', { role: 'alert', hidden: true });
        const submit = h('button', { class: 'btn block', type: 'submit' }, 'Crear cuenta');
        const submitHint = h('p', { class: 'small muted', id: 'register-submit-hint' });
        submit.setAttribute('aria-describedby', 'register-submit-hint');
        let form = null;
        // La regla "no incluye tu nombre ni tu correo" usa lo que se va escribiendo en el formulario.
        const passwordField = createPasswordField({
            id: 'password', label: 'Contraseña',
            getContext: () => ({
                email: invitation.email,
                nombre: form?.querySelector('#nombre')?.value || '',
                apellido: form?.querySelector('#apellido')?.value || ''
            }),
            onChange: () => syncSubmit()
        });
        const confirmField = createPasswordConfirm({ id: 'password2', primary: passwordField.input, onChange: () => syncSubmit() });
        function syncSubmit() {
            const date = dateState();
            const dateReady = nacimiento.value ? date.ok : !isStudent;
            const tutorReady = !(date.ok && date.minor) || tutorCheck.checked;
            const passwordReady = passwordField.isValid() && confirmField.matches();
            const ready = passwordReady && dateReady && tutorReady && termsCheck.checked;
            submit.disabled = !ready;
            submitHint.textContent = ready ? ''
                : (!passwordReady ? 'Completa los requisitos de la contraseña y repítela para continuar.'
                    : (!dateReady ? 'Indica una fecha de nacimiento válida para continuar.'
                        : (!tutorReady ? 'Necesitamos la autorización de tu apoderado o tutor.' : 'Acepta los términos para continuar.')));
        }
        form = h('form', {
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
                            password: value('password'),
                            fecha_nacimiento: nacimiento.value || undefined,
                            acepta_terminos: termsCheck.checked,
                            consentimiento_tutor: tutorCheck.checked ? true : undefined
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
        h('div', { class: 'field' }, h('label', { for: 'nacimiento' }, isStudent ? 'Fecha de nacimiento' : 'Fecha de nacimiento (opcional)'), nacimiento, nacimientoInfo),
        passwordField.element,
        confirmField.element,
        tutorRow, termsRow,
        error, submit, submitHint);
        // El nombre y el apellido forman parte de la regla de datos personales: se reevalúa al escribirlos.
        form.querySelector('#nombre').addEventListener('input', () => passwordField.refresh());
        form.querySelector('#apellido').addEventListener('input', () => passwordField.refresh());
        syncSubmit();
        card.replaceChildren(form);
    };

    const initialToken = query.get('token') || '';
    showTokenForm(initialToken);
}
