import { h, icon, skeleton, errorMessage, formatNumber } from '../../ui.js';
import { api } from '../../api.js';
import { courseFormModal, emptyState, statusChip, languageChip } from './helpers.js';

const courseRow = (course, onEdit) => h('tr', {},
    h('td', {},
        h('div', { class: 'cell-main' },
            h('strong', {}, course.nombre),
            h('small', {}, course.codigo_curso, ' · ', languageChip(course.lenguaje)))),
    h('td', {}, course.periodo),
    h('td', {}, statusChip(course.estado)),
    h('td', { class: 'num' }, formatNumber(course.total_estudiantes)),
    h('td', { class: 'num' }, formatNumber(course.total_mundos)),
    h('td', {},
        h('div', { class: 'row-actions' },
            h('button', { class: 'btn ghost small', type: 'button', onClick: () => onEdit(course) }, 'Editar'),
            h('a', { class: 'btn secondary small', href: `#/cursos/${course.id_curso}` }, 'Gestionar'))));

export default async function coursesView({ root, user }) {
    document.title = 'Cursos · codeInt';
    const canCreate = user.rol === 'docente';

    const search = h('input', {
        class: 'input', type: 'search', placeholder: 'Buscar por nombre o código', 'aria-label': 'Buscar cursos'
    });
    const newButton = canCreate
        ? h('button', { class: 'btn', type: 'button', onClick: () => courseFormModal({ onSaved: () => load() }) }, icon('play', 15), 'Nuevo curso')
        : null;
    const host = h('div', { class: 'table-wrap' }, skeleton(220));

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' }, h('a', { href: '#/' }, 'Panel'), ' / Cursos'),
        h('div', { class: 'page-head' },
            h('div', {}, h('h1', {}, 'Cursos'), h('p', {}, 'Crea cursos, edita su información y entra a gestionar mundos y matrículas.')),
            newButton),
        h('div', { class: 'toolbar' },
            h('div', { style: { maxWidth: '360px', width: '100%' } }, search)),
        host));

    let courses = [];

    const paint = () => {
        const term = search.value.trim().toLowerCase();
        const filtered = term
            ? courses.filter((course) => `${course.nombre} ${course.codigo_curso}`.toLowerCase().includes(term))
            : courses;

        if (courses.length === 0) {
            host.replaceChildren(emptyState(
                'Todavía no hay cursos',
                canCreate ? 'Crea tu primer curso y elige su lenguaje de programación.' : 'Cuando los docentes creen cursos aparecerán aquí.'
            ));
            return;
        }

        if (filtered.length === 0) {
            host.replaceChildren(emptyState('Sin coincidencias', 'Prueba con otro nombre o código de curso.'));
            return;
        }

        host.replaceChildren(h('table', { class: 'table' },
            h('thead', {}, h('tr', {},
                h('th', {}, 'Curso'),
                h('th', {}, 'Periodo'),
                h('th', {}, 'Estado'),
                h('th', { class: 'num' }, 'Estudiantes'),
                h('th', { class: 'num' }, 'Mundos'),
                h('th', {}, h('span', { class: 'sr-only' }, 'Acciones')))),
            h('tbody', {}, filtered.map((course) => courseRow(course, (item) => {
                courseFormModal({ course: item, onSaved: () => load() });
            })))));
    };

    const load = async () => {
        try {
            const response = await api('/cursos');
            courses = response.data;
            paint();
        } catch (error) {
            host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
        }
    };

    search.addEventListener('input', paint);
    await load();
}
