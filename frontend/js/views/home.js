import { h } from '../ui.js';

// Punto de entrada según el rol. El panel del superadministrador se incorpora en la fase de administración.
export default async function homeView(ctx) {
    if (ctx.user.rol === 'estudiante') {
        const { default: dashboard } = await import('./student/dashboard.js');
        return dashboard(ctx);
    }

    if (ctx.user.rol === 'docente') {
        const { default: dashboard } = await import('./teacher/dashboard.js');
        return dashboard(ctx);
    }

    document.title = 'Panel · codeInt';
    const items = ['Gestión de instituciones', 'Aprobación de docentes', 'Monitoreo de tokens de IA'];
    ctx.root.append(h('div', { class: 'container narrow' },
        h('h1', {}, `Hola, ${ctx.user.nombre}`),
        h('div', { class: 'card' },
            h('div', { class: 'alert info' }, 'Esta vista está en construcción. Mientras tanto, estas funciones ya están disponibles por API:'),
            h('ul', {}, items.map((text) => h('li', {}, text))))));
}
