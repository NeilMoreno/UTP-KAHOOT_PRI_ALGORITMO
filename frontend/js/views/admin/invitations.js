import {
    h, icon, skeleton, errorMessage, formatNumber, formatDate,
    openModal, setBusy, toast
} from '../../ui.js';
import { api } from '../../api.js';
import { emptyState, statusChip } from '../teacher/helpers.js';
import { confirmModal, loadInstitutions, roleChip } from './helpers.js';

const invitationRow = (invitation, reload) => h('tr', {},
    h('td', {}, h('div', { class: 'cell-main' },
        h('strong', {}, invitation.email),
        h('small', {}, invitation.institucion_nombre))),
    h('td', {}, roleChip(invitation.rol)),
    h('td', {}, statusChip(invitation.estado)),
    h('td', {}, formatDate(invitation.expira_en)),
    h('td', {}, formatDate(invitation.fecha_creacion)),
    h('td', {}, invitation.estado === 'pendiente'
        ? h('button', {
            class: 'btn ghost small', type: 'button',
            onClick: () => confirmModal({
                title: 'Revocar invitación',
                message: `El enlace de ${invitation.email} dejará de funcionar inmediatamente.`,
                confirmLabel: 'Revocar',
                danger: true,
                onConfirm: async () => {
                    await api(`/auth/admin/invitations/${invitation.id_invitacion_usuario}/revoke`, { method: 'PATCH' });
                    toast('Invitación revocada.', 'success');
                    reload();
                }
            })
        }, 'Revocar')
        : h('span', { class: 'muted small' }, '—')));

const createInvitationModal = async ({ reload }) => {
    let institutions = [];
    try {
        const response = await loadInstitutions();
        institutions = response.data.filter((item) => item.estado === 'activa');
    } catch (error) {
        toast(errorMessage(error), 'error');
        return;
    }

    const email = h('input', { class: 'input', id: 'inv-email', type: 'email', required: true, placeholder: 'persona@utp.edu.pe' });
    const role = h('select', { class: 'input', id: 'inv-rol' },
        h('option', { value: 'docente' }, 'Docente'),
        h('option', { value: 'estudiante' }, 'Estudiante'));
    const institution = h('select', { class: 'input', id: 'inv-institucion' },
        institutions.map((item) => h('option', { value: item.id_institucion }, item.nombre)));
    const hours = h('input', { class: 'input', id: 'inv-horas', type: 'number', min: 1, max: 168, value: 72 });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const resultHost = h('div', { hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Crear invitación');

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
            resultHost.hidden = true;

            if (!email.value.trim()) return showError('Ingresa el correo de la persona invitada.');
            if (!institution.value) return showError('Selecciona una institución activa.');

            setBusy(submit, true, 'Creando…');
            try {
                const response = await api('/auth/admin/invitations', {
                    method: 'POST',
                    body: {
                        email: email.value.trim(),
                        rol: role.value,
                        id_institucion: institution.value,
                        expira_en_horas: Number(hours.value)
                    }
                });

                const invitationUrl = response.dev_invitation_url;
                resultHost.hidden = false;
                resultHost.replaceChildren(
                    h('div', { class: 'alert success' }, response.message),
                    invitationUrl
                        ? h('div', { class: 'stack', style: { marginTop: '12px' } },
                            h('span', { class: 'small muted' }, 'Enlace de invitación para compartir:'),
                            h('input', {
                                class: 'input', type: 'text', readonly: true, value: invitationUrl,
                                onFocus: (event) => event.target.select()
                            }),
                            h('button', {
                                class: 'btn secondary small', type: 'button',
                                onClick: async () => {
                                    try {
                                        await navigator.clipboard.writeText(invitationUrl);
                                        toast('Enlace copiado.', 'success');
                                    } catch {
                                        toast('Selecciona y copia el enlace manualmente.', 'error');
                                    }
                                }
                            }, 'Copiar enlace'))
                        : h('p', { class: 'small muted', style: { marginTop: '10px' } },
                            'El correo se envió al destinatario con el enlace de registro.'));

                toast('Invitación creada.', 'success');
                email.value = '';
                reload();
            } catch (error) {
                showError(errorMessage(error));
            } finally {
                setBusy(submit, false);
            }
        }
    },
    institutions.length === 0
        ? h('div', { class: 'alert warn' }, 'No hay instituciones activas. Activa una institución para invitar usuarios.')
        : null,
    h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { for: 'inv-email' }, 'Correo institucional'), email),
        h('div', { class: 'field' }, h('label', { for: 'inv-rol' }, 'Rol'), role),
        h('div', { class: 'field' }, h('label', { for: 'inv-institucion' }, 'Institución'), institution),
        h('div', { class: 'field' }, h('label', { for: 'inv-horas' }, 'Vigencia (horas)'), hours)),
    errorBox,
    resultHost,
    h('div', { class: 'form-actions' },
        submit,
        h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cerrar')));

    const close = openModal(h('div', {},
        h('div', { class: 'modal-head' }, h('h2', {}, 'Nueva invitación')),
        h('p', { class: 'muted small', style: { marginTop: '-6px' } },
            'El correo debe pertenecer a un dominio activo de la institución seleccionada.'),
        form), { label: 'Nueva invitación' });

    email.focus();
};

export default async function adminInvitationsView({ root }) {
    document.title = 'Invitaciones · Administración codeInt';

    const statusFilter = h('select', { class: 'input', 'aria-label': 'Filtrar invitaciones por estado', style: { maxWidth: '220px' } },
        h('option', { value: '' }, 'Todos los estados'),
        h('option', { value: 'pendiente' }, 'Pendientes'),
        h('option', { value: 'usada' }, 'Usadas'),
        h('option', { value: 'vencida' }, 'Vencidas'),
        h('option', { value: 'revocada' }, 'Revocadas'));
    const countChip = h('span', { class: 'chip' }, '—');
    const host = h('div', { class: 'table-wrap' }, skeleton(240));

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Administración'), ' / Invitaciones'),
        h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, 'Invitaciones'),
                h('p', {}, 'Habilita el registro de estudiantes y docentes con un enlace de un solo uso.')),
            h('div', { class: 'row' }, countChip,
                h('button', {
                    class: 'btn', type: 'button',
                    onClick: () => createInvitationModal({ reload: load })
                }, icon('user', 15), 'Nueva invitación'))),
        h('div', { class: 'toolbar' }, statusFilter),
        host));

    let invitations = [];

    const paint = () => {
        countChip.textContent = `${formatNumber(invitations.length)} invitaciones`;
        if (invitations.length === 0) {
            host.replaceChildren(emptyState('Sin invitaciones', 'Crea una invitación para habilitar el registro de una persona.'));
            return;
        }
        host.replaceChildren(h('table', { class: 'table' },
            h('thead', {}, h('tr', {},
                h('th', {}, 'Invitado'),
                h('th', {}, 'Rol'),
                h('th', {}, 'Estado'),
                h('th', {}, 'Vence'),
                h('th', {}, 'Creada'),
                h('th', {}, h('span', { class: 'sr-only' }, 'Acciones')))),
            h('tbody', {}, invitations.map((invitation) => invitationRow(invitation, load)))));
    };

    const load = async () => {
        host.replaceChildren(skeleton(240));
        try {
            const query = statusFilter.value ? `?estado=${encodeURIComponent(statusFilter.value)}` : '';
            const response = await api(`/auth/admin/invitations${query}`);
            invitations = response.data;
            paint();
        } catch (error) {
            host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
        }
    };

    statusFilter.addEventListener('change', load);
    await load();
}
