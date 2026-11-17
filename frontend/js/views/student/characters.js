import { h, toast } from '../../ui.js';
import { CHARACTERS, createAvatar, editionLabel, getCharacterChoice, saveCharacterChoice } from '../../characters.js';

export default async function charactersView({ root }) {
    document.title = 'Personajes · codeInt';
    let choice = getCharacterChoice();
    let previewForm = choice.form;
    const content = h('div');

    const render = () => {
        const versionButtons = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Versión del personaje' },
            [0, 1].map((form) => h('button', {
                class: form === previewForm ? 'is-active' : '', type: 'button',
                'aria-pressed': form === previewForm ? 'true' : 'false',
                onClick: () => { previewForm = form; render(); }
            }, editionLabel(form))));

        const roster = h('div', { class: 'character-grid' }, CHARACTERS.map((character, index) => {
            const selected = choice.index === index && choice.form === previewForm;
            return h('article', { class: `character-card${selected ? ' is-selected' : ''}` },
                h('div', { class: 'character-portrait', style: { '--character-accent': character.accent } }, createAvatar(index, previewForm)),
                h('div', { class: 'character-copy' },
                    h('h2', {}, character.name),
                    h('span', { class: 'character-trait' }, character.trait),
                    h('p', {}, character.description)),
                h('button', {
                    class: selected ? 'btn secondary block' : 'btn block', type: 'button',
                    'aria-pressed': selected ? 'true' : 'false',
                    onClick: () => {
                        choice = saveCharacterChoice({ index, form: previewForm });
                        toast(`${character.name} es ahora tu personaje.`, 'success');
                        render();
                    }
                }, selected ? 'Personaje activo' : `Elegir ${character.name}`));
        }));

        content.replaceChildren(
            h('div', { class: 'page-title' },
                h('div', {}, h('h1', {}, 'Personajes'), h('p', {}, 'Tu elección es visual: no cambia tus puntos, nivel ni resultados.')),
                versionButtons),
            roster);
    };

    root.append(h('div', { class: 'container character-page' }, content));
    render();
}
