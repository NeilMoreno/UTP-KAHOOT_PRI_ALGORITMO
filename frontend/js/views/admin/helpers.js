// Utilidades compartidas por el panel del superadministrador.
import { h, openModal, setBusy, errorMessage } from '../../ui.js';
import { api } from '../../api.js';

export const ROLE_LABELS = {
    superadministrador: 'Superadministrador',
    docente: 'Docente',
    estudiante: 'Estudiante'
};

export const roleChip = (rol) => h('span', {
    class: `chip ${rol === 'docente' ? 'blue' : (rol === 'estudiante' ? 'green' : 'ai')}`.trim()
}, ROLE_LABELS[rol] || rol);

// Confirmación reutilizable para acciones sensibles.
export const confirmModal = ({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm }) => {
    const confirm = h('button', { class: `btn ${danger ? 'danger' : ''}`.trim(), type: 'button' });
    confirm.textContent = confirmLabel;
    const errorBox = h('div', { role: 'alert', hidden: true });

    confirm.addEventListener('click', async () => {
        errorBox.hidden = true;
        setBusy(confirm, true, 'Procesando…');
        try {
            await onConfirm();
            close();
        } catch (error) {
            errorBox.className = 'alert error';
            errorBox.hidden = false;
            errorBox.textContent = errorMessage(error);
            setBusy(confirm, false);
        }
    });

    const close = openModal(h('div', {},
        h('div', { class: 'modal-head' }, h('h2', {}, title)),
        h('p', { class: 'muted' }, message),
        errorBox,
        h('div', { class: 'form-actions' },
            confirm,
            h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cancelar'))),
    { label: title });

    confirm.focus();
};

export const loadInstitutions = () => api('/auth/admin/instituciones');

export const statusAction = async ({ user, estado, onDone }) => {
    const response = await api(`/auth/usuarios/${user.id_usuario}/estado`, {
        method: 'PATCH',
        body: { estado }
    });
    if (onDone) onDone(response);
    return response;
};
