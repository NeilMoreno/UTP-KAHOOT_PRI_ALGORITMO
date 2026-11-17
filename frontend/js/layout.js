import { h, icon, clear } from './ui.js';
import { state, logout, toggleTheme } from './state.js';
import { navigate } from './router.js';

const NAV_BY_ROLE = {
    estudiante: [
        {
            href: '#/', label: 'Centro de misiones', icon: 'home',
            match: (path) => path === '/' || path.startsWith('/curso') || path.startsWith('/mundo') || path.startsWith('/ejercicio')
        },
        { href: '#/jugar', label: 'Jugar', icon: 'play', match: (path) => path === '/jugar' || path.startsWith('/jugar/') },
        { href: '#/personajes', label: 'Personajes', icon: 'user', match: (path) => path === '/personajes' },
        { href: '#/perfil', label: 'Mi cuenta', icon: 'shield', match: (path) => path === '/perfil' }
    ],
    docente: [
        { href: '#/', label: 'Panel', icon: 'home', match: (path) => path === '/' },
        { href: '#/cursos', label: 'Cursos', icon: 'brand', match: (path) => path === '/cursos' || path.startsWith('/cursos/') || path.startsWith('/mundos/') },
        { href: '#/salas', label: 'Salas Kahoot', icon: 'play', match: (path) => path === '/salas' || path.startsWith('/salas/') },
        { href: '#/analiticas', label: 'Analíticas', icon: 'trophy', match: (path) => path === '/analiticas' || path.startsWith('/analiticas/') },
        { href: '#/perfil', label: 'Mi cuenta', icon: 'shield', match: (path) => path === '/perfil' }
    ],
    superadministrador: [
        { href: '#/', label: 'Panel', icon: 'home', match: (path) => path === '/' },
        { href: '#/admin/usuarios', label: 'Usuarios', icon: 'user', match: (path) => path === '/admin/usuarios' },
        { href: '#/admin/invitaciones', label: 'Invitaciones', icon: 'bolt', match: (path) => path === '/admin/invitaciones' },
        { href: '#/admin/instituciones', label: 'Instituciones', icon: 'brand', match: (path) => path === '/admin/instituciones' },
        { href: '#/admin/cuotas', label: 'Cuotas IA', icon: 'sparkles', match: (path) => path === '/admin/cuotas' },
        { href: '#/perfil', label: 'Mi cuenta', icon: 'shield', match: (path) => path === '/perfil' }
    ]
};

const ROLE_LABEL = {
    estudiante: 'Estudiante',
    docente: 'Docente',
    superadministrador: 'Superadministrador'
};

const titleForPath = (path) => {
    if (path === '/perfil') return 'Mi cuenta';
    if (path === '/personajes') return 'Personajes';
    if (path === '/jugar') return 'Jugar';
    if (path.startsWith('/jugar/')) return 'Sala en vivo';
    if (path === '/salas') return 'Salas Kahoot';
    if (path.startsWith('/salas/')) return 'Sala en vivo';
    if (path === '/analiticas') return 'Analíticas';
    if (path.startsWith('/analiticas/')) return 'Analíticas del curso';
    if (path === '/admin/usuarios') return 'Usuarios';
    if (path === '/admin/invitaciones') return 'Invitaciones';
    if (path === '/admin/instituciones') return 'Instituciones';
    if (path === '/admin/cuotas') return 'Cuotas de IA';
    if (path === '/cursos') return 'Mis cursos';
    if (path.startsWith('/cursos/')) return 'Gestión del curso';
    if (path.startsWith('/mundos/')) return 'Ejercicios del mundo';
    if (path.startsWith('/ejercicio')) return 'Editor PSeInt';
    if (path.startsWith('/mundo')) return 'Ejercicios';
    if (path.startsWith('/curso')) return 'Mapa de mundos';
    return 'Centro de misiones';
};

const closeMenu = (sidebar) => {
    sidebar.classList.remove('is-open');
    document.body.classList.remove('menu-open');
};

export function clearChrome({ sidebar, topbar }) {
    clear(sidebar);
    clear(topbar);
    sidebar.hidden = true;
    topbar.hidden = true;
    closeMenu(sidebar);
}

// La carcasa se redibuja al navegar y cuando cambia el progreso del usuario.
export function renderChrome({ sidebar, topbar, currentPath }) {
    clear(sidebar);
    clear(topbar);
    const user = state.user;
    if (!user) return;

    const gami = user.gamification;
    const nav = (NAV_BY_ROLE[user.rol] || []).map((item) => h('a', {
        class: 'side-link',
        href: item.href,
        'aria-current': item.match(currentPath) ? 'page' : null,
        onClick: () => closeMenu(sidebar)
    }, icon(item.icon, 17), h('span', {}, item.label)));

    sidebar.hidden = false;
    topbar.hidden = false;
    sidebar.append(
        h('a', { class: 'side-brand', href: '#/', onClick: () => closeMenu(sidebar) },
            h('span', { class: 'brand-symbol', 'aria-hidden': 'true' }, icon('brand', 30)),
            h('span', {}, 'code', h('strong', {}, 'Int'))),
        h('div', { class: 'side-section' },
            h('span', { class: 'side-label' }, user.rol === 'estudiante' ? 'Campus' : 'Gestión'),
            h('nav', { class: 'side-nav', 'aria-label': 'Principal' }, nav)),
        h('div', { class: 'side-account' },
            h('span', { class: 'account-avatar', 'aria-hidden': 'true' }, (user.nombre || 'U').slice(0, 1).toUpperCase()),
            h('span', { class: 'account-copy' },
                h('strong', {}, user.nombre),
                h('small', {}, ROLE_LABEL[user.rol] || user.rol)))
    );

    const menuButton = h('button', {
        class: 'topbar-menu', type: 'button', 'aria-label': 'Abrir menú', 'aria-expanded': 'false',
        onClick: (event) => {
            const open = !sidebar.classList.contains('is-open');
            sidebar.classList.toggle('is-open', open);
            document.body.classList.toggle('menu-open', open);
            event.currentTarget.setAttribute('aria-expanded', String(open));
        }
    }, icon('menu', 20));

    const themeButton = h('button', {
        class: 'topbar-icon', type: 'button', 'aria-label': 'Cambiar entre tema claro y oscuro',
        onClick: () => { toggleTheme(); }
    }, icon('moon'));

    const logoutButton = h('button', {
        class: 'topbar-icon', type: 'button', 'aria-label': 'Cerrar sesión',
        onClick: () => { logout(); navigate('/login'); }
    }, icon('logout'));

    topbar.append(h('div', { class: 'topbar-inner' },
        menuButton,
        h('div', { class: 'topbar-context' },
            h('span', { class: 'topbar-product' }, 'codeInt'),
            h('strong', {}, titleForPath(currentPath))),
        h('div', { class: 'topbar-actions' },
            gami ? h('span', { class: 'xp-value', title: gami.nombre_nivel },
                `${gami.xp_total} XP`, h('small', {}, `Nivel ${gami.nivel_actual}`)) : null,
            themeButton,
            logoutButton)));
}
