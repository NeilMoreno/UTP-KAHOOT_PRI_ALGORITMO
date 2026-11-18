import { h, icon } from '../ui.js';
import { state, toggleTheme } from '../state.js';
import { navigate } from '../router.js';
import { createAvatar } from '../characters.js';
import { CLASES, PRESETS } from '../avatar-parts.js';

export const PENDING_PIN_KEY = 'codeint.pendingPin';

const STEPS = [
    { icon: 'bolt', title: 'Aprende', text: 'Resuelve retos de PSeInt por mundos y recibe retroalimentación al instante.' },
    { icon: 'play', title: 'Juega', text: 'Entra a las salas en vivo de tu docente con un PIN y compite con tu curso.' },
    { icon: 'trophy', title: 'Sube de nivel', text: 'Gana XP, mantén tu racha y desbloquea piezas para tu avatar.' }
];

// Texto fijo que "teclea" la terminal del héroe (nada dinámico: se escribe con textContent).
const TYPED_LINES = [
    'Algoritmo promedio',
    '  Leer nota1, nota2, nota3',
    '  p <- (nota1 + nota2 + nota3) / 3',
    '  Escribir "Tu promedio es ", p',
    'FinAlgoritmo'
];
const TYPED_RESULT = '✓ ejercicio aprobado   +50 XP   🔥 racha: 4 días';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Escribe el código carácter a carácter. Devuelve la función que detiene la animación.
const startTyping = (codeNode, resultNode) => {
    const full = TYPED_LINES.join('\n');
    if (reducedMotion()) {
        codeNode.textContent = full;
        resultNode.textContent = TYPED_RESULT;
        resultNode.hidden = false;
        return () => {};
    }
    let index = 0;
    let timer = null;
    const tick = () => {
        index += 1;
        codeNode.textContent = full.slice(0, index);
        if (index < full.length) {
            timer = setTimeout(tick, full[index - 1] === '\n' ? 260 : 38);
        } else {
            timer = setTimeout(() => { resultNode.textContent = TYPED_RESULT; resultNode.hidden = false; }, 450);
        }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
};

const previewCards = () => h('div', { class: 'landing-preview-grid', 'aria-hidden': 'true' },
    h('article', { class: 'preview-card' },
        h('small', {}, 'Sala en vivo · 1 de 5'),
        h('strong', {}, '¿Qué instrucción lee un dato?'),
        h('div', { class: 'preview-answers' },
            ['Leer', 'Escribir', 'Definir', 'Dimension'].map((text, i) => h('span', { class: `preview-answer ${'abcd'[i]}` }, text)))),
    h('article', { class: 'preview-card' },
        h('small', {}, 'Tu racha'),
        h('strong', { class: 'preview-streak' }, icon('bolt', 20), '4 días seguidos'),
        h('div', { class: 'preview-week' },
            [1, 1, 1, 0, 1, 1, 1].map((done) => h('i', { class: done ? 'is-done' : '' })))),
    h('article', { class: 'preview-card' },
        h('small', {}, 'Ranking del curso'),
        h('ol', { class: 'preview-ranking' },
            [['hacker', 'Ana T.', 1280], ['vibecoder', 'Luis R.', 1105], ['devops', 'Tú', 980]].map(([clase, name, xp], i) =>
                h('li', { class: i === 2 ? 'is-me' : '' },
                    h('b', {}, String(i + 1)), createAvatar(PRESETS[clase], { size: 30, label: '' }),
                    h('span', {}, name), h('em', {}, `${xp} XP`))))));

export default function landingView({ root }) {
    document.title = 'codeInt · Aprende algoritmos jugando';

    const errorBox = h('div', { role: 'alert', hidden: true });
    const pinInput = h('input', {
        class: 'input pin-input', id: 'landing-pin', type: 'text', inputmode: 'numeric', autocomplete: 'off',
        maxlength: 6, placeholder: '000000', 'aria-label': 'PIN de 6 dígitos de la sala',
        onInput: (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6); }
    });

    const joinWithPin = (event) => {
        event.preventDefault();
        const pin = pinInput.value.trim();
        if (!/^\d{6}$/.test(pin)) {
            errorBox.className = 'alert error';
            errorBox.hidden = false;
            errorBox.textContent = 'El PIN debe tener exactamente 6 dígitos.';
            return;
        }
        if (state.user) return navigate(`/jugar/${pin}`);
        try { sessionStorage.setItem(PENDING_PIN_KEY, pin); } catch { /* almacenamiento bloqueado */ }
        navigate('/login');
    };

    const codeNode = h('code', {});
    const resultNode = h('p', { class: 'terminal-result', hidden: true });
    const terminal = h('div', { class: 'auth-terminal landing-terminal', 'aria-label': 'Ejemplo de ejercicio de PSeInt', role: 'img' },
        h('div', { class: 'terminal-bar' }, h('i'), h('i'), h('i'), h('span', {}, 'ejercicio.psc')),
        h('pre', { 'aria-hidden': 'true' }, codeNode, h('span', { class: 'terminal-cursor' }, '▌')),
        resultNode);

    const cast = h('div', { class: 'landing-cast', 'aria-hidden': 'true' },
        CLASES.map((clase, index) => h('div', { class: 'landing-hero-avatar', style: { '--delay': `${index * 0.35}s` } },
            createAvatar(PRESETS[clase.id], { size: 84, label: '' }), h('span', {}, clase.nombre))));

    root.append(h('div', { class: 'landing' },
        h('div', { class: 'landing-stars', 'aria-hidden': 'true' }),
        h('header', { class: 'landing-bar' },
            h('a', { class: 'landing-brand', href: '#/inicio', 'aria-label': 'codeInt, inicio' },
                h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'ci'), h('span', {}, 'code', h('strong', {}, 'Int'))),
            h('nav', { class: 'landing-actions', 'aria-label': 'Acceso' },
                h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Cambiar tema claro u oscuro', onClick: toggleTheme }, icon('sparkles', 15)),
                h('a', { class: 'btn secondary small', href: '#/registro' }, 'Tengo invitación'),
                h('a', { class: 'btn small', href: '#/login' }, 'Entrar'))),

        h('main', { class: 'landing-main', id: 'landing-main' },
            h('section', { class: 'landing-hero' },
                h('div', { class: 'landing-copy' },
                    h('span', { class: 'chip' }, 'Para tu curso de algoritmos'),
                    h('h1', {}, 'Programa. Compite. ', h('em', {}, 'Sube de nivel.')),
                    h('p', {}, 'codeInt convierte tus ejercicios de PSeInt en misiones y partidas en vivo. Elige tu clase, arma tu avatar y demuestra lo que sabes.'),
                    h('form', { class: 'pin-card', novalidate: true, onSubmit: joinWithPin },
                        h('label', { for: 'landing-pin' }, '¿Tu docente abrió una sala?'),
                        h('div', { class: 'pin-row' }, pinInput, h('button', { class: 'btn', type: 'submit' }, icon('play', 15), 'Unirme')),
                        errorBox,
                        h('small', {}, 'Si aún no iniciaste sesión, te lo pediremos y luego entrarás directo a la sala.')),
                    h('p', { class: 'landing-links' },
                        h('a', { href: '#/login' }, 'Ya tengo cuenta'), h('span', { 'aria-hidden': 'true' }, '·'),
                        h('a', { href: '#/registro' }, 'Tengo una invitación'))),
                h('div', { class: 'landing-visual' }, terminal, cast)),

            h('section', { class: 'landing-steps', 'aria-labelledby': 'landing-steps-title' },
                h('h2', { id: 'landing-steps-title' }, 'Así funciona'),
                h('ol', {}, STEPS.map((step, index) => h('li', { class: 'card' },
                    h('span', { class: 'landing-step-icon', 'aria-hidden': 'true' }, icon(step.icon, 20)),
                    h('span', { class: 'landing-step-num', 'aria-hidden': 'true' }, String(index + 1)),
                    h('h3', {}, step.title), h('p', {}, step.text))))),

            h('section', { class: 'landing-preview', 'aria-labelledby': 'landing-preview-title' },
                h('h2', { id: 'landing-preview-title' }, 'Así se juega'),
                h('p', { class: 'muted' }, 'Preguntas en vivo con tu curso, rachas que te mantienen constante y un ranking para competir sanamente.'),
                previewCards()),

            h('section', { class: 'landing-classes', 'aria-labelledby': 'landing-classes-title' },
                h('h2', { id: 'landing-classes-title' }, 'Elige tu clase'),
                h('p', { class: 'muted' }, 'Siete perfiles del mundo del software. Cambia cada detalle y desbloquea más piezas al subir de nivel.'),
                h('ul', {}, CLASES.map((clase) => h('li', {},
                    createAvatar(PRESETS[clase.id], { size: 64, label: '' }),
                    h('div', {}, h('strong', {}, clase.nombre), h('small', {}, clase.descripcion))))))),

        h('footer', { class: 'landing-foot' },
            h('p', {}, '¿No tienes acceso? Pide una invitación a tu docente o a la administración de tu institución.'))));

    return startTyping(codeNode, resultNode); // el router llama a esto al salir de la vista
}
