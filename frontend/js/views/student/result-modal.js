import { h, icon, openModal, formatNumber } from '../../ui.js';

export const CATEGORY_LABEL = {
    ninguno: 'Sin errores',
    sintaxis: 'Sintaxis',
    logica: 'Lógica',
    condicion_borde: 'Condición de borde',
    eficiencia: 'Eficiencia',
    formato: 'Formato',
    otro: 'Otro'
};

export const PASS_SCORE = 70;
const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const scoreRing = (score) => {
    const ring = h('div', { class: `score-ring ${score >= PASS_SCORE ? 'pass' : ''}`, style: { '--circ': CIRCUMFERENCE.toFixed(2) } },
        (() => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 100 100');
            svg.setAttribute('aria-hidden', 'true');
            for (const cls of ['track', 'bar']) {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('class', cls);
                circle.setAttribute('cx', '50');
                circle.setAttribute('cy', '50');
                circle.setAttribute('r', String(RADIUS));
                svg.append(circle);
            }
            return svg;
        })(),
        h('div', { class: 'num' }, String(score)));
    ring.setAttribute('role', 'img');
    ring.setAttribute('aria-label', `Puntaje: ${score} de 100`);
    // Se anima después de insertarse en el documento
    requestAnimationFrame(() => requestAnimationFrame(() => {
        const bar = ring.querySelector('.bar');
        if (bar) bar.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - score / 100));
    }));
    return ring;
};

// data: respuesta de POST /ejercicios/:id/envios (o un envío del historial)
export function showEvaluationResult(data, { onUseCode } = {}) {
    const passed = data.puntaje >= PASS_SCORE;
    const content = [];

    content.push(h('div', { class: 'modal-head' },
        scoreRing(data.puntaje),
        h('div', {},
            h('h2', { style: { margin: 0 } }, passed ? '¡Ejercicio aprobado!' : 'Casi lo logras'),
            h('p', { class: 'muted', style: { margin: '4px 0 8px' } },
                passed ? 'Tu solución cumple con lo pedido.' : `Necesitas ${PASS_SCORE} puntos para aprobar. Revisa la retroalimentación y vuelve a intentarlo.`),
            h('div', { class: 'row' },
                h('span', { class: 'chip ai' }, icon('sparkles', 13), 'Evaluado por IA'),
                data.categoria_error ? h('span', { class: 'chip' }, CATEGORY_LABEL[data.categoria_error] || data.categoria_error) : null,
                data.xp_ganada > 0 ? h('span', { class: 'chip xp xp-gain' }, icon('bolt', 13), `+${formatNumber(data.xp_ganada)} XP`) : null))));

    if (data.mundo_completado) {
        content.push(h('div', { class: 'alert success', style: { marginBottom: '12px' } },
            icon('trophy', 18), h('span', {}, '¡Completaste el mundo! El siguiente ya está desbloqueado.')));
    }

    for (const logro of data.logros_desbloqueados || []) {
        content.push(h('div', { class: 'unlock' },
            icon(logro.tipo === 'logro' ? 'trophy' : 'medal', 24),
            h('div', {}, h('strong', {}, `¡${logro.tipo === 'logro' ? 'Nuevo logro' : 'Nueva insignia'}: ${logro.nombre}!`),
                h('div', { class: 'small' }, logro.descripcion))));
    }

    content.push(h('div', { class: 'feedback' }, h('p', {}, data.retroalimentacion)));

    if (Array.isArray(data.sugerencias) && data.sugerencias.length > 0) {
        content.push(h('h3', {}, 'Sugerencias'), h('ul', { class: 'tips' }, data.sugerencias.map((tip) => h('li', {}, tip))));
    }
    if (data.eficiencia_algoritmica) {
        content.push(h('p', { class: 'small muted', style: { marginTop: '12px' } }, h('strong', {}, 'Eficiencia: '), data.eficiencia_algoritmica));
    }

    const closeRef = {};
    if (data.codigo_sugerido_mejora && data.codigo_sugerido_mejora.trim()) {
        content.push(h('h3', { style: { marginTop: '14px' } }, 'Ejemplo de mejora'),
            h('pre', { class: 'code-suggestion' }, data.codigo_sugerido_mejora),
            onUseCode ? h('button', {
                class: 'btn ghost small', type: 'button',
                onClick: () => { onUseCode(data.codigo_sugerido_mejora); closeRef.close(); }
            }, 'Usar en el editor') : null);
    }

    const gami = data.gamificacion;
    if (gami) {
        content.push(h('div', { style: { marginTop: '16px' } },
            h('div', { class: 'row between small' },
                h('strong', {}, `Nivel ${gami.nivel_actual} · ${gami.nombre_nivel}`),
                h('span', { class: 'muted' }, gami.siguiente_nivel ? `${formatNumber(gami.xp_faltante)} XP para ${gami.siguiente_nivel.nombre}` : 'Nivel máximo')),
            h('div', { class: 'progress xp', style: { marginTop: '6px' }, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': gami.porcentaje_progreso, 'aria-label': 'Progreso de nivel' },
                h('span', { style: { '--value': `${gami.porcentaje_progreso}%` } }))));
    }

    const done = h('button', { class: 'btn', type: 'button', onClick: () => closeRef.close() }, 'Continuar');
    content.push(h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '18px' } }, done));

    closeRef.close = openModal(content, { label: 'Resultado de la evaluación' });
    done.focus();
}
