import {
    h, icon, skeleton, errorMessage, formatNumber, formatDate,
    openModal, setBusy, toast
} from '../../ui.js';
import { api } from '../../api.js';
import { emptyState, statusChip } from '../teacher/helpers.js';

const pad = (value) => String(value).padStart(2, '0');
const localDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const quotaState = (quota) => {
    const now = Date.now();
    const start = new Date(quota.fecha_inicio).getTime();
    const end = new Date(quota.fecha_fin).getTime();
    if (now < start) return 'programada';
    if (now >= end) return 'vencida';
    return 'vigente';
};

const stateChip = (state) => {
    if (state === 'vigente') return h('span', { class: 'chip green' }, 'Vigente');
    if (state === 'programada') return h('span', { class: 'chip blue' }, 'Programada');
    return h('span', { class: 'chip red' }, 'Vencida');
};

const createQuotaModal = ({ teachers, onDone }) => {
    const teacher = h('select', { class: 'input', id: 'cuota-docente' },
        h('option', { value: '' }, 'Selecciona un docente…'),
        teachers.map((item) => h('option', { value: item.id_usuario }, `${item.apellido}, ${item.nombre} · ${item.email}`)));
    const limit = h('input', { class: 'input', id: 'cuota-limite', type: 'number', min: 1, max: 1000000000, step: 1000, value: 100000 });
    const start = h('input', { class: 'input', id: 'cuota-inicio', type: 'date', value: localDate(new Date()) });
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);
    const end = h('input', { class: 'input', id: 'cuota-fin', type: 'date', value: localDate(endDate) });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Asignar cuota');

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
            if (!teacher.value) return showError('Selecciona el docente beneficiario.');
            if (!limit.value || Number(limit.value) <= 0) return showError('El límite de tokens debe ser mayor que cero.');
            if (!start.value || !end.value) return showError('Indica el periodo de vigencia.');
            if (new Date(end.value) <= new Date(start.value)) return showError('La fecha de fin debe ser posterior al inicio.');

            setBusy(submit, true, 'Asignando…');
            try {
                await api('/ia/cuotas', {
                    method: 'POST',
                    body: {
                        id_docente: teacher.value,
                        limite_tokens: Number(limit.value),
                        fecha_inicio: start.value,
                        fecha_fin: end.value
                    }
                });
                toast('Cuota de IA asignada.', 'success');
                close();
                if (onDone) onDone();
            } catch (error) {
                showError(errorMessage(error));
                setBusy(submit, false);
            }
        }
    },
    h('div', { class: 'field' }, h('label', { for: 'cuota-docente' }, 'Docente beneficiario'), teacher),
    h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { for: 'cuota-limite' }, 'Límite de tokens'), limit),
        h('div', { class: 'field' }, h('label', { for: 'cuota-inicio' }, 'Inicio'), start),
        h('div', { class: 'field' }, h('label', { for: 'cuota-fin' }, 'Fin'), end)),
    h('p', { class: 'hint' }, 'Las cuotas de un mismo docente no pueden superponerse en el tiempo.'),
    errorBox,
    h('div', { class: 'form-actions' },
        submit,
        h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cancelar')));

    const close = openModal(h('div', {},
        h('div', { class: 'modal-head' }, h('h2', {}, 'Asignar cuota de IA')),
        form), { label: 'Asignar cuota de IA' });

    teacher.focus();
};

const quotaRow = (quota, onConsumption) => {
    const state = quotaState(quota);
    const available = Math.max(0, Number(quota.limite_tokens) - Number(quota.tokens_comprometidos));
    return h('tr', {},
        h('td', {}, h('div', { class: 'cell-main' },
            h('strong', {}, quota.docente),
            h('small', {}, quota.email))),
        h('td', { class: 'num' }, formatNumber(quota.limite_tokens)),
        h('td', { class: 'num' }, formatNumber(quota.tokens_comprometidos)),
        h('td', { class: 'num' }, formatNumber(available)),
        h('td', {}, formatDate(quota.fecha_inicio)),
        h('td', {}, formatDate(quota.fecha_fin)),
        h('td', {}, stateChip(state)),
        h('td', {}, h('button', {
            class: 'btn ghost small', type: 'button',
            onClick: () => onConsumption(quota.id_docente)
        }, 'Ver consumo')));
};

const consumptionPanel = ({ idTeacher, teachers }) => {
    const host = h('div', {}, skeleton(160));
    const teacher = teachers.find((item) => item.id_usuario === idTeacher);

    host.replaceChildren(skeleton(160));
    api(`/ia/consumo?id_docente=${encodeURIComponent(idTeacher)}`).then(({ data }) => {
        const quota = data.cuota_vigente;
        const summary = data.resumen || {};
        host.replaceChildren(
            h('div', { class: 'section-heading' },
                h('div', {},
                    h('h2', {}, `Consumo de ${teacher ? `${teacher.nombre} ${teacher.apellido}` : 'docente'}`),
                    h('p', { class: 'muted small' }, 'Operaciones registradas y disponibilidad de la cuota vigente.')),
                h('button', { class: 'btn ghost small', type: 'button', onClick: () => host.remove() }, 'Cerrar')),
            quota
                ? h('div', { class: 'info-list' },
                    h('div', { class: 'info-row' }, h('span', {}, 'Límite vigente'), h('strong', {}, formatNumber(quota.limite_tokens))),
                    h('div', { class: 'info-row' }, h('span', {}, 'Consumidos'), h('strong', {}, formatNumber(quota.tokens_consumidos))),
                    h('div', { class: 'info-row' }, h('span', {}, 'Reservados'), h('strong', {}, formatNumber(quota.tokens_reservados))),
                    h('div', { class: 'info-row' }, h('span', {}, 'Disponibles'), h('strong', {}, formatNumber(quota.tokens_disponibles))),
                    h('div', { class: 'info-row' }, h('span', {}, 'Vigencia'), h('strong', {}, `${formatDate(quota.fecha_inicio)} — ${formatDate(quota.fecha_fin)}`)))
                : h('div', { class: 'alert warn', style: { marginBottom: '12px' } }, 'El docente no tiene una cuota vigente en este momento.'),
            h('div', { class: 'metric-strip', style: { margin: '14px 0' } },
                h('div', {}, h('span', {}, 'Operaciones'), h('strong', {}, formatNumber(summary.operaciones))),
                h('div', {}, h('span', {}, 'Exitosas'), h('strong', {}, formatNumber(summary.exitosas))),
                h('div', {}, h('span', {}, 'Fallidas / en proceso'), h('strong', {}, `${formatNumber(summary.fallidas)} / ${formatNumber(summary.en_proceso)}`))),
            data.operaciones.length === 0
                ? emptyState('Sin operaciones registradas', 'Cuando el docente use la evaluación con IA aparecerán aquí.')
                : h('div', { class: 'table-wrap' },
                    h('table', { class: 'table' },
                        h('thead', {}, h('tr', {},
                            h('th', {}, 'Fecha'),
                            h('th', {}, 'Tipo'),
                            h('th', {}, 'Estado'),
                            h('th', { class: 'num' }, 'Tokens'),
                            h('th', {}, 'Referencia'))),
                        h('tbody', {}, data.operaciones.map((operation) => h('tr', {},
                            h('td', {}, formatDate(operation.fecha_uso)),
                            h('td', {}, operation.tipo_operacion === 'evaluacion' ? 'Evaluación' : 'Generación'),
                            h('td', {}, statusChip(operation.estado_consumo)),
                            h('td', { class: 'num' }, `${formatNumber(operation.tokens_consumidos)} / ${formatNumber(operation.tokens_reservados)}`),
                            h('td', {}, operation.ejercicio || operation.curso || '—')))))));
    }).catch((error) => {
        host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
    });

    return host;
};

export default async function adminQuotasView({ root }) {
    document.title = 'Cuotas de IA · Administración codeInt';

    const host = h('div', { class: 'table-wrap' }, skeleton(240));
    const consumptionHost = h('div');
    const countChip = h('span', { class: 'chip' }, '—');
    const createButton = h('button', { class: 'btn', type: 'button' }, icon('sparkles', 15), 'Asignar cuota');

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Administración'), ' / Cuotas de IA'),
        h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, 'Cuotas de IA'),
                h('p', {}, 'Asigna tokens a docentes, revisa la disponibilidad y audita el consumo.')),
            h('div', { class: 'row' }, countChip, createButton)),
        host,
        h('section', { style: { marginTop: '22px' } }, consumptionHost)));

    let teachers = [];
    let quotas = [];

    const showConsumption = (idTeacher) => {
        consumptionHost.replaceChildren(consumptionPanel({ idTeacher, teachers }));
        consumptionHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const paint = () => {
        countChip.textContent = `${formatNumber(quotas.length)} cuotas`;
        if (quotas.length === 0) {
            host.replaceChildren(emptyState('Sin cuotas asignadas', 'Asigna una cuota para habilitar la evaluación con IA de un docente.'));
            return;
        }
        host.replaceChildren(h('table', { class: 'table' },
            h('thead', {}, h('tr', {},
                h('th', {}, 'Docente'),
                h('th', { class: 'num' }, 'Límite'),
                h('th', { class: 'num' }, 'Comprometido'),
                h('th', { class: 'num' }, 'Disponible'),
                h('th', {}, 'Inicio'),
                h('th', {}, 'Fin'),
                h('th', {}, 'Estado'),
                h('th', {}, h('span', { class: 'sr-only' }, 'Acciones')))),
            h('tbody', {}, quotas.map((quota) => quotaRow(quota, showConsumption)))));
    };

    const load = async () => {
        host.replaceChildren(skeleton(240));
        try {
            const [quotasResponse, usersResponse] = await Promise.all([
                api('/ia/cuotas'),
                api('/auth/usuarios?rol=docente&estado=activo')
            ]);
            quotas = quotasResponse.data;
            teachers = usersResponse.data;
            paint();
        } catch (error) {
            host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
        }
    };

    createButton.addEventListener('click', () => createQuotaModal({ teachers, onDone: load }));
    await load();
}
