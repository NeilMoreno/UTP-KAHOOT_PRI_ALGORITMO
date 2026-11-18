import { h, icon } from './ui.js';
import { evaluatePassword, passwordStrength, isValidPassword } from './password-policy.js';

// Botón "Mostrar/Ocultar" que alterna el tipo del input sin perder el foco ni el valor.
const visibilityToggle = (input, label) => {
    const button = h('button', { class: 'pw-toggle', type: 'button', 'aria-pressed': 'false', 'aria-label': `Mostrar ${label}` }, 'Mostrar');
    button.addEventListener('click', () => {
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        button.textContent = visible ? 'Ocultar' : 'Mostrar';
        button.setAttribute('aria-pressed', visible ? 'true' : 'false');
        button.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} ${label}`);
    });
    return button;
};

/**
 * Campo de contraseña nueva con checklist de requisitos en vivo y barra de fortaleza.
 * `getContext()` entrega { email, nombre, apellido } para la regla de datos personales.
 * Devuelve { element, input, isValid(), refresh() }.
 */
export function createPasswordField({ id, label = 'Contraseña', getContext = () => ({}), onChange, autocomplete = 'new-password' } = {}) {
    const input = h('input', {
        class: 'input', id, type: 'password', autocomplete, required: true,
        'aria-describedby': `${id}-rules ${id}-meter`, autocapitalize: 'off', spellcheck: 'false'
    });
    const rulesHost = h('ul', { class: 'pw-rules', id: `${id}-rules`, 'aria-label': 'Requisitos de la contraseña' });
    const bars = [1, 2, 3, 4].map(() => h('i'));
    const strengthLabel = h('span', { class: 'pw-strength-label' });
    const meter = h('div', { class: 'pw-meter', id: `${id}-meter` },
        h('div', { class: 'pw-bars', 'aria-hidden': 'true' }, bars), strengthLabel);
    const status = h('p', { class: 'sr-only', 'aria-live': 'polite' });
    let lastAnnounced = '';

    // `render` solo pinta; `refresh` pinta y avisa a quien usa el campo (no se avisa en el primer pintado).
    const render = () => {
        const context = getContext() || {};
        const results = evaluatePassword(input.value, context).filter((rule) => !rule.hidden);
        const typed = input.value.length > 0;
        rulesHost.replaceChildren(...results.map((rule) => h('li', { class: `pw-rule${rule.ok && typed ? ' is-ok' : ''}${!rule.ok && typed ? ' is-pending' : ''}` },
            h('span', { class: 'pw-mark', 'aria-hidden': 'true' }, rule.ok && typed ? icon('check', 12) : null),
            h('span', {}, rule.text),
            h('span', { class: 'sr-only' }, rule.ok && typed ? ' (cumplido)' : ' (pendiente)'))));

        const { score, label: level } = passwordStrength(input.value, context);
        bars.forEach((bar, index) => { bar.className = index < score ? `on level-${score}` : ''; });
        meter.hidden = score === 0;
        strengthLabel.textContent = level ? `Fortaleza: ${level}` : '';

        // Se anuncia solo cuando cambia el resumen, no en cada tecla.
        const done = results.filter((rule) => rule.ok).length;
        const summary = typed ? `${done} de ${results.length} requisitos cumplidos` : '';
        if (summary !== lastAnnounced) { status.textContent = summary; lastAnnounced = summary; }
    };
    const refresh = () => { render(); if (onChange) onChange(); };

    input.addEventListener('input', refresh);
    const element = h('div', { class: 'field pw-field' },
        h('label', { for: id }, label),
        h('div', { class: 'pw-input' }, input, visibilityToggle(input, label.toLowerCase())),
        meter, rulesHost, status);
    render();

    return { element, input, isValid: () => isValidPassword(input.value, getContext() || {}), refresh };
}

/** Campo "repite la contraseña" con aviso de coincidencia. Devuelve { element, input, matches() }. */
export function createPasswordConfirm({ id, label = 'Repite la contraseña', primary, onChange } = {}) {
    const input = h('input', {
        class: 'input', id, type: 'password', autocomplete: 'new-password', required: true,
        'aria-describedby': `${id}-match`, autocapitalize: 'off', spellcheck: 'false'
    });
    const message = h('p', { class: 'pw-match', id: `${id}-match`, 'aria-live': 'polite' });
    const matches = () => input.value.length > 0 && input.value === primary.value;

    const refresh = () => {
        const typed = input.value.length > 0;
        message.className = `pw-match${typed ? (matches() ? ' is-ok' : ' is-pending') : ''}`;
        message.textContent = !typed ? '' : (matches() ? 'Las contraseñas coinciden' : 'Todavía no coinciden');
        if (onChange) onChange();
    };
    input.addEventListener('input', refresh);
    primary.addEventListener('input', refresh);

    const element = h('div', { class: 'field pw-field' },
        h('label', { for: id }, label),
        h('div', { class: 'pw-input' }, input, visibilityToggle(input, label.toLowerCase())),
        message);
    return { element, input, matches, refresh };
}
