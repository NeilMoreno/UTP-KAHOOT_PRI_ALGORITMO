import { h, icon, skeleton, errorMessage, formatDate } from '../../ui.js';
import { api } from '../../api.js';

const GROUPS = [
    { key: 'ejercicios_aprobados', title: 'Ejercicios', hint: 'Aprueba ejercicios de programación' },
    { key: 'mundos_completados', title: 'Mundos', hint: 'Completa mundos temáticos' },
    { key: 'xp_acumulado', title: 'Experiencia', hint: 'Acumula XP' },
    { key: 'partidas_participadas', title: 'Salas en vivo', hint: 'Juega partidas con tu curso' },
    { key: 'podios_sala', title: 'Podio', hint: 'Termina entre los 3 primeros' },
    { key: 'victorias_sala', title: 'Victorias', hint: 'Gana salas en vivo' },
    { key: 'respuestas_rapidas', title: 'Velocidad', hint: 'Acierta en menos de 3 segundos' }
];

const card = (item) => {
    const unlocked = Boolean(item.fecha_obtencion);
    const max = Number(item.valor_umbral) || 1;
    const current = Math.min(Number(item.progreso) || 0, max);
    const percent = Math.round((current / max) * 100);
    return h('li', { class: `achievement-card${unlocked ? ' is-unlocked' : ''}` },
        h('span', { class: 'achievement-mark', 'aria-hidden': 'true' }, icon(unlocked ? 'trophy' : 'lock', 20)),
        h('div', { class: 'achievement-copy' },
            h('strong', {}, item.nombre),
            h('small', {}, item.descripcion),
            unlocked
                ? h('span', { class: 'achievement-state' }, `Obtenido el ${formatDate(item.fecha_obtencion)}`)
                : h('div', { class: 'achievement-progress' },
                    h('div', {
                        class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100,
                        'aria-valuenow': percent, 'aria-label': `Progreso de ${item.nombre}`
                    }, h('span', { style: { '--value': `${percent}%` } })),
                    h('span', { class: 'achievement-state' }, `${current} de ${max}`))));
};

export default async function achievementsView({ root }) {
    document.title = 'Logros · codeInt';
    const host = h('div', {}, skeleton(120), skeleton(120));
    root.append(h('div', { class: 'container achievements-page' },
        h('div', { class: 'page-title' }, h('div', {}, h('h1', {}, 'Logros'), h('p', {}, 'Todo lo que puedes conseguir y cuánto te falta.'))),
        host));

    try {
        const { data } = await api('/gamificacion/logros');
        const unlocked = data.filter((item) => item.fecha_obtencion).length;
        host.replaceChildren(...[
            h('p', { class: 'achievement-total' }, h('strong', {}, `${unlocked} de ${data.length}`), ' logros desbloqueados'),
            ...GROUPS.map((group) => {
                const items = data.filter((item) => item.tipo_condicion === group.key);
                if (!items.length) return null;
                return h('section', { class: 'section-block', 'aria-label': group.title },
                    h('div', { class: 'section-heading' }, h('h2', {}, group.title), h('span', { class: 'muted' }, group.hint)),
                    h('ul', { class: 'achievement-grid' }, items.map(card)));
            })
        ].filter(Boolean));
    } catch (error) {
        host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
    }
}
