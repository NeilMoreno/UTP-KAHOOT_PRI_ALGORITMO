import { h, icon, skeleton, errorMessage, formatNumber } from '../../ui.js';
import { api } from '../../api.js';
import { emptyState } from './helpers.js';

const average = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(1) : '0.0';
};

const progressBar = (value, label) => h('div', {
    class: 'progress', role: 'progressbar',
    'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value, 'aria-label': label
}, h('span', { style: { '--value': `${Math.max(0, Math.min(100, value))}%` } }));

const courseRow = (course) => h('tr', {},
    h('td', {}, h('div', { class: 'cell-main' },
        h('strong', {}, course.nombre),
        h('small', {}, `${course.codigo_curso} · ${course.periodo}`))),
    h('td', { class: 'num' }, formatNumber(course.total_estudiantes)),
    h('td', { class: 'num' }, formatNumber(course.total_mundos)),
    h('td', { style: { minWidth: '170px' } },
        h('div', { class: 'row', style: { gap: '9px' } },
            h('span', { class: 'small' }, `${course.porcentaje_avance}%`),
            h('div', { style: { flex: '1 1 90px' } }, progressBar(course.porcentaje_avance, `Avance de ${course.nombre}`)))),
    h('td', { class: 'num' }, average(course.promedio_puntaje)),
    h('td', { class: 'num' }, formatNumber(course.ejercicios_aprobados)),
    h('td', { class: 'num' }, formatNumber(course.total_envios)),
    h('td', {}, h('a', { class: 'btn secondary small', href: `#/analiticas/${course.id_curso}` }, 'Ver analíticas', icon('arrow', 14))));

export default async function analyticsView({ root }) {
    document.title = 'Analíticas · codeInt';

    const countChip = h('span', { class: 'chip' }, '—');
    const search = h('input', {
        class: 'input', type: 'search', placeholder: 'Buscar curso por nombre o código',
        'aria-label': 'Buscar cursos en analíticas'
    });
    const host = h('div', { class: 'table-wrap' }, skeleton(240));

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' }, h('a', { href: '#/' }, 'Panel'), ' / Analíticas'),
        h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, 'Analíticas académicas'),
                h('p', {}, 'Avance, resultados y dificultades de tus cursos con datos reales.')),
            countChip),
        h('div', { class: 'toolbar' }, h('div', { style: { maxWidth: '360px', width: '100%' } }, search)),
        host));

    let courses = [];

    const paint = () => {
        const term = search.value.trim().toLowerCase();
        const filtered = term
            ? courses.filter((course) => `${course.nombre} ${course.codigo_curso} ${course.periodo}`.toLowerCase().includes(term))
            : courses;

        countChip.textContent = `${formatNumber(courses.length)} cursos`;
        if (courses.length === 0) {
            host.replaceChildren(emptyState('Sin cursos para analizar', 'Cuando tengas cursos con estudiantes y actividad, aquí verás sus métricas.'));
            return;
        }
        if (filtered.length === 0) {
            host.replaceChildren(emptyState('Sin coincidencias', 'Prueba con otro nombre, código o periodo.'));
            return;
        }

        host.replaceChildren(h('table', { class: 'table' },
            h('thead', {}, h('tr', {},
                h('th', {}, 'Curso'),
                h('th', { class: 'num' }, 'Estudiantes'),
                h('th', { class: 'num' }, 'Mundos'),
                h('th', {}, 'Avance promedio'),
                h('th', { class: 'num' }, 'Promedio'),
                h('th', { class: 'num' }, 'Aprobados'),
                h('th', { class: 'num' }, 'Envíos'),
                h('th', {}, h('span', { class: 'sr-only' }, 'Acciones')))),
            h('tbody', {}, filtered.map(courseRow))));
    };

    try {
        const response = await api('/analiticas/cursos');
        courses = response.data;
        paint();
    } catch (error) {
        host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
    }

    search.addEventListener('input', paint);
}
