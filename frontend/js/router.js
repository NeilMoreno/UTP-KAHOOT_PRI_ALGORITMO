// Router por hash con carga diferida de vistas y control de acceso por rol.
import { h, clear, errorMessage } from './ui.js';
import { state } from './state.js';

const ROUTES = [
    { path: '/inicio', public: true, load: () => import('./views/landing.js') },
    { path: '/login', public: true, load: () => import('./views/login.js') },
    { path: '/registro', public: true, load: () => import('./views/register.js') },
    { path: '/recuperar-password', public: true, load: () => import('./views/forgot-password.js') },
    { path: '/restablecer-password', public: true, load: () => import('./views/reset-password.js') },
    { path: '/', load: () => import('./views/home.js') },
    { path: '/perfil', load: () => import('./views/profile.js') },
    { path: '/personajes', roles: ['estudiante'], load: () => import('./views/student/characters.js') },
    { path: '/logros', roles: ['estudiante'], load: () => import('./views/student/achievements.js') },
    { path: '/ranking/:id', roles: ['estudiante', 'docente', 'superadministrador'], load: () => import('./views/student/ranking.js') },
    { path: '/curso/:id', roles: ['estudiante'], load: () => import('./views/student/worlds.js') },
    { path: '/mundo/:id', roles: ['estudiante'], load: () => import('./views/student/exercises.js') },
    { path: '/ejercicio/:id', roles: ['estudiante'], load: () => import('./views/student/workspace.js') },
    { path: '/jugar', roles: ['estudiante'], load: () => import('./views/student/play.js') },
    { path: '/jugar/:pin', roles: ['estudiante'], load: () => import('./views/student/play-room.js') },
    { path: '/cursos', roles: ['docente', 'superadministrador'], load: () => import('./views/teacher/courses.js') },
    { path: '/cursos/:id/silabo', roles: ['docente', 'superadministrador'], load: () => import('./views/teacher/syllabus.js') },
    { path: '/cursos/:id', roles: ['docente', 'superadministrador'], load: () => import('./views/teacher/course.js') },
    { path: '/mundos/:id', roles: ['docente', 'superadministrador'], load: () => import('./views/teacher/world.js') },
    { path: '/salas', roles: ['docente', 'superadministrador'], load: () => import('./views/teacher/salas.js') },
    { path: '/salas/:pin', roles: ['docente', 'superadministrador'], load: () => import('./views/teacher/host.js') },
    { path: '/analiticas', roles: ['docente', 'superadministrador'], load: () => import('./views/teacher/analytics.js') },
    { path: '/analiticas/:id', roles: ['docente', 'superadministrador'], load: () => import('./views/teacher/analytics-course.js') },
    { path: '/admin/usuarios', roles: ['superadministrador'], load: () => import('./views/admin/users.js') },
    { path: '/admin/invitaciones', roles: ['superadministrador'], load: () => import('./views/admin/invitations.js') },
    { path: '/admin/instituciones', roles: ['superadministrador'], load: () => import('./views/admin/institutions.js') },
    { path: '/admin/cuotas', roles: ['superadministrador'], load: () => import('./views/admin/quotas.js') }
];

const compile = (path) => {
    const names = [];
    const pattern = path.replace(/:([a-z]+)/g, (_, name) => { names.push(name); return '([^/]+)'; });
    return { regex: new RegExp(`^${pattern}$`), names };
};
const COMPILED = ROUTES.map((route) => ({ ...route, ...compile(route.path) }));

export const navigate = (path) => {
    const target = `#${path}`;
    if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = target;
};

export const currentPath = () => {
    const raw = location.hash.slice(1) || '/';
    return raw.split('?')[0] || '/';
};

const currentQuery = () => {
    const raw = location.hash.slice(1);
    const index = raw.indexOf('?');
    return new URLSearchParams(index >= 0 ? raw.slice(index + 1) : '');
};

let cleanup = null;
let renderToken = 0;

export function startRouter({ host, onRender }) {
    const render = async () => {
        const token = ++renderToken;
        if (cleanup) { try { cleanup(); } catch { /* limpieza de la vista anterior */ } cleanup = null; }

        const path = currentPath();
        let match = null;
        let params = {};
        for (const route of COMPILED) {
            const result = route.regex.exec(path);
            if (result) {
                match = route;
                params = Object.fromEntries(route.names.map((name, i) => [name, decodeURIComponent(result[i + 1])]));
                break;
            }
        }

        if (!match) return navigate('/');
        if (!match.public && !state.user) return navigate(match.path === '/' ? '/inicio' : '/login');
        if (match.public && state.user && (match.path === '/login' || match.path === '/inicio')) return navigate('/');
        if (match.roles && !match.roles.includes(state.user.rol)) return navigate('/');

        const root = h('div', { class: 'view' });
        clear(host).append(root);
        onRender(path, match.public === true);

        try {
            const module = await match.load();
            if (token !== renderToken) return;
            const result = await module.default({ root, params, query: currentQuery(), user: state.user });
            if (token === renderToken && typeof result === 'function') cleanup = result;
            else if (typeof result === 'function') result();
            if (token === renderToken) {
                const heading = root.querySelector('h1');
                if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
            }
        } catch (error) {
            if (token !== renderToken) return;
            console.error(`[router] No se pudo cargar la vista ${path}`, error);
            clear(root).append(h('div', { class: 'container narrow' },
                h('div', { class: 'card' },
                    h('h2', {}, 'No pudimos cargar esta pantalla'),
                    h('p', { class: 'muted' }, errorMessage(error)),
                    h('button', { class: 'btn', type: 'button', onClick: render }, 'Reintentar')
                )));
        }
    };

    window.addEventListener('hashchange', render);
    render();
    return render;
}
