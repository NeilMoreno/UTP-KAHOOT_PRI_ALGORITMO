// Mini-lección del mundo: tarjetas de teoría (una idea por tarjeta, con ejemplo) y una pregunta de comprobación.
// La comprobación es de práctica: no da XP ni nota, por eso se corrige en el navegador.
import { h, icon } from '../../ui.js';

const seenKey = (userId, worldId) => `codeint.leccion.${userId}.${worldId}`;
const readSeen = (key) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const writeSeen = (key) => { try { localStorage.setItem(key, '1'); } catch { /* almacenamiento bloqueado */ } };

export const lessonCard = ({ lesson, userId, worldId }) => {
    if (!lesson?.tarjetas?.length) return null;
    const key = seenKey(userId, worldId);
    const total = lesson.tarjetas.length;
    const host = h('div', { class: 'lesson-body' });
    const card = h('section', { class: 'card lesson-card', 'aria-label': 'Lección del mundo' });
    let step = 0;
    let open = false;

    const draw = () => {
        const seen = readSeen(key);
        if (!open) {
            card.replaceChildren(h('div', { class: 'section-heading' },
                h('div', {}, h('h2', { style: { fontSize: '1.1rem' } }, icon('sparkles', 16), ' Lección del mundo'),
                    h('p', { class: 'muted small' }, `${total} tarjetas cortas y una pregunta. ${seen ? 'Ya la viste: puedes repasarla cuando quieras.' : 'Léela antes de empezar los ejercicios.'}`)),
                h('button', { class: seen ? 'btn ghost' : 'btn', type: 'button', onClick: () => { open = true; step = 0; draw(); } }, seen ? 'Repasar' : 'Empezar lección')));
            return;
        }
        if (step < total) {
            const item = lesson.tarjetas[step];
            host.replaceChildren(
                h('p', { class: 'small muted' }, `Tarjeta ${step + 1} de ${total}`),
                h('h3', {}, item.titulo),
                h('p', { class: 'lesson-text' }, item.contenido),
                item.ejemplo ? h('pre', { class: 'typed-code', tabindex: '0', 'aria-label': 'Ejemplo de código' }, item.ejemplo) : null,
                h('div', { class: 'form-actions' },
                    h('button', { class: 'btn ghost', type: 'button', disabled: step === 0, onClick: () => { step -= 1; draw(); } }, 'Anterior'),
                    h('button', { class: 'btn', type: 'button', onClick: () => { step += 1; draw(); } }, step === total - 1 ? 'Comprobar lo aprendido' : 'Siguiente')));
        } else {
            const check = lesson.comprobacion;
            const feedback = h('div', { 'aria-live': 'polite' });
            host.replaceChildren(
                h('h3', {}, 'Comprueba lo aprendido'),
                h('p', {}, check.pregunta),
                h('div', { class: 'stack' }, check.opciones.map((option, index) => h('button', {
                    class: 'btn ghost lesson-option', type: 'button',
                    onClick: (event) => {
                        const right = index === check.correcta;
                        event.currentTarget.classList.add(right ? 'is-right' : 'is-wrong');
                        feedback.replaceChildren(h('div', { class: `alert ${right ? 'success' : 'warn'}`, role: 'status' },
                            right ? '¡Correcto! Ya estás listo para los ejercicios.' : 'Todavía no. Revisa las tarjetas y vuelve a intentarlo.'));
                        if (right) { writeSeen(key); }
                    }
                }, option))),
                feedback,
                h('div', { class: 'form-actions' },
                    h('button', { class: 'btn ghost', type: 'button', onClick: () => { step = 0; draw(); } }, 'Volver a las tarjetas'),
                    h('button', { class: 'btn', type: 'button', onClick: () => { open = false; draw(); } }, 'Cerrar lección')));
        }
        card.replaceChildren(host);
    };
    draw();
    return card;
};
