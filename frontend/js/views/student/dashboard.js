import { h, icon, skeleton, errorMessage, formatDate, formatNumber } from '../../ui.js';
import { api } from '../../api.js';
import { refreshUser } from '../../state.js';
import { createAvatar, getAvatarChoice, className } from '../../characters.js';
import { LAYERS } from '../../avatar-parts.js';

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
            h('div', { class: 'course-links' },
                h('a', { class: 'text-action', href: `#/ranking/${course.id_curso}` }, 'Ranking', icon('trophy', 14)),
                h('a', { class: 'text-action', href: `#/curso/${course.id_curso}` }, done > 0 ? 'Continuar' : 'Comenzar', icon('play', 14)))),
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

const missionPanel = (user, courses, next) => {
    const choice = getAvatarChoice();
    const course = courses[0];
    return h('section', { class: 'mission-panel' },
        h('div', { class: 'mission-copy' },
            h('h1', {}, course ? 'Tu próxima misión' : 'Tu campus está listo'),
            h('p', {}, !course
                ? `Hola, ${user.nombre}. Cuando tu docente te matricule, tu primera ruta aparecerá aquí.`
                : next
                    ? `${course.nombre} · ${next.mundo_nombre}: «${next.titulo}» te espera.`
                    : `${course.nombre}: ya aprobaste todos los ejercicios. Repasa el mapa o juega una sala.`),
            course
                ? h('a', { class: 'btn', href: next ? `#/ejercicio/${next.id_ejercicio}` : `#/curso/${course.id_curso}` },
                    next ? 'Continuar donde quedaste' : 'Ver mapa de mundos', icon('play', 16))
                : h('span', { class: 'muted' }, 'Aún no tienes cursos asignados.')),
        h('div', { class: 'mission-character' },
            createAvatar(choice, { size: 96, label: `Tu avatar: ${className(choice.clase)}`, className: 'dashboard-avatar' }),
            h('div', {}, h('strong', {}, user.nombre), h('span', {}, `${className(choice.clase)} · Nivel ${user.gamification?.nivel_actual || 1}`)),
            h('a', { class: 'text-action', href: '#/personajes' }, 'Cambiar avatar')));
};

const rewardName = (reward) => {
    if (!reward) return null;
    const layer = LAYERS.find((item) => item.key === reward.capa);
    const piece = layer?.items.find((item) => item.id === reward.id);
    return piece ? `${layer.label}: ${piece.nombre}` : null;
};

const missionCard = (mission) => {
    const percent = Math.round((mission.progreso / mission.meta) * 100);
    const reward = rewardName(mission.recompensa);
    return h('li', { class: `mission-card${mission.completada ? ' is-done' : ''}` },
        h('div', { class: 'mission-card-head' },
            h('strong', {}, mission.nombre),
            mission.completada ? h('span', { class: 'chip' }, 'Completada') : h('span', { class: 'mission-count' }, `${mission.progreso}/${mission.meta}`)),
        h('p', {}, mission.descripcion),
        h('div', {
            class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100,
            'aria-valuenow': percent, 'aria-label': `Progreso de ${mission.nombre}`
        }, h('span', { style: { '--value': `${percent}%` } })),
        reward ? h('small', { class: 'mission-reward' }, icon('sparkles', 13),
            mission.completada ? `Desbloqueaste ${reward}` : `Premio: ${reward}`) : null);
};

const missionsSection = (data) => {
    if (!data) return null;
    return h('section', { class: 'section-block missions-block', 'aria-label': 'Misiones de la semana' },
        h('div', { class: 'section-heading' },
            h('h2', {}, 'Misiones de la semana'),
            h('a', { class: 'text-action', href: '#/personajes' }, 'Estrenar premios', icon('user', 14))),
        h('ul', { class: 'mission-list' }, data.misiones.map(missionCard)));
};

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const streakPanel = (streak) => {
    if (!streak) return null;
    const days = streak.racha_actual;
    const message = days === 0
        ? 'Resuelve un ejercicio o juega una sala hoy para empezar tu racha.'
        : streak.en_riesgo
            ? `Llevas ${days} ${days === 1 ? 'día' : 'días'}. Haz algo hoy para mantenerla.`
            : `${days} ${days === 1 ? 'día seguido' : 'días seguidos'}. ¡Sigue así!`;
    return h('section', { class: `streak-panel${days > 0 ? ' is-active' : ''}` },
        h('div', { class: 'streak-head' },
            h('span', { class: 'streak-icon', 'aria-hidden': 'true' }, icon('bolt', 22)),
            h('div', {},
                h('strong', { class: 'streak-count' }, `${days} ${days === 1 ? 'día' : 'días'}`),
                h('span', { class: 'streak-label' }, 'de racha')),
            h('span', { class: 'streak-best', title: 'Tu mejor racha' }, `Mejor: ${streak.mejor_racha}`)),
        h('ol', { class: 'streak-week', 'aria-label': 'Actividad de los últimos 7 días' },
            streak.ultimos_7.map((day) => {
                const letter = DAY_LABELS[new Date(`${day.fecha}T12:00:00Z`).getUTCDay()];
                return h('li', { class: `${day.activo ? 'is-done' : ''}${day.hoy ? ' is-today' : ''}`.trim() },
                    h('span', { class: 'streak-dot', 'aria-hidden': 'true' }),
                    h('span', { class: 'sr-only' }, `${day.fecha}: ${day.activo ? 'con actividad' : 'sin actividad'}`),
                    h('small', { 'aria-hidden': 'true' }, letter));
            })),
        h('p', { class: 'streak-note' }, message));
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
                h('div', { class: 'section-heading' }, h('h2', {}, 'Logros'), h('a', { class: 'text-action', href: '#/logros' }, 'Ver todos', icon('trophy', 14))),
                achievementsHost))));

    const profile = await refreshUser().catch(() => user);
    const [coursesResult, achievementsResult] = await Promise.allSettled([
        api('/cursos'),
        api('/gamificacion/logros')
    ]);
    const courses = coursesResult.status === 'fulfilled' ? coursesResult.value.data : [];
    // Un fallo aquí no debe romper el panel: sin dato se vuelve al mapa del curso.
    // Racha y misiones son opcionales: si fallan, el resto del panel sigue funcionando.
    const [streak, missions] = await Promise.all([
        api('/gamificacion/racha').catch(() => null),
        api('/gamificacion/misiones').catch(() => null)
    ]);
    const next = courses[0]
        ? await api(`/mundos/curso/${courses[0].id_curso}/siguiente`).then((body) => body.data).catch(() => null)
        : null;

    const missionsNode = missionsSection(missions);
    if (missionsNode) dashboard.after(missionsNode);
    dashboard.replaceChildren(
        h('div', { class: 'dashboard-lead' }, missionPanel(profile, courses, next)),
        h('div', { class: 'dashboard-progress' }, progressPanel(profile.gamification), streakPanel(streak)));

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
            ? h('ul', { class: 'achievement-list' }, achievements.slice(0, 5).map(achievementRow) /* resumen: la lista completa vive en #/logros */)
            : h('div', { class: 'empty-state compact' }, h('strong', {}, 'Aún no hay logros'), h('p', {}, 'Tus avances aparecerán después de completar ejercicios.')));
    } else {
        achievementsHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(achievementsResult.reason)));
    }
}
