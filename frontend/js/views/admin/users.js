import { h, icon, skeleton, errorMessage, formatNumber, formatDate, toast } from '../../ui.js';
import { api } from '../../api.js';
import { emptyState, statusChip } from '../teacher/helpers.js';
import { confirmModal, roleChip, statusAction } from './helpers.js';

const actionFor = (user, reload) => {
    if (user.rol === 'superadministrador') return h('span', { class: 'muted small' }, 'Cuenta protegida');
    if (user.estado === 'activo') {
        return h('button', {
            class: 'btn ghost small', type: 'button',
            onClick: () => confirmModal({
                title: 'Desactivar cuenta',
                message: `Se cerrarán las sesiones de ${user.nombre} ${user.apellido} y no podrá iniciar sesión hasta que la reactives.`,
                confirmLabel: 'Desactivar',
                danger: true,
                onConfirm: async () => {
                    await statusAction({ user, estado: 'inactivo' });
                    toast('Cuenta desactivada.', 'success');
                    reload();
                }
            })
        }, 'Desactivar');
    }
    if (user.estado === 'inactivo') {
        return h('button', {
            class: 'btn small', type: 'button',
            onClick: () => confirmModal({
                title: 'Activar cuenta',
                message: `Se activará la cuenta de ${user.nombre} ${user.apellido} y podrá iniciar sesión.`,
                confirmLabel: 'Activar',
                onConfirm: async () => {
                    await statusAction({ user, estado: 'activo' });
                    toast('Cuenta activada.', 'success');
                    reload();
                }
            })
        }, 'Activar');
    }
    return h('div', { class: 'row-actions' },
        h('button', {
            class: 'btn small', type: 'button',
            onClick: () => confirmModal({
                title: 'Activar cuenta pendiente',
                message: `Se activará la cuenta de ${user.nombre} ${user.apellido}.`,
                confirmLabel: 'Activar',
                onConfirm: async () => {
                    await statusAction({ user, estado: 'activo' });
                    toast('Cuenta activada.', 'success');
                    reload();
                }
            })
        }, 'Activar'),
        h('button', {
            class: 'btn ghost small', type: 'button',
            onClick: () => confirmModal({
                title: 'Rechazar cuenta pendiente',
                message: `La cuenta de ${user.nombre} ${user.apellido} quedará inactiva.`,
                confirmLabel: 'Rechazar',
                danger: true,
                onConfirm: async () => {
                    await statusAction({ user, estado: 'inactivo' });
                    toast('Cuenta rechazada.', 'success');
                    reload();
                }
            })
        }, 'Rechazar'));
};

const userRow = (user, reload) => h('tr', {},
    h('td', {}, h('div', { class: 'cell-main' },
        h('strong', {}, `${user.apellido}, ${user.nombre}`),
        h('small', {}, user.email || '—'))),
    h('td', {}, roleChip(user.rol)),
    h('td', {}, user.institucion_nombre || '—'),
    h('td', {}, statusChip(user.estado)),
    h('td', { class: 'num' }, formatNumber(user.rol === 'docente' ? user.total_cursos : user.total_matriculas)),
    h('td', {}, formatDate(user.fecha_creacion)),
    h('td', {}, actionFor(user, reload)));

export default async function adminUsersView({ root }) {
    document.title = 'Usuarios · Administración codeInt';

    const roleSelect = h('select', { class: 'input', 'aria-label': 'Filtrar por rol' },
        h('option', { value: '' }, 'Todos los roles'),
        h('option', { value: 'docente' }, 'Docentes'),
        h('option', { value: 'estudiante' }, 'Estudiantes'),
        h('option', { value: 'superadministrador' }, 'Superadministradores'));
    const statusSelect = h('select', { class: 'input', 'aria-label': 'Filtrar por estado' },
        h('option', { value: '' }, 'Todos los estados'),
        h('option', { value: 'activo' }, 'Activos'),
        h('option', { value: 'pendiente' }, 'Pendientes'),
        h('option', { value: 'inactivo' }, 'Inactivos'));
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre o correo', 'aria-label': 'Buscar usuarios' });
    const countChip = h('span', { class: 'chip' }, '—');
    const host = h('div', { class: 'table-wrap' }, skeleton(240));

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Administración'), ' / Usuarios'),
        h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, 'Usuarios'),
                h('p', {}, 'Consulta cuentas, revisa estados y activa o desactiva accesos.')),
            countChip),
        h('div', { class: 'toolbar' },
            h('div', { class: 'row', style: { flex: '1 1 520px' } },
                h('div', { style: { minWidth: '180px' } }, roleSelect),
                h('div', { style: { minWidth: '180px' } }, statusSelect),
                h('div', { style: { minWidth: '240px', flex: '1 1 240px' } }, search))),
        host));

    let users = [];

    const paint = () => {
        countChip.textContent = `${formatNumber(users.length)} cuentas`;
        if (users.length === 0) {
            host.replaceChildren(emptyState('Sin usuarios para este filtro', 'Prueba con otro rol, estado o término de búsqueda.'));
            return;
        }
        host.replaceChildren(h('table', { class: 'table' },
            h('thead', {}, h('tr', {},
                h('th', {}, 'Usuario'),
                h('th', {}, 'Rol'),
                h('th', {}, 'Institución'),
                h('th', {}, 'Estado'),
                h('th', { class: 'num' }, 'Cursos / matrículas'),
                h('th', {}, 'Registro'),
                h('th', {}, h('span', { class: 'sr-only' }, 'Acciones')))),
            h('tbody', {}, users.map((user) => userRow(user, load)))));
    };

    const load = async () => {
        host.replaceChildren(skeleton(240));
        const params = new URLSearchParams();
        if (roleSelect.value) params.set('rol', roleSelect.value);
        if (statusSelect.value) params.set('estado', statusSelect.value);
        if (search.value.trim()) params.set('q', search.value.trim());
        try {
            const response = await api(`/auth/usuarios${params.toString() ? `?${params}` : ''}`);
            users = response.data;
            paint();
        } catch (error) {
            host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
        }
    };

    let debounce = null;
    search.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(load, 280);
    });
    roleSelect.addEventListener('change', load);
    statusSelect.addEventListener('change', load);

    await load();
}
