import { h, icon, toast, errorMessage, setBusy } from '../../ui.js';
import { api } from '../../api.js';
import { state } from '../../state.js';
import { createAvatar, getAvatarChoice, saveAvatarChoice, className } from '../../characters.js';
import { CLASES, LAYERS, isUnlocked, presetFor, randomAvatar } from '../../avatar-parts.js';

export default async function charactersView({ root }) {
    document.title = 'Mi avatar · codeInt';
    const level = state.user?.rol === 'estudiante' ? Number(state.user?.gamification?.nivel_actual) || 1 : 1;
    // Piezas ganadas con misiones: se pueden usar aunque el nivel no alcance.
    const earned = new Set();
    if (state.user?.rol === 'estudiante') {
        try {
            const { desbloqueos } = await api('/gamificacion/misiones');
            desbloqueos.forEach((piece) => earned.add(`${piece.capa}:${piece.id}`));
        } catch { /* sin misiones: solo cuenta el nivel */ }
    }
    const available = (key, id) => isUnlocked(key, id, level) || earned.has(`${key}:${id}`);
    const saved = getAvatarChoice();
    let draft = { ...saved };
    let tab = 'clase';
    const content = h('div');

    const same = (a, b) => LAYERS.every((layer) => a[layer.key] === b[layer.key]);

    const choose = (key, id) => {
        if (key === 'clase') draft = { ...presetFor(id) }; // cambiar de clase carga su preset completo
        else draft = { ...draft, [key]: id };
        render();
    };

    const option = (layer, item) => {
        const unlocked = available(layer.key, item.id);
        const selected = draft[layer.key] === item.id;
        const face = layer.swatch
            ? h('span', { class: 'part-swatch', style: { background: item.color }, 'aria-hidden': 'true' })
            : createAvatar(layer.key === 'clase' ? presetFor(item.id) : { ...draft, [layer.key]: item.id }, { size: 56, label: '' });
        return h('button', {
            class: `part${selected ? ' is-active' : ''}${unlocked ? '' : ' is-locked'}`, type: 'button',
            'aria-pressed': selected ? 'true' : 'false', 'aria-disabled': unlocked ? null : 'true',
            title: unlocked ? item.nombre : `${item.nombre}: se desbloquea en el nivel ${item.nivel} o con una misión`,
            onClick: () => {
                if (!unlocked) { toast(`${item.nombre} se desbloquea en el nivel ${item.nivel}.`, 'info'); return; }
                choose(layer.key, item.id);
            }
        }, face,
        h('span', { class: 'part-name' }, item.nombre),
        unlocked ? null : h('span', { class: 'part-lock' }, icon('lock', 12), `Nivel ${item.nivel}`));
    };

    const render = () => {
        const dirty = !same(draft, saved);
        const layer = LAYERS.find((item) => item.key === tab);
        const clase = CLASES.find((item) => item.id === draft.clase) || CLASES[0];

        const stage = h('section', { class: 'avatar-stage card' },
            h('div', { class: 'avatar-stage-art' }, createAvatar(draft, { size: 220, label: `Vista previa: ${className(draft.clase)}` })),
            h('div', { class: 'avatar-stage-copy' },
                h('span', { class: 'character-trait' }, `Nivel ${level}`),
                h('h2', {}, clase.nombre),
                h('p', {}, clase.descripcion),
                h('div', { class: 'avatar-actions' },
                    h('button', { class: 'btn secondary', type: 'button', onClick: () => { draft = randomAvatar(level); render(); } }, icon('sparkles', 16), 'Aleatorio'),
                    h('button', { class: 'btn secondary', type: 'button', onClick: () => { draft = presetFor(draft.clase); render(); } }, 'Reiniciar clase'),
                    h('button', {
                        class: 'btn', type: 'button', disabled: !dirty,
                        onClick: async (event) => {
                            const button = event.currentTarget;
                            setBusy(button, true, 'Guardando…');
                            try {
                                Object.assign(saved, await saveAvatarChoice(draft));
                                draft = { ...saved };
                                toast('Avatar guardado.', 'success');
                            } catch (error) {
                                toast(errorMessage(error), 'error');
                            }
                            render();
                        }
                    }, 'Guardar avatar'))));

        const tabs = h('div', { class: 'avatar-tabs', role: 'tablist', 'aria-label': 'Capas del avatar' },
            LAYERS.map((item) => h('button', {
                class: item.key === tab ? 'is-active' : '', type: 'button', role: 'tab', id: `tab-${item.key}`,
                'aria-selected': item.key === tab ? 'true' : 'false', 'aria-controls': 'avatar-panel',
                onClick: () => { tab = item.key; render(); }
            }, item.label)));

        const unlockedCount = layer.items.filter((item) => available(layer.key, item.id)).length;
        const panel = h('div', { class: 'part-panel card', id: 'avatar-panel', role: 'tabpanel', 'aria-labelledby': `tab-${tab}` },
            h('p', { class: 'muted small' }, layer.key === 'clase'
                ? 'Elegir una clase carga su personaje base; luego puedes cambiar cada capa.'
                : `${unlockedCount} de ${layer.items.length} opciones desbloqueadas. Sube de nivel o completa misiones para conseguir más.`),
            h('div', { class: `part-grid${layer.swatch ? ' is-swatch' : ''}` }, layer.items.map((item) => option(layer, item))));

        content.replaceChildren(
            h('div', { class: 'page-title' },
                h('div', {}, h('h1', {}, 'Mi avatar'), h('p', {}, 'Elige tu clase y personalízala capa por capa. Se ve en las salas, el ranking y tu perfil; no cambia tus puntos.'))),
            stage, tabs, panel);
    };

    root.append(h('div', { class: 'container character-page' }, content));
    render();
}
