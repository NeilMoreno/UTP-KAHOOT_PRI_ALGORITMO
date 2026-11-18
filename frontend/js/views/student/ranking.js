import { h, skeleton, errorMessage, formatNumber } from '../../ui.js';
import { api } from '../../api.js';
import { createAvatar } from '../../characters.js';

const MEDALS = ['🥇', '🥈', '🥉'];

const rankRow = (entry) => h('li', { class: `ranking-row${entry.es_yo ? ' is-me' : ''}` },
    // Sin XP no hay posición real: evita medallas de "primer lugar" para todo el grupo empatado en cero.
    h('span', { class: 'ranking-pos' }, entry.xp > 0 ? (MEDALS[entry.posicion - 1] || entry.posicion) : '–'),
    h('span', { class: 'ranking-nick' }, createAvatar(entry.avatar, { size: 36, label: '' }),
        entry.nombre, entry.es_yo ? h('span', { class: 'chip blue' }, 'Tú') : null),
    h('span', { class: 'ranking-points' }, `${formatNumber(entry.xp)} XP`));

export default async function rankingView({ root, params, user }) {
    document.title = 'Ranking · codeInt';
    const host = h('div', {}, skeleton(300));
    root.append(h('div', { class: 'container narrow ranking-page' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' }, h('a', { href: '#/' }, 'Inicio'), ' / Ranking'),
        h('div', { class: 'page-title' }, h('div', {}, h('h1', {}, 'Ranking del curso'),
            h('p', {}, 'Ordenado por XP ganado en este curso. Compite contra ti: cada ejercicio y cada sala cuentan.'))),
        host));

    try {
        const [{ curso }, ranking] = await Promise.all([
            api(`/mundos/curso/${params.id}`),
            api(`/gamificacion/ranking/${params.id}`)
        ]);
        const isStudent = user.rol === 'estudiante';
        const outside = isStudent && ranking.yo && ranking.yo.posicion > ranking.ranking.length;
        host.replaceChildren(...[
            h('p', { class: 'muted' }, `${curso?.nombre || 'Curso'} · ${ranking.total} estudiantes`),
            ranking.ranking.length
                ? h('ol', { class: 'ranking-list card' }, ranking.ranking.map(rankRow))
                : h('div', { class: 'empty-state' }, h('strong', {}, 'Aún no hay estudiantes en este curso')),
            outside ? h('div', { class: 'ranking-self' },
                h('p', { class: 'muted small' }, 'Tu posición'),
                h('ol', { class: 'ranking-list card' }, rankRow(ranking.yo))) : null,
            isStudent && ranking.yo && ranking.yo.xp === 0
                ? h('p', { class: 'alert info' }, 'Aprueba tu primer ejercicio o juega una sala para sumar XP y subir posiciones.')
                : null
        ].filter(Boolean));
    } catch (error) {
        host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
    }
}
