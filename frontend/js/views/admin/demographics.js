import { h, skeleton, errorMessage, formatNumber } from '../../ui.js';
import { api } from '../../api.js';

// Panel "Perfil demográfico": conteos agregados de estudiantes por rango de edad y género.
// El servidor ya oculta los grupos de menos de 5 personas; aquí solo se dibuja lo que llega.
const row = (range, max, minimum) => {
    const hidden = range.oculto;
    const percent = !hidden && max > 0 ? Math.round((range.total / max) * 100) : 0;
    const split = hidden
        ? 'Grupo pequeño'
        : (range.total === 0 ? '' : range.por_genero ? `Femenino ${formatNumber(range.por_genero.femenino)} · Masculino ${formatNumber(range.por_genero.masculino)}` : (range.total > 0 ? 'Desglose por género oculto' : ''));
    return h('li', { class: `demo-row${hidden ? ' is-hidden' : ''}` },
        h('span', { class: 'demo-label' }, range.label),
        h('div', { class: 'demo-bar', role: 'img', 'aria-label': `${range.label}: ${hidden ? `menos de ${minimum}` : formatNumber(range.total)} estudiantes` },
            h('span', { style: { '--value': `${percent}%` } })),
        h('strong', { class: 'demo-value' }, hidden ? `<${minimum}` : formatNumber(range.total)),
        h('small', { class: 'demo-split' }, split));
};

export function demographicsPanel() {
    const body = h('div', {}, skeleton(160));
    const select = h('select', { class: 'input', id: 'demo-institucion', 'aria-label': 'Filtrar por institución', style: { maxWidth: '260px' } },
        h('option', { value: '' }, 'Todas las instituciones'));

    const load = async () => {
        body.replaceChildren(skeleton(160));
        try {
            const query = select.value ? `?id_institucion=${encodeURIComponent(select.value)}` : '';
            const data = await api(`/analiticas/demografia${query}`);
            const visible = data.rangos.filter((range) => !range.oculto).map((range) => range.total);
            const max = Math.max(0, ...visible);
            body.replaceChildren(
                data.total === null
                    ? h('p', { class: 'muted small' }, 'El total general no se muestra mientras haya grupos ocultos, para que no pueda deducirse su tamaño.')
                    : h('p', { class: 'muted' }, `${formatNumber(data.total)} estudiantes activos`),
                h('ul', { class: 'demo-list' }, data.rangos.map((range) => row(range, max, data.grupo_minimo))),
                h('p', { class: 'small muted' }, data.nota));
        } catch (error) {
            body.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
        }
    };

    api('/auth/admin/instituciones').then((response) => {
        for (const institution of response.data || []) {
            select.append(h('option', { value: institution.id_institucion }, institution.nombre));
        }
    }).catch(() => { /* el filtro es opcional */ });
    select.addEventListener('change', load);
    load();

    return h('section', { class: 'section-block', 'aria-label': 'Perfil demográfico' },
        h('div', { class: 'section-heading' },
            h('h2', {}, 'Perfil demográfico'),
            h('span', { class: 'muted small' }, 'Estudiantes por edad y género (agregado)')),
        select, body);
}
