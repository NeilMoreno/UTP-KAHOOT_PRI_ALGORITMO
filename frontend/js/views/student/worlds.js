import { h, icon, toast } from '../../ui.js';
import { api } from '../../api.js';
import { navigate } from '../../router.js';

const STATE_LABEL = { completado: 'Completado', en_progreso: 'En progreso', bloqueado: 'Bloqueado' };

const worldNode = (world, previous) => {
    const locked = world.estado === 'bloqueado';
    const cls = world.estado === 'completado' ? 'done' : (locked ? 'locked' : 'current');
    const percent = world.porcentaje_completado || 0;
    const stateIcon = world.estado === 'completado' ? 'check' : (locked ? 'lock' : 'play');

    const open = () => {
        if (locked) {
            toast(previous
                ? `Completa primero todos los ejercicios del Mundo ${previous.orden}: ${previous.nombre}.`
                : 'Este mundo todavía no está disponible.');
            return;
        }
        navigate(`/mundo/${world.id_mundo}`);
    };

    return h('li', { class: `world-item ${cls}` },
        h('button', {
            class: 'world-node', type: 'button', onClick: open,
            'aria-disabled': locked ? 'true' : null,
            'aria-label': `Mundo ${world.orden}: ${world.nombre}. ${STATE_LABEL[world.estado]}. ${world.ejercicios_aprobados} de ${world.total_ejercicios} ejercicios aprobados.`
        },
        h('span', { class: 'world-badge' },
            h('span', { class: 'world-index', 'aria-hidden': 'true' }, world.orden),
            h('span', { class: 'world-state' }, icon(stateIcon, 15))),
        h('span', { class: 'world-label' },
            h('span', { class: 'world-name' }, `Mundo ${world.orden}: ${world.nombre}`),
            h('span', { class: 'world-meta' }, locked
                ? 'Bloqueado'
                : `${world.ejercicios_aprobados} de ${world.total_ejercicios} ejercicios`),
            locked ? null : h('span', { class: 'progress', 'aria-hidden': 'true' }, h('span', { style: { '--value': `${percent}%` } })))));
};

export default async function worldsView({ root, params }) {
    document.title = 'Mapa de mundos · codeInt';
    const { curso, data: worlds } = await api(`/mundos/curso/${params.id}`);
    const done = worlds.filter((w) => w.estado === 'completado').length;

    root.append(h('div', { class: 'container world-page' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' }, h('a', { href: '#/' }, 'Inicio'), ' / ', curso?.nombre || 'Curso'),
        h('div', { class: 'page-head' },
            h('div', {}, h('h1', {}, curso?.nombre || 'Mapa de mundos'),
                h('p', {}, `${done} de ${worlds.length} mundos completados`))),
        worlds.length === 0
            ? h('div', { class: 'card empty' }, 'Este curso aún no tiene mundos.')
            : h('section', { class: 'world-stage', 'aria-label': 'Constelación del curso' },
                h('ol', { class: 'world-path', 'aria-label': 'Mundos del curso' },
                    worlds.map((world, index) => worldNode(world, worlds[index - 1]))))));
}
