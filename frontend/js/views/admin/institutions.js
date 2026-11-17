import {
    h, icon, skeleton, errorMessage, formatNumber, formatDate,
    openModal, setBusy, toast
} from '../../ui.js';
import { api } from '../../api.js';
import { emptyState, statusChip } from '../teacher/helpers.js';
import { confirmModal } from './helpers.js';

const addDomainModal = ({ institution, onDone }) => {
    const domain = h('input', {
        class: 'input', id: 'nuevo-dominio', type: 'text', required: true,
        placeholder: 'carrera.utp.edu.pe', autocapitalize: 'none', spellcheck: 'false'
    });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Agregar dominio');

    const form = h('form', {
        novalidate: true,
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;
            if (!domain.value.trim()) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = 'Ingresa un dominio.';
                return;
            }
            setBusy(submit, true, 'Agregando…');
            try {
                await api(`/auth/admin/instituciones/${institution.id_institucion}/dominios`, {
                    method: 'POST',
                    body: { dominio: domain.value.trim() }
                });
                toast('Dominio agregado en estado pendiente. Actívalo para permitir registros.', 'success');
                close();
                if (onDone) onDone();
            } catch (error) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = errorMessage(error);
                setBusy(submit, false);
            }
        }
    },
    h('p', { class: 'muted small' },
        `Institución: ${institution.nombre}. El dominio se crea pendiente y debe activarse para habilitar registros.`),
    h('div', { class: 'field' }, h('label', { for: 'nuevo-dominio' }, 'Dominio'), domain,
        h('span', { class: 'hint' }, 'Solo el dominio, sin arroba ni protocolo. Ejemplo: utp.edu.pe')),
    errorBox,
    h('div', { class: 'form-actions' },
        submit,
        h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cancelar')));

    const close = openModal(h('div', {},
        h('div', { class: 'modal-head' }, h('h2', {}, 'Agregar dominio institucional')),
        form), { label: 'Agregar dominio institucional' });

    domain.focus();
};

const domainRow = (domain, reload) => {
    const active = domain.estado === 'activo';
    return h('div', { class: 'info-row' },
        h('div', { class: 'cell-main' },
            h('strong', {}, domain.dominio),
            h('small', {}, active ? 'Habilitado para registros' : 'No permite registros nuevos')),
        h('div', { class: 'row' },
            statusChip(domain.estado),
            h('button', {
                class: 'btn ghost small', type: 'button',
                onClick: () => {
                    const update = async () => {
                        await api(`/auth/admin/dominios/${domain.id_institucion_dominio}/estado`, {
                            method: 'PATCH',
                            body: { estado: active ? 'inactivo' : 'activo' }
                        });
                        toast(active ? 'Dominio desactivado.' : 'Dominio activado.', 'success');
                        reload();
                    };
                    if (active) {
                        confirmModal({
                            title: 'Desactivar dominio',
                            message: `Los registros nuevos con correos @${domain.dominio} dejarán de ser aceptados.`,
                            confirmLabel: 'Desactivar',
                            danger: true,
                            onConfirm: update
                        });
                    } else {
                        update().catch((error) => toast(errorMessage(error), 'error'));
                    }
                }
            }, active ? 'Desactivar' : 'Activar')));
};

const institutionCard = (institution, reload) => {
    const domains = Array.isArray(institution.dominios) ? institution.dominios : [];
    const activeDomains = domains.filter((domain) => domain.estado === 'activo');
    return h('article', { class: 'card' },
        h('div', { class: 'section-heading' },
            h('div', {},
                h('h2', {}, institution.nombre),
                h('p', { class: 'muted small' }, `Licencia: ${institution.codigo_licencia}`)),
            statusChip(institution.estado)),
        h('div', { class: 'metric-strip', style: { marginTop: '10px' } },
            h('div', {}, h('span', {}, 'Usuarios'), h('strong', {}, formatNumber(institution.total_usuarios))),
            h('div', {}, h('span', {}, 'Cursos'), h('strong', {}, formatNumber(institution.total_cursos))),
            h('div', {}, h('span', {}, 'Dominios activos'), h('strong', {}, formatNumber(activeDomains.length)))),
        h('div', { class: 'section-heading', style: { marginTop: '18px' } },
            h('h3', {}, 'Dominios institucionales'),
            h('button', {
                class: 'btn secondary small', type: 'button',
                disabled: institution.estado !== 'activa',
                onClick: () => addDomainModal({ institution, onDone: reload })
            }, 'Agregar dominio')),
        institution.estado !== 'activa'
            ? h('div', { class: 'alert warn', style: { marginBottom: '10px' } },
                'La institución está inactiva: no se pueden agregar dominios nuevos.')
            : null,
        domains.length === 0
            ? h('div', { class: 'empty-state compact' },
                h('strong', {}, 'Sin dominios registrados'),
                h('p', {}, 'Sin un dominio activo, los usuarios de esta institución no podrán registrarse.'))
            : h('div', {}, domains.map((domain) => domainRow(domain, reload))),
        h('p', { class: 'hint', style: { marginTop: '10px' } },
            `Creada ${formatDate(institution.fecha_creacion)}. La creación y edición de instituciones se incorpora en la fase de licencias.`));
};

export default async function adminInstitutionsView({ root }) {
    document.title = 'Instituciones · Administración codeInt';

    const host = h('div', { class: 'stack' }, skeleton(220), skeleton(220));
    const countChip = h('span', { class: 'chip' }, '—');

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Administración'), ' / Instituciones'),
        h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, 'Instituciones y dominios'),
                h('p', {}, 'Habilita los dominios de correo que pueden registrarse en cada institución.')),
            countChip),
        host));

    const load = async () => {
        host.replaceChildren(skeleton(220), skeleton(220));
        try {
            const response = await api('/auth/admin/instituciones');
            const institutions = response.data;
            countChip.textContent = `${formatNumber(institutions.length)} instituciones`;
            host.replaceChildren(...(institutions.length
                ? institutions.map((institution) => institutionCard(institution, load))
                : [emptyState('Sin instituciones', 'No hay instituciones registradas en la plataforma.')]));
        } catch (error) {
            host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
        }
    };

    await load();
}
