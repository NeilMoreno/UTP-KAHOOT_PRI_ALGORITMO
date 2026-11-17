// Punto de entrada según el rol.
export default async function homeView(ctx) {
    if (ctx.user.rol === 'estudiante') {
        const { default: dashboard } = await import('./student/dashboard.js');
        return dashboard(ctx);
    }

    if (ctx.user.rol === 'docente') {
        const { default: dashboard } = await import('./teacher/dashboard.js');
        return dashboard(ctx);
    }

    const { default: dashboard } = await import('./admin/dashboard.js');
    return dashboard(ctx);
}
