import {
    h, icon, skeleton, errorMessage, formatNumber, formatDate, openModal, toast
} from '../../ui.js';
import { api } from '../../api.js';
import { toCsv, downloadCsv } from '../../csv.js';
import { emptyState } from './helpers.js';

const ERROR_LABELS = {
    ninguno: 'Sin error',
    sintaxis: 'Sintaxis',
    logica: 'Lógica',
    condicion_borde: 'Condición de borde',
    estructura: 'Estructura',
    variables: 'Variables',
    operadores: 'Operadores',
    entrada_salida: 'Entrada / salida',
    otro: 'Otro'
};

const errorLabel = (category) => ERROR_LABELS[category] || String(category || 'sin_categoria').replaceAll('_', ' ');

const average = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(1) : '0.0';
};

const progressBar = (value, label) => h('div', {
    class: 'progress', role: 'progressbar',
    'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value, 'aria-label': label
}, h('span', { style: { '--value': `${Math.max(0, Math.min(100, value))}%` } }));

const statCard = (label, value, detail) => h('div', { class: 'stat-card' },
    h('span', {}, label),
    h('strong', {}, value),
    detail ? h('span', { class: 'muted small' }, detail) : null);

const studentModal = async (idCurso, student) => {
    const host = h('div', {}, skeleton(180));
    openModal(h('div', {},
        h('div', { class: 'modal-head' },
            h('div', {}, h('h2', {}, `${student.nombre} ${student.apellido}`), h('p', { class: 'muted small' }, student.email)),
            h('span', { class: 'chip blue' }, 'Detalle del estudiante')),
        host), { label: 'Detalle del estudiante' });

    try {
        const { data } = await api(`/analiticas/curso/${idCurso}/estudiante/${student.id_estudiante}`);
        const resumen = data.resumen;
        const promedio = average(resumen.promedio_puntaje);

        host.replaceChildren(
            h('div', { class: 'stat-grid', style: { marginBottom: '16px' } },
                statCard('XP en el curso', formatNumber(resumen.xp_en_curso)),
                statCard('Mundos completados', `${formatNumber(resumen.mundos_completados)} / ${formatNumber(resumen.total_mundos)}`),
                statCard('Ejercicios aprobados', `${formatNumber(resumen.ejercicios_aprobados)} / ${formatNumber(resumen.total_ejercicios)}`),
                statCard('Promedio', promedio)),
            h('h3', { style: { marginTop: '18px' } }, 'Avance por mundo'),
            h('div', { class: 'table-wrap', style: { marginTop: '10px' } },
                h('table', { class: 'table' },
                    h('thead', {}, h('tr', {},
                        h('th', { class: 'num' }, 'Mundo'),
                        h('th', {}, 'Nombre'),
                        h('th', {}, 'Estado'),
                        h('th', { class: 'num' }, 'Aprobados'),
                        h('th', { class: 'num' }, 'Envíos'))),
                    h('tbody', {}, data.mundos.map((world) => h('tr', {},
                        h('td', { class: 'num' }, world.orden),
                        h('td', {}, world.nombre),
                        h('td', {}, world.estado.replaceAll('_', ' ')),
                        h('td', { class: 'num' }, `${formatNumber(world.ejercicios_aprobados)} / ${formatNumber(world.total_ejercicios)}`),
                        h('td', { class: 'num' }, formatNumber(world.total_envios))))))),
            h('h3', { style: { marginTop: '18px' } }, 'Últimos envíos'),
            data.envios.length === 0
                ? h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'El estudiante todavía no tiene envíos.')
                : h('div', { class: 'table-wrap', style: { marginTop: '10px' } },
                    h('table', { class: 'table' },
                        h('thead', {}, h('tr', {},
                            h('th', {}, 'Ejercicio'),
                            h('th', {}, 'Fecha'),
                            h('th', { class: 'num' }, 'Puntaje'),
                            h('th', {}, 'Categoría de error'))),
                        h('tbody', {}, data.envios.map((submission) => h('tr', {},
                            h('td', {}, submission.titulo),
                            h('td', {}, formatDate(submission.fecha_envio)),
                            h('td', { class: 'num' }, submission.puntaje === null ? '—' : formatNumber(submission.puntaje)),
                            h('td', {}, submission.categoria_error ? errorLabel(submission.categoria_error) : 'Sin evaluar')))))));
    } catch (error) {
        host.replaceChildren(h('div', { class: 'alert error' }, errorMessage(error)));
    }
};

export default async function analyticsCourseView({ root, params, user }) {
    document.title = 'Analíticas del curso · codeInt';

    const headerHost = h('div', {}, skeleton(70));
    const statsHost = h('div', { class: 'stat-grid' }, skeleton(96), skeleton(96), skeleton(96), skeleton(96));
    const tabHost = h('div', { class: 'row', style: { marginBottom: '16px' } });
    const contentHost = h('div', {}, skeleton(260));
    const consumptionHost = h('div', { style: { marginTop: '22px' } });

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Panel'), ' / ',
            h('a', { href: '#/analiticas' }, 'Analíticas'), ' / Curso'),
        headerHost,
        statsHost,
        h('div', { style: { marginTop: '22px' } }, tabHost, contentHost),
        consumptionHost));

    let data = null;
    let activeTab = 'mundos';
    let loading = true;

    // Exporta el avance de los estudiantes (los datos ya están autorizados para este docente).
    const exportStudents = () => {
        const columns = [
            { header: 'Apellido', value: (r) => r.apellido }, { header: 'Nombre', value: (r) => r.nombre },
            { header: 'Correo', value: (r) => r.email }, { header: 'XP en el curso', value: (r) => r.xp_en_curso },
            { header: 'Mundos completados', value: (r) => r.mundos_completados }, { header: 'Total de mundos', value: (r) => r.total_mundos },
            { header: 'Ejercicios aprobados', value: (r) => r.ejercicios_aprobados }, { header: 'Total de ejercicios', value: (r) => r.total_ejercicios },
            { header: 'Promedio de puntaje', value: (r) => r.promedio_puntaje },
            { header: 'Última actividad', value: (r) => (r.ultima_actividad ? new Date(r.ultima_actividad).toISOString() : '') }
        ];
        const slug = String(data.curso.codigo_curso || 'curso').replace(/[^\w-]+/g, '_');
        downloadCsv(`avance-${slug}.csv`, toCsv(data.estudiantes, columns));
    };

    const renderHeader = () => {
        const course = data.curso;
        headerHost.replaceChildren(h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, course.nombre),
                h('p', {}, `${course.codigo_curso} · ${course.periodo} · ${course.docente_nombre}`)),
            h('div', { class: 'row' },
                h('span', { class: 'chip' }, course.institucion_nombre),
                h('button', { class: 'btn secondary small', type: 'button', disabled: data.estudiantes.length === 0, onClick: exportStudents }, icon('arrow', 14), 'Exportar CSV'),
                h('a', { class: 'btn ghost small', href: '#/analiticas' }, icon('arrow', 14), 'Volver'))));

        const resumen = data.resumen;
        statsHost.replaceChildren(
            statCard('Estudiantes', formatNumber(resumen.total_estudiantes), `${formatNumber(resumen.total_mundos)} mundos`),
            statCard('Avance promedio', `${resumen.porcentaje_avance}%`, `${formatNumber(resumen.ejercicios_aprobados)} ejercicios aprobados`),
            statCard('Promedio de evaluación', average(resumen.promedio_puntaje), `${formatNumber(resumen.total_evaluaciones)} evaluaciones`),
            statCard('Envíos totales', formatNumber(resumen.total_envios), 'Actividad registrada'));
    };

    const renderWorlds = () => {
        if (data.mundos.length === 0) {
            contentHost.replaceChildren(emptyState('Sin mundos', 'El curso no tiene mundos configurados.'));
            return;
        }
        contentHost.replaceChildren(h('div', { class: 'table-wrap' },
            h('table', { class: 'table' },
                h('thead', {}, h('tr', {},
                    h('th', { class: 'num' }, 'Mundo'),
                    h('th', {}, 'Nombre'),
                    h('th', { class: 'num' }, 'Ejercicios'),
                    h('th', {}, 'Completado por'),
                    h('th', { class: 'num' }, 'Aprobados'),
                    h('th', { class: 'num' }, 'Envíos'),
                    h('th', { class: 'num' }, 'Promedio'))),
                h('tbody', {}, data.mundos.map((world) => {
                    const percent = world.total_estudiantes > 0
                        ? Math.round((Number(world.estudiantes_completados) / Number(world.total_estudiantes)) * 100)
                        : 0;
                    return h('tr', {},
                        h('td', { class: 'num' }, world.orden),
                        h('td', {}, world.nombre),
                        h('td', { class: 'num' }, formatNumber(world.total_ejercicios)),
                        h('td', { style: { minWidth: '170px' } },
                            h('div', { class: 'row', style: { gap: '9px' } },
                                h('span', { class: 'small' }, `${formatNumber(world.estudiantes_completados)} / ${formatNumber(world.total_estudiantes)} (${percent}%)`),
                                h('div', { style: { flex: '1 1 80px' } }, progressBar(percent, `Completado del mundo ${world.nombre}`)))),
                        h('td', { class: 'num' }, formatNumber(world.ejercicios_aprobados)),
                        h('td', { class: 'num' }, formatNumber(world.total_envios)),
                        h('td', { class: 'num' }, average(world.promedio_puntaje)));
                })))));
    };

    const renderStudents = () => {
        if (data.estudiantes.length === 0) {
            contentHost.replaceChildren(emptyState('Sin estudiantes matriculados', 'Matricula estudiantes para empezar a medir su avance.'));
            return;
        }
        contentHost.replaceChildren(h('div', { class: 'table-wrap' },
            h('table', { class: 'table' },
                h('thead', {}, h('tr', {},
                    h('th', {}, 'Estudiante'),
                    h('th', { class: 'num' }, 'XP'),
                    h('th', { class: 'num' }, 'Mundos'),
                    h('th', { class: 'num' }, 'Aprobados'),
                    h('th', { class: 'num' }, 'Promedio'),
                    h('th', {}, 'Última actividad'),
                    h('th', {}, h('span', { class: 'sr-only' }, 'Acciones')))),
                h('tbody', {}, data.estudiantes.map((student) => h('tr', {},
                    h('td', {}, h('div', { class: 'cell-main' },
                        h('strong', {}, `${student.apellido}, ${student.nombre}`),
                        h('small', {}, student.email))),
                    h('td', { class: 'num' }, formatNumber(student.xp_en_curso)),
                    h('td', { class: 'num' }, `${formatNumber(student.mundos_completados)} / ${formatNumber(student.total_mundos)}`),
                    h('td', { class: 'num' }, `${formatNumber(student.ejercicios_aprobados)} / ${formatNumber(student.total_ejercicios)}`),
                    h('td', { class: 'num' }, average(student.promedio_puntaje)),
                    h('td', {}, formatDate(student.ultima_actividad)),
                    h('td', {}, h('button', {
                        class: 'btn ghost small', type: 'button',
                        onClick: () => studentModal(params.id, student)
                    }, 'Detalle'))))))));
    };

    // ---- Integridad: evidencia para el docente (no sanciona nada automáticamente) ----
    const REASON_LABEL = {
        PEGADO_GRANDE: 'Pegó casi todo el código',
        ENVIO_MUY_RAPIDO: 'Envío muy rápido',
        SALIO_DE_LA_PESTANA: 'Salió de la pestaña varias veces',
        COPIO_EL_ENUNCIADO: 'Copió el enunciado',
        SIMILITUD_ALTA: 'Código muy parecido al de otro estudiante',
        SIMILITUD_MUY_ALTA: 'Código casi idéntico al de otro estudiante',
        INTENTO_DE_MANIPULACION: 'Texto dirigido a la IA para subir la nota'
    };
    let integrity = null;
    let showReviewed = false;

    const loadIntegrity = async () => {
        contentHost.replaceChildren(skeleton(160));
        try {
            integrity = await api(`/analiticas/curso/${params.id}/integridad${showReviewed ? '?revisados=1' : ''}`);
        } catch (error) {
            contentHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
            return;
        }
        renderIntegrity();
    };

    const renderIntegrity = () => {
        const { resumen, data: items } = integrity;
        const toggle = h('label', { class: 'check-inline' },
            h('input', { type: 'checkbox', checked: showReviewed, onChange: (event) => { showReviewed = event.target.checked; loadIntegrity(); } }),
            ' Mostrar también los revisados');
        const header = h('div', { class: 'section-heading' },
            h('div', {}, h('strong', {}, `${resumen.rojos_pendientes} en rojo · ${resumen.ambar_pendientes} en ámbar por revisar`),
                h('p', { class: 'muted small' }, 'Son señales, no pruebas: pegado, salidas de la pestaña, tiempos y parecido entre estudiantes. Decide tú.')),
            toggle);
        if (items.length === 0) {
            contentHost.replaceChildren(header, emptyState('Sin envíos por revisar', 'Cuando un envío tenga señales de riesgo aparecerá aquí.'));
            return;
        }
        contentHost.replaceChildren(header, h('div', { class: 'stack' }, items.map((item) => {
            const reviewButton = h('button', { class: 'btn ghost small', type: 'button' }, item.revisado_en ? 'Desmarcar revisado' : 'Marcar como revisado');
            reviewButton.addEventListener('click', async () => {
                try {
                    await api(`/analiticas/curso/${params.id}/integridad/${item.id_envio_ejercicio}`, { method: 'PATCH', body: { revisado: !item.revisado_en } });
                    await loadIntegrity();
                } catch (error) { toast(errorMessage(error), 'error'); }
            });
            const signals = item.senales || {};
            return h('article', { class: `card integrity-item risk-${item.riesgo}` },
                h('div', { class: 'section-heading' },
                    h('div', {},
                        h('strong', {}, item.estudiante), ' · ', `Mundo ${item.mundo_orden}: ${item.ejercicio}`,
                        h('p', { class: 'muted small' }, formatDate(item.fecha_envio),
                            item.puntaje === null || item.puntaje === undefined ? '' : ` · nota ${item.puntaje}`,
                            item.alerta_manipulacion && item.puntaje_modelo !== null ? ` (la IA habría puesto ${item.puntaje_modelo})` : '')),
                    h('span', { class: `chip risk-chip ${item.riesgo}` }, item.riesgo === 'rojo' ? 'Rojo' : 'Ámbar')),
                h('ul', { class: 'integrity-reasons' }, item.motivos_riesgo.map((reason) => h('li', {}, REASON_LABEL[reason] || reason))),
                item.estudiante_similar ? h('p', { class: 'small' }, `Parecido ${Math.round(Number(item.similitud) * 100)} % con el código de ${item.estudiante_similar}.`) : null,
                h('p', { class: 'small muted' },
                    `Pegó ${signals.pegados || 0} vez/veces (${signals.chars_pegados || 0} caracteres) · salió ${signals.cambios_foco || 0} vez/veces (${signals.segundos_fuera || 0} s) · `,
                    `abierto ${signals.segundos_abierto || 0} s`),
                h('div', { class: 'row' }, reviewButton));
        })));
    };

    const renderErrors = () => {
        if (data.categorias_error.length === 0) {
            contentHost.replaceChildren(emptyState('Sin evaluaciones registradas', 'Las categorías de error aparecerán cuando los estudiantes envíen ejercicios a la IA.'));
            return;
        }
        const total = data.categorias_error.reduce((sum, item) => sum + Number(item.total), 0) || 1;
        contentHost.replaceChildren(h('div', { class: 'card' },
            h('div', { class: 'section-heading' },
                h('h2', {}, 'Errores frecuentes'),
                h('span', { class: 'muted small' }, `${formatNumber(total)} evaluaciones`)),
            h('div', { class: 'stat-bars' }, data.categorias_error.map((item) => {
                const percent = Math.round((Number(item.total) / total) * 100);
                return h('div', { class: 'stat-row' },
                    h('header', {}, h('span', {}, errorLabel(item.categoria)), h('strong', {}, `${formatNumber(item.total)} (${percent}%)`)),
                    h('div', { class: 'stat-fill' }, h('span', { style: { '--value': `${percent}%` } })));
            }))));
    };

    const renderRooms = () => {
        if (data.salas.length === 0) {
            contentHost.replaceChildren(emptyState('Sin salas jugadas', 'Las partidas Kahoot del curso aparecerán aquí con su participación y mejor puntaje.'));
            return;
        }
        contentHost.replaceChildren(h('div', { class: 'table-wrap' },
            h('table', { class: 'table' },
                h('thead', {}, h('tr', {},
                    h('th', {}, 'PIN'),
                    h('th', {}, 'Estado'),
                    h('th', { class: 'num' }, 'Participantes'),
                    h('th', { class: 'num' }, 'Mejor puntaje'),
                    h('th', {}, 'Creada'),
                    h('th', {}, 'Fin'))),
                h('tbody', {}, data.salas.map((room) => h('tr', {},
                    h('td', {}, h('strong', { style: { letterSpacing: '.1em' } }, room.pin)),
                    h('td', {}, room.estado),
                    h('td', { class: 'num' }, formatNumber(room.participantes)),
                    h('td', { class: 'num' }, room.max_puntaje === null ? '—' : formatNumber(room.max_puntaje)),
                    h('td', {}, formatDate(room.fecha_creacion)),
                    h('td', {}, formatDate(room.fecha_fin))))))));
    };

    const renderTab = () => {
        tabHost.replaceChildren(h('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Secciones de analíticas' },
            [['mundos', 'Mundos'], ['estudiantes', 'Estudiantes'], ['errores', 'Errores'], ['integridad', 'Integridad'], ['salas', 'Salas']].map(([key, label]) =>
                h('button', {
                    type: 'button', role: 'tab', 'aria-selected': activeTab === key ? 'true' : 'false',
                    class: activeTab === key ? 'is-active' : '',
                    onClick: () => { activeTab = key; renderTab(); }
                }, label))));

        if (loading || !data) return;
        if (activeTab === 'mundos') renderWorlds();
        else if (activeTab === 'estudiantes') renderStudents();
        else if (activeTab === 'errores') renderErrors();
        else if (activeTab === 'integridad') loadIntegrity();
        else renderRooms();
    };

    const loadConsumption = async () => {
        consumptionHost.replaceChildren(skeleton(120));
        try {
            const query = user.rol === 'superadministrador' ? `?id_docente=${data.curso.id_docente}` : '';
            const { data: consumption } = await api(`/ia/consumo${query}`);
            const quota = consumption.cuota_vigente;
            const summary = consumption.resumen || {};
            consumptionHost.replaceChildren(h('section', { class: 'card' },
                h('div', { class: 'section-heading' },
                    h('div', {},
                        h('h2', {}, 'Consumo de IA del docente'),
                        h('p', { class: 'muted small' }, data.curso.docente_nombre)),
                    user.rol === 'superadministrador'
                        ? h('a', { class: 'text-action', href: '#/admin/cuotas' }, 'Gestionar cuotas', icon('arrow', 14))
                        : null),
                quota
                    ? h('div', { class: 'metric-strip' },
                        h('div', {}, h('span', {}, 'Tokens disponibles'), h('strong', {}, formatNumber(quota.tokens_disponibles))),
                        h('div', {}, h('span', {}, 'Consumidos'), h('strong', {}, formatNumber(quota.tokens_consumidos))),
                        h('div', {}, h('span', {}, 'Operaciones'), h('strong', {}, formatNumber(summary.operaciones))))
                    : h('div', { class: 'alert warn' }, 'El docente no tiene una cuota de IA vigente.')));
        } catch (error) {
            consumptionHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
        }
    };

    try {
        const response = await api(`/analiticas/curso/${params.id}`);
        data = response.data;
        loading = false;
        document.title = `${data.curso.nombre} · Analíticas`;
        renderHeader();
        renderTab();
        loadConsumption();
    } catch (error) {
        headerHost.replaceChildren(h('h1', {}, 'No pudimos cargar las analíticas'));
        statsHost.replaceChildren();
        tabHost.replaceChildren();
        contentHost.replaceChildren(h('div', { class: 'card' },
            h('div', { class: 'alert error' }, errorMessage(error)),
            h('a', { class: 'btn ghost', href: '#/analiticas' }, 'Volver a analíticas')));
    }
}
