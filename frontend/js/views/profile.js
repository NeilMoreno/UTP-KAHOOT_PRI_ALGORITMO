import { h, icon, setBusy, errorMessage, toast, openModal } from '../ui.js';
import { api, tokenStore } from '../api.js';
import { state, logout } from '../state.js';
import { navigate } from '../router.js';
import { createPasswordField, createPasswordConfirm } from '../password-field.js';
import { birthDateLimits, checkBirthDate } from '../age.js';

const ROLE_LABEL = {
    estudiante: 'Estudiante',
    docente: 'Docente',
    superadministrador: 'Superadministrador'
};

const infoRow = (label, value) => h('div', { class: 'info-row' },
    h('span', {}, label),
    h('strong', {}, value || '—'));

const field = (id, label, input, hint) => h('div', { class: 'field' },
    h('label', { for: id }, label),
    input,
    hint ? h('span', { class: 'hint' }, hint) : null);

const buildProfileForm = (user) => {
    const nombre = h('input', {
        class: 'input', id: 'nombre', value: user.nombre || '', autocomplete: 'given-name', required: true
    });
    const apellido = h('input', {
        class: 'input', id: 'apellido', value: user.apellido || '', autocomplete: 'family-name', required: true
    });
    const genero = h('select', { class: 'input', id: 'genero', required: true },
        h('option', { value: 'femenino' }, 'Femenino'),
        h('option', { value: 'masculino' }, 'Masculino'));
    genero.value = user.genero === 'masculino' ? 'masculino' : 'femenino';

    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Guardar datos');

    return h('form', {
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;
            setBusy(submit, true, 'Guardando…');
            try {
                const response = await api('/auth/me', {
                    method: 'PATCH',
                    body: {
                        nombre: nombre.value.trim(),
                        apellido: apellido.value.trim(),
                        genero: genero.value
                    }
                });
                state.user = { ...state.user, ...response.user };
                window.dispatchEvent(new CustomEvent('user:updated'));
                toast('Datos guardados.', 'success');
            } catch (error) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = errorMessage(error);
            } finally {
                setBusy(submit, false);
            }
        }
    },
    h('div', { class: 'form-grid' },
        field('nombre', 'Nombre', nombre),
        field('apellido', 'Apellido', apellido)),
    field('genero', 'Género', genero, 'Se usa para dirigirnos a ti correctamente.'),
    errorBox,
    h('div', { class: 'form-actions' }, submit));
};

// Fecha de nacimiento y términos. La fecha, una vez registrada, solo la cambia la administración.
const buildPrivacyPanel = (user) => {
    const host = h('div', { class: 'stack' });
    const render = () => {
        const current = state.user || user;
        const rows = [];
        const accepted = current.terminos_aceptados_en
            ? `Aceptados el ${new Date(current.terminos_aceptados_en).toLocaleDateString('es-PE')} (versión ${current.terminos_version})`
            : 'Aún no los aceptaste';
        rows.push(h('div', { class: 'info-list' },
            infoRow('Fecha de nacimiento', current.fecha_nacimiento ? `${current.fecha_nacimiento} · ${current.edad} años` : 'Sin registrar'),
            infoRow('Términos y privacidad', accepted)));

        if (!current.fecha_nacimiento) {
            const limits = birthDateLimits();
            const date = h('input', { class: 'input', id: 'perfil-nacimiento', type: 'date', min: limits.min, max: limits.max });
            const info = h('span', { class: 'hint', 'aria-live': 'polite' }, 'Se guarda una sola vez; luego solo la administración puede cambiarla.');
            const tutor = h('input', { type: 'checkbox', id: 'perfil-tutor' });
            const tutorRow = h('label', { class: 'check', for: 'perfil-tutor', hidden: true }, tutor,
                h('span', {}, 'Soy menor de 18 años y mi madre, padre o tutor autoriza que use codeInt.'));
            const save = h('button', { class: 'btn', type: 'button', disabled: true }, 'Guardar fecha');
            const sync = () => {
                const status = checkBirthDate(date.value);
                tutorRow.hidden = !(status.ok && status.minor);
                if (tutorRow.hidden) tutor.checked = false;
                info.className = `hint${status.message ? ' is-error' : ''}`;
                info.textContent = status.message || (status.ok ? `Tienes ${status.age} años.` : 'Se guarda una sola vez; luego solo la administración puede cambiarla.');
                save.disabled = !(status.ok && (!status.minor || tutor.checked));
            };
            date.addEventListener('input', sync);
            tutor.addEventListener('change', sync);
            save.addEventListener('click', async () => {
                setBusy(save, true, 'Guardando…');
                try {
                    const response = await api('/auth/me/nacimiento', {
                        method: 'PATCH',
                        body: { fecha_nacimiento: date.value, consentimiento_tutor: tutor.checked ? true : undefined }
                    });
                    state.user = { ...state.user, fecha_nacimiento: response.fecha_nacimiento, edad: response.edad };
                    toast(response.message, 'success');
                    render();
                } catch (error) {
                    toast(errorMessage(error), 'error');
                    setBusy(save, false);
                }
            });
            rows.push(h('div', { class: 'alert info' }, 'Falta tu fecha de nacimiento: la usamos para calcular tu edad y para estadísticas agregadas.'),
                field('perfil-nacimiento', 'Fecha de nacimiento', date, null), info, tutorRow, h('div', { class: 'form-actions' }, save));
        }

        if (!current.terminos_vigentes) {
            const accept = h('button', { class: 'btn', type: 'button' }, 'Aceptar términos');
            accept.addEventListener('click', async () => {
                setBusy(accept, true, 'Guardando…');
                try {
                    const response = await api('/auth/me/terminos', { method: 'POST', body: { acepta_terminos: true } });
                    state.user = { ...state.user, terminos_aceptados_en: response.terminos_aceptados_en, terminos_version: response.terminos_version, terminos_vigentes: true };
                    toast(response.message, 'success');
                    render();
                } catch (error) {
                    toast(errorMessage(error), 'error');
                    setBusy(accept, false);
                }
            });
            rows.push(h('p', { class: 'small' }, 'Lee los ', h('a', { href: '#/terminos', target: '_blank', rel: 'noopener' }, 'términos y la política de privacidad'), ' y acéptalos para seguir usando codeInt.'),
                h('div', { class: 'form-actions' }, accept));
        }
        host.replaceChildren(...rows);
    };
    render();
    return host;
};

const buildPasswordForm = () => {
    const currentPassword = h('input', {
        class: 'input', id: 'current_password', type: 'password', autocomplete: 'current-password', required: true
    });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Cambiar contraseña');
    const submitHint = h('p', { class: 'small muted', id: 'profile-pw-hint' });
    submit.setAttribute('aria-describedby', 'profile-pw-hint');
    const passwordField = createPasswordField({
        id: 'new_password', label: 'Nueva contraseña',
        getContext: () => ({ email: state.user?.email, nombre: state.user?.nombre, apellido: state.user?.apellido }),
        onChange: () => syncSubmit()
    });
    const confirmField = createPasswordConfirm({ id: 'confirm_password', label: 'Repite la nueva contraseña', primary: passwordField.input, onChange: () => syncSubmit() });
    const newPassword = passwordField.input;
    const confirmation = confirmField.input;
    currentPassword.addEventListener('input', () => syncSubmit());
    function syncSubmit() {
        const ready = currentPassword.value.length > 0 && passwordField.isValid() && confirmField.matches();
        submit.disabled = !ready;
        submitHint.textContent = ready ? '' : 'Escribe tu contraseña actual y una nueva que cumpla los requisitos.';
    }
    syncSubmit();

    return h('form', {
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;
            if (newPassword.value !== confirmation.value) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = 'La nueva contraseña y su confirmación no coinciden.';
                return;
            }
            setBusy(submit, true, 'Actualizando…');
            try {
                const response = await api('/auth/password', {
                    method: 'PATCH',
                    body: {
                        current_password: currentPassword.value,
                        new_password: newPassword.value
                    }
                });
                if (response.token) tokenStore.set(response.token);
                toast(response.message || 'Contraseña actualizada.', 'success');
                currentPassword.value = '';
                newPassword.value = '';
                confirmation.value = '';
                passwordField.refresh();
                confirmField.refresh();
            } catch (error) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = errorMessage(error);
            } finally {
                setBusy(submit, false);
            }
        }
    },
    field('current_password', 'Contraseña actual', currentPassword),
    passwordField.element,
    confirmField.element,
    errorBox,
    h('div', { class: 'form-actions' }, submit),
    submitHint);
};

const buildSessionPanel = () => {
    let closeModal = null;
    const revoke = h('button', {
        class: 'btn danger', type: 'button',
        onClick: async () => {
            setBusy(revoke, true, 'Cerrando…');
            try {
                await api('/auth/logout-all', { method: 'POST' });
                logout();
                if (closeModal) closeModal();
                toast('Todas las sesiones fueron cerradas.', 'success');
                navigate('/login');
            } catch (error) {
                toast(errorMessage(error), 'error');
                setBusy(revoke, false);
            }
        }
    }, icon('logout', 16), 'Cerrar todas las sesiones');

    closeModal = openModal(h('div', {},
        h('div', { class: 'modal-head' },
            h('div', {},
                h('h2', {}, 'Cerrar todas las sesiones'),
                h('p', { class: 'muted' }, 'Se cerrará tu sesión en este y en cualquier otro dispositivo.'))),
        h('div', { class: 'alert info' }, 'También se invalidarán los enlaces de acceso emitidos para esta cuenta.'),
        h('div', { class: 'form-actions' },
            h('button', { class: 'btn ghost', type: 'button', onClick: () => closeModal() }, 'Cancelar'),
            revoke)),
    { label: 'Cerrar todas las sesiones' });
};

export default async function profileView({ root, user }) {
    document.title = 'Mi cuenta · codeInt';

    const summary = h('div', { class: 'card' },
        h('h2', {}, 'Datos de la cuenta'),
        h('p', { class: 'muted' }, 'El correo y el rol institucional solo pueden cambiarse por administración.'),
        h('div', { class: 'info-list' },
            infoRow('Correo', user.email),
            infoRow('Rol', ROLE_LABEL[user.rol] || user.rol),
            infoRow('Institución', user.institucion_nombre || 'Plataforma'),
            infoRow('Correo verificado', user.correo_verificado ? 'Sí' : 'No'),
            infoRow('Estado', user.estado)));

    root.append(h('div', { class: 'container narrow' },
        h('div', { class: 'page-head' },
            h('div', {}, h('h1', {}, 'Mi cuenta'), h('p', { class: 'muted' }, 'Actualiza tus datos y protege tu acceso.'))),
        h('div', { class: 'stack' },
            summary,
            h('div', { class: 'card' },
                h('h2', {}, 'Datos personales'),
                h('p', { class: 'muted' }, 'Así aparecerás en el campus y en los rankings.'),
                buildProfileForm(user)),
            h('div', { class: 'card' },
                h('h2', {}, 'Edad y privacidad'),
                h('p', { class: 'muted' }, 'Tu fecha de nacimiento nunca se muestra a otros estudiantes.'),
                buildPrivacyPanel(user)),
            h('div', { class: 'card' },
                h('h2', {}, 'Contraseña'),
                h('p', { class: 'muted' }, 'Al cambiarla se revocan las sesiones anteriores y se emite una nueva para este navegador.'),
                buildPasswordForm()),
            h('div', { class: 'card' },
                h('h2', {}, 'Sesiones'),
                h('p', { class: 'muted' }, 'Si sospechas que otra persona tiene acceso a tu cuenta, cierra todas las sesiones.'),
                h('button', { class: 'btn secondary', type: 'button', onClick: buildSessionPanel }, icon('shield', 16), 'Cerrar todas las sesiones')))));
}
