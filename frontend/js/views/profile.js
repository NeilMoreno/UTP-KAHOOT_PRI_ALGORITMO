import { h, icon, setBusy, errorMessage, toast, openModal } from '../ui.js';
import { api, tokenStore } from '../api.js';
import { state, logout } from '../state.js';
import { navigate } from '../router.js';

const PASSWORD_HINT = 'Mínimo 10 caracteres, con mayúsculas, minúsculas y números.';
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

const buildPasswordForm = () => {
    const currentPassword = h('input', {
        class: 'input', id: 'current_password', type: 'password', autocomplete: 'current-password', required: true
    });
    const newPassword = h('input', {
        class: 'input', id: 'new_password', type: 'password', autocomplete: 'new-password', required: true
    });
    const confirmation = h('input', {
        class: 'input', id: 'confirm_password', type: 'password', autocomplete: 'new-password', required: true
    });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Cambiar contraseña');

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
    h('div', { class: 'form-grid' },
        field('new_password', 'Nueva contraseña', newPassword, PASSWORD_HINT),
        field('confirm_password', 'Repite la nueva contraseña', confirmation)),
    errorBox,
    h('div', { class: 'form-actions' }, submit));
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
                h('h2', {}, 'Contraseña'),
                h('p', { class: 'muted' }, 'Al cambiarla se revocan las sesiones anteriores y se emite una nueva para este navegador.'),
                buildPasswordForm()),
            h('div', { class: 'card' },
                h('h2', {}, 'Sesiones'),
                h('p', { class: 'muted' }, 'Si sospechas que otra persona tiene acceso a tu cuenta, cierra todas las sesiones.'),
                h('button', { class: 'btn secondary', type: 'button', onClick: buildSessionPanel }, icon('shield', 16), 'Cerrar todas las sesiones')))));
}
