import { h, icon } from '../../ui.js';
import { api, ApiError } from '../../api.js';

const exerciseRow = (exercise) => {
    const passed = exercise.aprobado === true;
    const tried = !passed && exercise.puntaje !== null && exercise.puntaje !== undefined;
    return h('li', {},
        h('a', { class: `exercise-row ${passed ? 'passed' : (tried ? 'tried' : '')}`, href: `#/ejercicio/${exercise.id_ejercicio}` },
            h('span', { class: 'exercise-num', 'aria-hidden': 'true' }, passed ? icon('check', 18) : exercise.orden),
            h('span', { class: 'exercise-body' },
                h('strong', {}, exercise.titulo),
                h('span', {}, passed
                    ? `Aprobado con ${exercise.puntaje}/100`
                    : (tried ? `Último intento: ${exercise.puntaje}/100 · necesitas 70` : 'Sin intentos todavía'))),
            h('span', { class: 'chip xp' }, icon('bolt', 13), `${exercise.xp_recompensa} XP`)));
};

export default async function exercisesView({ root, params }) {
    document.title = 'Ejercicios · codeInt';
    let response;
    try {
        response = await api(`/ejercicios/mundo/${params.id}`);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            root.append(h('div', { class: 'container narrow' },
                h('div', { class: 'card' },
                    h('h1', {}, 'Mundo bloqueado'),
                    h('div', { class: 'alert warn' }, error.message),
                    h('p', {}, h('a', { class: 'btn ghost', href: '#/' }, 'Volver al inicio')))));
            return;
        }
        throw error;
    }

    const { mundo, data: exercises } = response;
    const passed = exercises.filter((e) => e.aprobado).length;
    const backTo = exercises[0] ? `#/curso/${exercises[0].id_curso}` : '#/';

    root.append(h('div', { class: 'container narrow' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Inicio'), ' / ', h('a', { href: backTo }, 'Mapa'), ' / ', `Mundo ${mundo.orden}`),
        h('div', { class: 'page-head' },
            h('div', {}, h('h1', {}, `Mundo ${mundo.orden}: ${mundo.nombre}`), h('p', {}, mundo.descripcion))),
        h('p', { class: 'small muted' }, `${passed} de ${exercises.length} ejercicios aprobados`),
        exercises.length === 0
            ? h('div', { class: 'card empty' }, 'Este mundo todavía no tiene ejercicios.')
            : h('ul', { class: 'exercise-list' }, exercises.map(exerciseRow))));
}
