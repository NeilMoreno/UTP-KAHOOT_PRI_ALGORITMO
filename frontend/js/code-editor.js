// Editor de código: <textarea> transparente sobre una capa resaltada (sin dependencias).
// Sirve para todos los lenguajes del curso (ver languages.js). El resaltado se construye con nodos DOM
// (nunca innerHTML), así que el código del estudiante no puede inyectar HTML.
import { h } from './ui.js';
import { getLanguage } from './languages.js';

const norm = (word) => word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

// Cadena que empieza con la comilla `q` (cadenas sin cerrar incluidas: se resalta mientras se escribe).
const quotePattern = (q) => {
    const quoted = escapeRegex(q);
    return `${quoted}(?:[^${quoted}\\\\]|\\\\.)*${quoted}?`;
};
const NUMBER = String.raw`\d+(?:\.\d+)?`;
const OPERATOR = String.raw`<-|<=|>=|<>|==|!=|&&|\|\||[+\-*/^=<>&|~!%]`;

// Un resaltador por lenguaje (se arma una sola vez y se reutiliza).
const highlighters = new Map();
const highlighterFor = (language) => {
    if (highlighters.has(language.id)) return highlighters.get(language.id);
    const cfg = language.highlight;
    const stringPattern = cfg.strings.map(quotePattern).join('|');
    const start = cfg.wordStart || 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ_';
    const token = new RegExp(
        `(${cfg.comment})|(${stringPattern})|(${NUMBER})|([${start}][${start}0-9]*)|(${OPERATOR})`,
        'g'
    );
    const fold = (word) => (cfg.caseInsensitive ? norm(word) : word);

    const highlightLine = (line) => {
        const fragment = document.createDocumentFragment();
        let last = 0;
        token.lastIndex = 0;
        let match;
        while ((match = token.exec(line)) !== null) {
            if (match.index > last) fragment.append(line.slice(last, match.index));
            const [text, comment, string, number, word, operator] = match;
            let cls = null;
            if (comment) cls = 'tok-com';
            else if (string) cls = 'tok-str';
            else if (number) cls = 'tok-num';
            else if (operator) cls = 'tok-op';
            else if (word) {
                const key = fold(word);
                if (cfg.keywords.has(key)) cls = 'tok-kw';
                else if (cfg.types.has(key)) cls = 'tok-type';
                else if (cfg.functions.has(key)) cls = 'tok-fn';
            }
            fragment.append(cls ? h('span', { class: cls }, text) : text);
            last = match.index + text.length;
        }
        if (last < line.length) fragment.append(line.slice(last));
        return fragment;
    };
    highlighters.set(language.id, highlightLine);
    return highlightLine;
};

export function createCodeEditor({ language = 'pseint', value = '', label, describedBy, onChange } = {}) {
    const lang = getLanguage(language);
    const highlightLine = highlighterFor(lang);
    const editorLabel = label || `Editor de código ${lang.nombre}`;
    const gutter = h('div', { class: 'editor-gutter', 'aria-hidden': 'true' });
    const highlight = h('pre', { class: 'editor-highlight', 'aria-hidden': 'true' });
    const input = h('textarea', {
        class: 'editor-input', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
        wrap: 'off', 'aria-label': editorLabel, 'aria-describedby': describedBy, maxlength: 12000
    });
    const element = h('div', { class: 'editor' }, gutter, h('div', { class: 'editor-main' }, highlight, input));

    let markers = new Map(); // línea -> 'err' | 'warn'
    let frame = 0;
    let escapeArmed = false;

    const render = () => {
        frame = 0;
        const lines = input.value.split('\n');
        const code = document.createDocumentFragment();
        const numbers = document.createDocumentFragment();
        lines.forEach((line, index) => {
            const marker = markers.get(index + 1);
            const row = h('div', { class: `ln${marker ? ` ${marker}` : ''}` });
            row.append(highlightLine(line));
            if (line === '') row.append('​');
            code.append(row);
            numbers.append(h('div', { class: marker || null }, index + 1));
        });
        highlight.replaceChildren(code);
        gutter.replaceChildren(numbers);
        syncScroll();
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };

    function syncScroll() {
        highlight.scrollTop = input.scrollTop;
        highlight.scrollLeft = input.scrollLeft;
        gutter.scrollTop = input.scrollTop;
    }

    const insert = (text) => {
        input.focus();
        if (!document.execCommand || !document.execCommand('insertText', false, text)) {
            input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    input.addEventListener('input', () => {
        if (markers.size > 0) markers = new Map(); // los marcadores quedan desactualizados al editar
        schedule();
        if (onChange) onChange(input.value);
    });
    input.addEventListener('scroll', syncScroll);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { escapeArmed = true; return; }
        if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !escapeArmed) {
            event.preventDefault();
            insert(lang.indent); // la sangría depende del lenguaje (2 o 4 espacios)
            return;
        }
        if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
            const start = input.selectionStart;
            const lineStart = input.value.lastIndexOf('\n', start - 1) + 1;
            const indent = /^[ \t]*/.exec(input.value.slice(lineStart, start))[0];
            event.preventDefault();
            insert(`\n${indent}`);
            return;
        }
        escapeArmed = false;
    });

    input.value = value;
    render();

    return {
        element,
        input,
        getValue: () => input.value,
        setValue(text) {
            input.value = text;
            markers = new Map();
            render();
            if (onChange) onChange(text);
        },
        // errors/warnings: [{ line, message }]
        setMarkers(errors = [], warnings = []) {
            markers = new Map();
            for (const item of warnings) if (item.line) markers.set(item.line, 'warn');
            for (const item of errors) if (item.line) markers.set(item.line, 'err');
            render();
        },
        focus: () => input.focus()
    };
}
