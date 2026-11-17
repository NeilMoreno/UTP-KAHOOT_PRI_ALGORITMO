const STORAGE_KEY = 'codeint.character';

export const CHARACTERS = [
    { name: 'Debugger', trait: 'Diagnóstico', description: 'Detecta fallos y encuentra la causa del error.', accent: '#65D9FF', suit: '#235AAE', skin: '#BB7858', hair: '#273558' },
    { name: 'Algorithm Master', trait: 'Estrategia', description: 'Divide problemas y diseña soluciones paso a paso.', accent: '#F4C95D', suit: '#8F5429', skin: '#E7AF7F', hair: '#3B223A' },
    { name: 'Data Ranger', trait: 'Exploración', description: 'Organiza datos y reconoce patrones útiles.', accent: '#55D9A9', suit: '#176F5D', skin: '#935A44', hair: '#182F37' },
    { name: 'Logic Knight', trait: 'Razonamiento', description: 'Domina las condiciones y protege cada decisión.', accent: '#8DA6FF', suit: '#315AA6', skin: '#F0BF9B', hair: '#6A3E2F' },
    { name: 'Code Ninja', trait: 'Precisión', description: 'Refactoriza y resuelve retos con precisión.', accent: '#F18AB8', suit: '#92245F', skin: '#C98966', hair: '#34313D' },
    { name: 'AI Mage', trait: 'Experimentación', description: 'Evalúa respuestas y aprende de cada intento.', accent: '#85C7F2', suit: '#286B8E', skin: '#A4674C', hair: '#3B3E4A' }
];

const safeChoice = (value) => ({
    index: Number.isInteger(value?.index) && value.index >= 0 && value.index < CHARACTERS.length ? value.index : 0,
    form: value?.form === 1 ? 1 : 0
});

export const getCharacterChoice = () => {
    try { return safeChoice(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return safeChoice(null); }
};

export const saveCharacterChoice = (choice) => {
    const safe = safeChoice(choice);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(safe)); } catch { /* almacenamiento bloqueado */ }
    window.dispatchEvent(new CustomEvent('character:updated', { detail: safe }));
    return safe;
};

export const editionLabel = (form) => (form === 1 ? 'Femenino' : 'Masculino');

let avatarId = 0;

// Ilustraciones vectoriales derivadas del prototipo aportado por el usuario.
// Se usan rellenos planos para mantener legibilidad y rendimiento en la aplicación real.
export function createAvatar(index = 0, form = 0, className = '') {
    const character = CHARACTERS[index] || CHARACTERS[0];
    const female = form === 1;
    const id = `avatar-${avatarId += 1}`;
    const { accent, suit, skin, hair, name } = character;
    const accessory = [
        `<path d="M49 183h44l-4 44H53z" fill="#142A46" stroke="${accent}" stroke-width="3"/><path d="M61 198h21M61 209h15" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`,
        `<path d="M217 164l20 13v33l-20 12-20-12v-33z" fill="#55351F" stroke="${accent}" stroke-width="3"/><path d="M217 176v34m-11-23 22 13m0-13-22 13" stroke="${accent}" stroke-width="2"/>`,
        `<path d="M208 176l41-7 9 42-46 10z" fill="#102B30" stroke="${accent}" stroke-width="3"/><path d="M221 205v-13m9 10v-19m9 16v-24" stroke="${accent}" stroke-width="3"/>`,
        `<path d="M207 177h55v44l-27 22-28-22z" fill="${suit}" stroke="${accent}" stroke-width="3"/><path d="M220 207l10 10 18-21" fill="none" stroke="#F4F7FF" stroke-width="4" stroke-linecap="round"/>`,
        `<path d="M213 223l36-61 8 5-36 62z" fill="#45203D" stroke="${accent}" stroke-width="3"/><path d="M249 163l12-20 7 4-11 20z" fill="#F5CEE2"/>`,
        `<path d="M239 258V134" stroke="${accent}" stroke-width="7" stroke-linecap="round"/><path d="M239 112l19 27-19 19-19-19z" fill="${suit}" stroke="${accent}" stroke-width="3"/><circle cx="239" cy="135" r="8" fill="#F5E9FF"/>`
    ][index] || '';

    const crest = [
        `<path d="M139 190h32v29h-32zM132 198h7m32 0h7m-46 13h7m32 0h7" fill="none" stroke="${accent}" stroke-width="3"/>`,
        `<path d="M155 190l15 15-15 15-15-15z" fill="none" stroke="${accent}" stroke-width="3"/>`,
        `<path d="M138 207l17-15 17 15-17 15zM155 193v28" fill="none" stroke="${accent}" stroke-width="3"/>`,
        `<path d="M141 192h28v17l-14 12-14-12zM147 206l6 6 10-12" fill="none" stroke="${accent}" stroke-width="3"/>`,
        `<path d="M144 196l-9 9 9 9m22-18 9 9-9 9m-5-20-12 22" fill="none" stroke="${accent}" stroke-width="3"/>`,
        `<path d="M155 188l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="${accent}"/>`
    ][index] || '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 310 300');
    svg.setAttribute('class', `character-avatar ${className}`.trim());
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${name}, versión ${editionLabel(form).toLowerCase()}`);
    svg.dataset.avatarId = id;
    svg.innerHTML = `
        <circle cx="155" cy="146" r="124" fill="${suit}" opacity=".16"/>
        <circle cx="155" cy="147" r="105" fill="none" stroke="${accent}" stroke-width="2" opacity=".34" stroke-dasharray="5 9"/>
        <ellipse cx="155" cy="277" rx="88" ry="8" fill="${accent}" opacity=".25"/>
        <path d="M117 227h76l17 35-6 12h-35l-14-32-14 32h-35l-6-12z" fill="${suit}" stroke="${accent}" stroke-width="3"/>
        <path d="M117 158h76l23 27-14 51q-47 20-94 0l-14-51z" fill="${suit}" stroke="${accent}" stroke-width="3"/>
        <path d="M112 162 83 172l-13 39 16 15 20-12 12-39m80-13 29 10 13 39-16 15-20-12-12-39" fill="${accent}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M119 180l36 11 36-11-7 43-29 12-29-12z" fill="#161A2C"/>
        ${crest}
        ${female
            ? `<path d="M110 89q16-37 45-33 49-2 54 39l4 43 14 30q-31 13-50-11l-47 2q-14 19-40 11l15-33z" fill="${hair}" stroke="#19151F" stroke-width="3"/>`
            : `<path d="M105 112q-15-49 40-53l21-9 7 10q40 5 36 52l-16 24h-77z" fill="${hair}" stroke="#19151F" stroke-width="3"/>`}
        <path d="M112 101q8-19 40-20 34 0 46 18v27q-5 41-43 48-38-7-43-48z" fill="${skin}" stroke="#382738" stroke-width="3"/>
        ${female
            ? `<path d="M110 114q-8-34 18-42 36-17 64 6 14 11 11 33-26-4-42-24-21 22-51 27z" fill="${hair}"/>`
            : `<path d="M109 110q-10-28 9-37 25-15 63-6 29 6 22 42-17-8-32-22-19 18-39 17l7-9q-12 11-30 15z" fill="${hair}"/>`}
        <ellipse cx="135" cy="122" rx="5" ry="6" fill="#171421"/><ellipse cx="176" cy="122" rx="5" ry="6" fill="#171421"/>
        <circle cx="136" cy="120" r="1.8" fill="#fff"/><circle cx="177" cy="120" r="1.8" fill="#fff"/>
        <path d="M148 145q7 6 14 0" fill="none" stroke="#502E40" stroke-width="2.5" stroke-linecap="round"/>
        ${accessory}`;
    return svg;
}
