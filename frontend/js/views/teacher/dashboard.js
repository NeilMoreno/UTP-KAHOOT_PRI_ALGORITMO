import { h, icon, skeleton, errorMessage, formatNumber } from '../../ui.js';
import { api } from '../../api.js';
import { courseFormModal, emptyState, statusChip } from './helpers.js';

const courseCard = (course) => h('article', { class: 'card' },
    h('div', { class: 'section-heading' },
        h('h3', {}, course.nombre),
        statusChip(course.estado)),
    h('p', { class: 'muted small' }, `${course.codigo_curso} · ${course.periodo}`),
    h('div', { class: 'info-list' },
        h('div', { class: 'info-row' }, h('span', {}, 'Estudiantes activos'), h('strong', {}, formatNumber(course.total_estudiantes))),
        h('div', { class: 'info-row' }, h('span', {}, 'Mundos'), h('strong', {}, formatNumber(course.total_mundos)))),
    h('div', { class: 'form-actions' },
        h('a', { class: 'btn secondary small', href: `#/cursos/${course.id_curso}` }, 'Gestionar curso', icon('arrow', 14))));

export default async function teacherDashboard({ root, user }) {
    document.title = 'Panel docente · codeInt';

    const openCreate = () => courseFormModal({ onSaved: () => load() });

    const statsHost = h('div', { class: 'stat-grid' },
        skeleton(96), skeleton(96), skeleton(96));
    const coursesHost = h('div', { class: 'grid cols-3' },
        skeleton(190), skeleton(190), skeleton(190));

    root.append(h('div', { class: 'container dashboard-page' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' }, 'Panel'),
        h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, `Hola, ${user.nombre}`),
                h('p', {}, 'Prepara tus cursos, matricula estudiantes y publica ejercicios de práctica.')),
            h('div', { class: 'row' },
                h('button', { class: 'btn', type: 'button', onClick: openCreate }, icon('play', 15), 'Nuevo curso'),
                h('a', { class: 'btn ghost', href: '#/cursos' }, 'Ver todos'))),
        statsHost,
        h('section', { class: 'section-block' },
            h('div', { class: 'section-heading' },
                h('h2', {}, 'Tus cursos'),
                h('span', { class: 'muted small' }, 'Acceso rápido a la gestión')),
            coursesHost)));

    const load = async () => {
        try {
            const { data: courses } = await api('/cursos');
            const activos = courses.filter((course) => course.estado === 'activo');
            const estudiantes = courses.reduce((total, course) => total + Number(course.total_estudiantes || 0), 0);
            const mundos = courses.reduce((total, course) => total + Number(course.total_mundos || 0), 0);

            statsHost.replaceChildren(
                h('div', { class: 'stat-card' }, h('span', {}, 'Cursos activos'), h('strong', {}, formatNumber(activos.length))),
                h('div', { class: 'stat-card' }, h('span', {}, 'Estudiantes matriculados'), h('strong', {}, formatNumber(estudiantes))),
                h('div', { class: 'stat-card' }, h('span', {}, 'Mundos disponibles'), h('strong', {}, formatNumber(mundos))));

            coursesHost.replaceChildren(...(courses.length
                ? courses.slice(0, 6).map(courseCard)
                : [emptyState('Todavía no tienes cursos', 'Crea tu primer curso y comienza a matricular estudiantes.')]));
        } catch (error) {
            statsHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
            coursesHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
        }
    };

    await load();
}
