import { h, icon, skeleton, errorMessage, formatNumber, formatDate, toast } from '../../ui.js';
import { api } from '../../api.js';
import { confirmModal, statusAction } from './helpers.js';
import { demographicsPanel } from './demographics.js';

const statCard = (label, value, detail) => h('div', { class: 'stat-card' },
    h('span', {}, label),
    h('strong', {}, formatNumber(value)),
    detail ? h('span', { class: 'muted small' }, detail) : null);

const quickLink = (href, title, detail, iconName) => h('a', { class: 'card', href, style: { textDecoration: 'none' } },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        h('h3', {}, title),
        icon(iconName, 18)),
    h('p', { class: 'muted small', style: { margin: '8px 0 0' } }, detail));

export default async function adminDashboard({ root, user }) {
    document.title = 'Panel de administración · codeInt';

    const statsHost = h('div', { class: 'stat-grid' }, skeleton(96), skeleton(96), skeleton(96), skeleton(96));
    const pendingHost = h('div', {}, skeleton(120));
    const pendingCount = h('span', { class: 'chip' }, '—');

    root.append(h('div', { class: 'container dashboard-page' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' }, 'Administración'),
        h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, `Hola, ${user.nombre}`),
                h('p', {}, 'Gobierna usuarios, invitaciones, instituciones y cuotas de IA.')),
            h('a', { class: 'btn ghost', href: '#/admin/usuarios' }, 'Ver usuarios')),
        statsHost,
        h('section', { class: 'section-block' },
            h('div', { class: 'section-heading' },
                h('h2', {}, 'Acciones rápidas'),
                h('span', { class: 'muted small' }, 'Flujos de administración')),
            h('div', { class: 'grid cols-3' },
                quickLink('#/admin/invitaciones', 'Invitar usuario', 'Crea una invitación con rol e institución.', 'user'),
                quickLink('#/admin/usuarios', 'Gestionar usuarios', 'Consulta cuentas, roles y estados.', 'shield'),
                quickLink('#/admin/instituciones', 'Instituciones y dominios', 'Activa dominios para habilitar registros.', 'brand'),
                quickLink('#/admin/cuotas', 'Cuotas de IA', 'Asigna tokens y revisa el consumo docente.', 'sparkles'))),
        demographicsPanel(),
        h('section', { class: 'section-block' },
            h('div', { class: 'section-heading' },
                h('h2', {}, 'Docentes pendientes'),
                pendingCount),
            pendingHost)));

    const load = async () => {
        const results = await Promise.allSettled([
            api('/auth/usuarios'),
            api('/auth/admin/instituciones'),
            api('/auth/admin/invitations'),
            api('/ia/cuotas')
        ]);
        const [usersResult, institutionsResult, invitationsResult, quotasResult] = results;
        const users = usersResult.status === 'fulfilled' ? usersResult.value.data : [];
        const institutions = institutionsResult.status === 'fulfilled' ? institutionsResult.value.data : [];
        const invitations = invitationsResult.status === 'fulfilled' ? invitationsResult.value.data : [];
        const quotas = quotasResult.status === 'fulfilled' ? quotasResult.value.data : [];

        const activos = users.filter((item) => item.estado === 'activo');
        const pendientes = users.filter((item) => item.estado === 'pendiente');
        const docentesPendientes = pendientes.filter((item) => item.rol === 'docente');
        const invitacionesPendientes = invitations.filter((item) => item.estado === 'pendiente');
        const institucionesActivas = institutions.filter((item) => item.estado === 'activa');
        const ahora = Date.now();
        const cuotasVigentes = quotas.filter((item) => {
            const inicio = new Date(item.fecha_inicio).getTime();
            const fin = new Date(item.fecha_fin).getTime();
            return inicio <= ahora && ahora < fin;
        });
        const tokensDisponibles = cuotasVigentes.reduce((total, item) => total
            + Math.max(0, Number(item.limite_tokens) - Number(item.tokens_comprometidos)), 0);

        const failures = results.filter((item) => item.status === 'rejected');
        if (failures.length) {
            statsHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(failures[0].reason)));
            return;
        }

        statsHost.replaceChildren(
            statCard('Usuarios activos', activos.length, `${formatNumber(users.length)} cuentas en total`),
            statCard('Docentes pendientes', docentesPendientes.length, pendientes.length ? `${formatNumber(pendientes.length)} cuentas pendientes` : 'Sin cuentas pendientes'),
            statCard('Invitaciones pendientes', invitacionesPendientes.length, `${formatNumber(invitations.length)} invitaciones registradas`),
            statCard('Instituciones activas', institucionesActivas.length, `${formatNumber(institutions.length)} instituciones`),
            h('div', { class: 'status-banner', style: { gridColumn: '1 / -1' } },
                `${formatNumber(tokensDisponibles)} tokens disponibles en cuotas de IA vigentes`));

        pendingCount.textContent = `${docentesPendientes.length} pendientes`;
        pendingHost.replaceChildren(docentesPendientes.length === 0
            ? h('div', { class: 'empty-state compact' },
                h('strong', {}, 'No hay docentes pendientes'),
                h('p', {}, 'Las nuevas cuentas docentes aparecerán aquí para su activación.'))
            : h('div', { class: 'table-wrap' },
                h('table', { class: 'table' },
                    h('thead', {}, h('tr', {},
                        h('th', {}, 'Docente'),
                        h('th', {}, 'Institución'),
                        h('th', {}, 'Registro'),
                        h('th', {}, h('span', { class: 'sr-only' }, 'Acciones')))),
                    h('tbody', {}, docentesPendientes.map((docente) => h('tr', {},
                        h('td', {}, h('div', { class: 'cell-main' },
                            h('strong', {}, `${docente.apellido}, ${docente.nombre}`),
                            h('small', {}, docente.email))),
                        h('td', {}, docente.institucion_nombre || '—'),
                        h('td', {}, formatDate(docente.fecha_creacion)),
                        h('td', {}, h('div', { class: 'row-actions' },
                            h('button', {
                                class: 'btn small', type: 'button',
                                onClick: () => confirmModal({
                                    title: 'Activar docente',
                                    message: `Se activará la cuenta de ${docente.nombre} ${docente.apellido} y podrá iniciar sesión.`,
                                    confirmLabel: 'Activar',
                                    onConfirm: async () => {
                                        await statusAction({ user: docente, estado: 'activo' });
                                        toast('Docente activado.', 'success');
                                        load();
                                    }
                                })
                            }, 'Activar'),
                            h('button', {
                                class: 'btn ghost small', type: 'button',
                                onClick: () => confirmModal({
                                    title: 'Rechazar docente',
                                    message: `La cuenta de ${docente.nombre} ${docente.apellido} quedará inactiva.`,
                                    confirmLabel: 'Rechazar',
                                    danger: true,
                                    onConfirm: async () => {
                                        await statusAction({ user: docente, estado: 'inactivo' });
                                        toast('Cuenta rechazada.', 'success');
                                        load();
                                    }
                                })
                            }, 'Rechazar')))))))));
    };

    await load();
}
