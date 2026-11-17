import { h, icon, skeleton, errorMessage, formatDate, formatNumber } from '../../ui.js';
import { api } from '../../api.js';
import { refreshUser } from '../../state.js';
import { CHARACTERS, createAvatar, editionLabel, getCharacterChoice } from '../../characters.js';

const progressBar = (value, label, className = '') => h('div', {
    class: `progress ${className}`.trim(), role: 'progressbar',
    'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value, 'aria-label': label
}, h('span', { style: { '--value': `${value}%` } }));

const courseRow = (course) => {
    const total = course.total_mundos || 0;
    const done = course.mundos_completados || 0;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return h('article', { class: 'course-row' },
        h('div', { class: 'course-main' },
            h('div', {}, h('h3', {}, course.nombre), h('p', {}, `${course.codigo_curso} · ${course.periodo}`)),
            h('a', { class: 'text-action', href: `#/curso/${course.id_curso}` }, done > 0 ? 'Continuar' : 'Comenzar', icon('play', 14))),
        h('div', { class: 'course-progress' },
            h('span', {}, `${done} de ${total} mundos`),
            h('strong', {}, `${percent}%`)),
        progressBar(percent, `Avance en ${course.nombre}`));
};

const achievementRow = (item) => {
    const unlocked = Boolean(item.fecha_obtencion);
    const max = Number(item.valor_umbral) || 1;
    const current = Number(item.progreso) || 0;
    const percent = Math.min(100, Math.round((current / max) * 100));
    return h('li', { class: `achievement-row ${unlocked ? 'is-unlocked' : ''}` },
        h('span', { class: 'achievement-mark', 'aria-hidden': 'true' }, icon(unlocked ? 'trophy' : 'lock', 17)),
        h('span', { class: 'achievement-copy' }, h('strong', {}, item.nombre), h('small', {}, item.descripcion)),
        unlocked
            ? h('span', { class: 'achievement-state' }, `Obtenido ${formatDate(item.fecha_obtencion)}`)
            : h('span', { class: 'achievement-state' }, `${current} de ${max}`, progressBar(percent, `Progreso de ${item.nombre}`)));
};

const missionPanel = (user, courses) => {
    const choice = getCharacterChoice();
    const character = CHARACTERS[choice.index];
    const course = courses[0];
    return h('section', { class: 'mission-panel' },
        h('div', { class: 'mission-copy' },
            h('h1', {}, course ? 'Tu próxima misión' : 'Tu campus está listo'),
            h('p', {}, course
                ? `${course.nombre}: abre el mapa y continúa desde el primer mundo disponible.`
                : `Hola, ${user.nombre}. Cuando tu docente te matricule, tu primera ruta aparecerá aquí.`),
            course
                ? h('a', { class: 'btn', href: `#/curso/${course.id_curso}` }, 'Continuar ruta', icon('play', 16))
                : h('span', { class: 'muted' }, 'Aún no tienes cursos asignados.')),
        h('div', { class: 'mission-character' },
            createAvatar(choice.index, choice.form, 'dashboard-avatar'),
            h('div', {}, h('strong', {}, character.name), h('span', {}, `${character.trait} · ${editionLabel(choice.form)}`)),
            h('a', { class: 'text-action', href: '#/personajes' }, 'Cambiar personaje')));
};

const progressPanel = (gami) => {
    if (!gami) return h('section', { class: 'progress-panel' }, h('h2', {}, 'Tu progreso'), h('p', { class: 'muted' }, 'Aún no hay datos de nivel.'));
    const next = gami.siguiente_nivel;
    return h('section', { class: 'progress-panel' },
        h('div', { class: 'panel-heading' },
            h('div', {}, h('h2', {}, 'Tu progreso'), h('p', {}, next ? `${formatNumber(gami.xp_faltante)} XP para ${next.nombre}` : 'Nivel máximo alcanzado')),
            h('span', { class: 'level-value' }, `Nivel ${gami.nivel_actual}`)),
        progressBar(gami.porcentaje_progreso, 'Progreso al siguiente nivel', 'xp'),
        h('div', { class: 'metric-strip' },
            h('div', {}, h('span', {}, 'XP total'), h('strong', {}, formatNumber(gami.xp_total))),
            h('div', {}, h('span', {}, 'Ejercicios aprobados'), h('strong', {}, formatNumber(gami.total_ejercicios_aprobados))),
            h('div', {}, h('span', {}, 'Logros'), h('strong', {}, formatNumber(gami.total_logros_desbloqueados)))));
};

export default async function dashboardView({ root, user }) {
    document.title = 'Centro de misiones · codeInt';

    const dashboard = h('div', { class: 'dashboard-layout' },
        h('div', { class: 'dashboard-lead' }, skeleton(330)),
        h('div', { class: 'dashboard-progress' }, skeleton(220)));
    const coursesHost = h('div', { class: 'course-list' }, skeleton(90), skeleton(90));
    const achievementsHost = h('div', {}, skeleton(180));

    root.append(h('div', { class: 'container dashboard-page' },
        dashboard,
        h('div', { class: 'dashboard-lower' },
            h('section', { class: 'section-block' },
                h('div', { class: 'section-heading' }, h('h2', {}, 'Mis cursos'), h('span', { class: 'muted' }, 'Rutas asignadas')),
                coursesHost),
            h('section', { class: 'section-block' },
                h('div', { class: 'section-heading' }, h('h2', {}, 'Logros'), h('span', { class: 'muted' }, 'Progreso reciente')),
                achievementsHost))));

    const profile = await refreshUser().catch(() => user);
    const [coursesResult, achievementsResult] = await Promise.allSettled([
        api('/cursos'),
        api('/gamificacion/logros')
    ]);
    const courses = coursesResult.status === 'fulfilled' ? coursesResult.value.data : [];

    dashboard.replaceChildren(
        h('div', { class: 'dashboard-lead' }, missionPanel(profile, courses)),
        h('div', { class: 'dashboard-progress' }, progressPanel(profile.gamification)));

    if (coursesResult.status === 'fulfilled') {
        coursesHost.replaceChildren(...(courses.length
            ? courses.map(courseRow)
            : [h('div', { class: 'empty-state' }, h('strong', {}, 'Sin cursos asignados'), h('p', {}, 'Pide a tu docente que te matricule para comenzar una ruta.'))]));
    } else {
        coursesHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(coursesResult.reason)));
    }

    if (achievementsResult.status === 'fulfilled') {
        const achievements = achievementsResult.value.data;
        achievementsHost.replaceChildren(achievements.length
            ? h('ul', { class: 'achievement-list' }, achievements.slice(0, 5).map(achievementRow))
            : h('div', { class: 'empty-state compact' }, h('strong', {}, 'Aún no hay logros'), h('p', {}, 'Tus avances aparecerán después de completar ejercicios.')));
    } else {
        achievementsHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(achievementsResult.reason)));
    }
}
