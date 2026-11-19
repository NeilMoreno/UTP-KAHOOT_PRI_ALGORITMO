// Panel de los ejercicios que se corrigen sin IA: predecir la salida, completar huecos y ordenar líneas.
// (Corregir código usa el editor normal.) Devuelve { element, getAnswer, isComplete }.
import { h, icon } from '../../ui.js';

const codeBlock = (code) => h('pre', { class: 'typed-code', tabindex: '0', 'aria-label': 'Código del ejercicio' }, code);

const predictPanel = (material) => {
    const input = h('input', {
        class: 'input', type: 'text', id: 'typed-answer', maxlength: 500, autocomplete: 'off',
        placeholder: 'Escribe exactamente lo que muestra el programa'
    });
    return {
        element: h('div', { class: 'stack' },
            codeBlock(material.codigo),
            h('div', { class: 'field' }, h('label', { for: 'typed-answer' }, material.pregunta || '¿Qué muestra este programa?'), input)),
        getAnswer: () => input.value,
        isComplete: () => input.value.trim().length > 0
    };
};

const fillPanel = (material) => {
    const parts = material.codigo.split('___');
    const inputs = [];
    const pre = h('pre', { class: 'typed-code typed-fill' });
    parts.forEach((part, index) => {
        pre.append(part);
        if (index < parts.length - 1) {
            const input = h('input', {
                class: 'typed-blank', type: 'text', maxlength: 100, autocomplete: 'off', spellcheck: 'false',
                'aria-label': `Hueco ${index + 1} de ${parts.length - 1}`, size: 8
            });
            inputs.push(input);
            pre.append(input);
        }
    });
    return {
        element: h('div', { class: 'stack' }, pre, h('p', { class: 'hint' }, 'Rellena cada hueco con la palabra o expresión que falta.')),
        getAnswer: () => inputs.map((input) => input.value),
        isComplete: () => inputs.every((input) => input.value.trim().length > 0)
    };
};

const orderPanel = (material) => {
    const lines = [...material.lineas];
    const list = h('ol', { class: 'typed-order' });
    let status;
    const move = (from, to) => {
        if (to < 0 || to >= lines.length) return;
        [lines[from], lines[to]] = [lines[to], lines[from]];
        draw(to);
        status.textContent = `Línea movida a la posición ${to + 1} de ${lines.length}.`;
    };
    const draw = (focusIndex) => {
        list.replaceChildren(...lines.map((line, index) => h('li', { class: 'typed-order-item' },
            h('pre', { class: 'typed-line' }, line),
            h('span', { class: 'typed-order-actions' },
                h('button', { class: 'btn ghost small', type: 'button', 'aria-label': `Subir la línea ${index + 1}`, disabled: index === 0, onClick: () => move(index, index - 1) }, '↑'),
                h('button', { class: 'btn ghost small', type: 'button', 'aria-label': `Bajar la línea ${index + 1}`, disabled: index === lines.length - 1, onClick: () => move(index, index + 1) }, '↓')))));
        if (focusIndex !== undefined) {
            const buttons = list.children[focusIndex]?.querySelectorAll('button:not([disabled])');
            buttons?.[0]?.focus();
        }
    };
    status = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    draw();
    return {
        element: h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'Usa las flechas para poner las líneas en el orden en que se ejecutan.'), list, status),
        getAnswer: () => [...lines],
        isComplete: () => true
    };
};

export const createTypedPanel = (exercise) => {
    const material = exercise.material || {};
    if (exercise.tipo === 'predecir') return predictPanel(material);
    if (exercise.tipo === 'completar') return fillPanel(material);
    return orderPanel(material);
};

export const TYPE_LABEL = {
    escribir: 'Escribir código',
    predecir: 'Predecir la salida',
    completar: 'Completar el código',
    ordenar: 'Ordenar las líneas',
    corregir: 'Corregir el código'
};
