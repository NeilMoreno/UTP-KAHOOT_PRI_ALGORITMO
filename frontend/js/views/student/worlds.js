import { h, icon, toast, openModal, setBusy, errorMessage } from '../../ui.js';
import { api } from '../../api.js';
import { navigate } from '../../router.js';

const STATE_LABEL = { completado: 'Completado', en_progreso: 'En progreso', bloqueado: 'Bloqueado' };

const worldNode = (world, previous) => {
    const locked = world.estado === 'bloqueado';
    const cls = world.estado === 'completado' ? 'done' : (locked ? 'locked' : 'current');
    const percent = world.porcentaje_completado || 0;
    const stateIcon = world.estado === 'completado' ? 'check' : (locked ? 'lock' : 'play');

    const open = () => {
        if (locked) {
            toast(previous
                ? `Completa primero todos los ejercicios del Mundo ${previous.orden}: ${previous.nombre}.`
                : 'Este mundo todavía no está disponible.');
            return;
        }
        navigate(`/mundo/${world.id_mundo}`);
    };

    return h('li', { class: `world-item ${cls}` },
        h('button', {
            class: 'world-node', type: 'button', onClick: open,
            'aria-disabled': locked ? 'true' : null,
            'aria-label': `Mundo ${world.orden}: ${world.nombre}. ${STATE_LABEL[world.estado]}. ${world.ejercicios_aprobados} de ${world.total_ejercicios} ejercicios aprobados.`
        },
        h('span', { class: 'world-badge' },
            h('span', { class: 'world-index', 'aria-hidden': 'true' }, world.orden),
            h('span', { class: 'world-state' }, icon(stateIcon, 15))),
        h('span', { class: 'world-label' },
            h('span', { class: 'world-name' }, `Mundo ${world.orden}: ${world.nombre}`),
            h('span', { class: 'world-meta' }, locked
                ? 'Bloqueado'
                : (world.convalidado && world.estado !== 'completado'
                    ? 'Convalidado por tu diagnóstico'
                    : `${world.ejercicios_aprobados} de ${world.total_ejercicios} ejercicios`)),
            locked ? null : h('span', { class: 'progress', 'aria-hidden': 'true' }, h('span', { style: { '--value': `${percent}%` } })))));
};

// Diagnóstico de entrada: opcional y de un solo intento. Si lo domina, el estudiante salta los primeros mundos.
const diagnosticModal = ({ courseId, quiz, onDone }) => {
    const answers = new Map();
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit', disabled: true }, 'Enviar respuestas');
    const body = h('div', {});
    const sync = () => { submit.disabled = answers.size < quiz.preguntas.length; };

    const questions = quiz.preguntas.map((q, index) => h('fieldset', { class: 'diag-question' },
        h('legend', {}, `${index + 1}. ${q.enunciado}`),
        q.opciones.map((text) => {
            const radio = h('input', { type: 'radio', name: `diag-${q.id_banco_pregunta}`, value: text });
            radio.addEventListener('change', () => { answers.set(q.id_banco_pregunta, text); sync(); });
            return h('label', { class: 'syl-option' }, radio, h('span', {}, text));
        })));

    const form = h('form', {
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;
            setBusy(submit, true, 'Corrigiendo…');
            try {
                const { data } = await api(`/cursos/${courseId}/diagnostico`, {
                    method: 'POST',
                    body: { respuestas: [...answers].map(([id_banco_pregunta, respuesta]) => ({ id_banco_pregunta, respuesta })) }
                });
                body.replaceChildren(
                    h('h3', {}, `${data.aciertos} de ${data.total} correctas`),
                    h('p', {}, data.mundos_convalidados > 0
                        ? `Dominas los primeros ${data.mundos_convalidados} mundos: quedan convalidados y empiezas en el Mundo ${data.mundos_convalidados + 1}.`
                        : 'Empiezas desde el Mundo 1. ¡Sin problema, es el mejor punto de partida!'),
                    h('div', { class: 'form-actions' }, h('button', { class: 'btn', type: 'button', onClick: () => { close(); onDone(); } }, 'Ver mi mapa')));
            } catch (error) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = errorMessage(error);
                setBusy(submit, false);
            }
        }
    }, questions, errorBox,
    h('div', { class: 'form-actions' }, submit, h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Ahora no')));

    body.append(h('p', { class: 'muted small' }, 'Responde una pregunta por mundo. Solo tienes un intento: no hace falta estudiar, sirve para saltar lo que ya dominas.'), form);
    const close = openModal(h('div', {}, h('div', { class: 'modal-head' }, h('h2', {}, 'Diagnóstico de entrada')), body), { label: 'Diagnóstico de entrada' });
};

const diagnosticBanner = (courseId, quiz, reload) => h('div', { class: 'card diag-banner' },
    h('div', {}, h('strong', {}, 'Diagnóstico de entrada (opcional)'),
        h('p', { class: 'muted small' }, `${quiz.preguntas.length} preguntas rápidas para saltar los mundos que ya dominas.`)),
    h('button', { class: 'btn', type: 'button', onClick: () => diagnosticModal({ courseId, quiz, onDone: reload }) }, 'Hacer diagnóstico'));

export default async function worldsView({ root, params }) {
    document.title = 'Mapa de mundos · codeInt';
    const { curso, data: worlds } = await api(`/mundos/curso/${params.id}`);
    const done = worlds.filter((w) => w.estado === 'completado').length;
    const diagnostic = await api(`/cursos/${params.id}/diagnostico`).then((body) => body.data).catch(() => null);
    const reload = () => { root.replaceChildren(); worldsView({ root, params }); };

    root.append(h('div', { class: 'container world-page' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' }, h('a', { href: '#/' }, 'Inicio'), ' / ', curso?.nombre || 'Curso'),
        h('div', { class: 'page-head' },
            h('div', {}, h('h1', {}, curso?.nombre || 'Mapa de mundos'),
                h('p', {}, `${done} de ${worlds.length} mundos completados`)),
            h('a', { class: 'btn secondary', href: `#/ranking/${params.id}` }, 'Ranking del curso')),
        diagnostic?.disponible ? diagnosticBanner(params.id, diagnostic, reload) : null,
        worlds.length === 0
            ? h('div', { class: 'card empty' }, 'Este curso aún no tiene mundos.')
            : h('section', { class: 'world-stage', 'aria-label': 'Constelación del curso' },
                h('ol', { class: 'world-path', 'aria-label': 'Mundos del curso' },
                    worlds.map((world, index) => worldNode(world, worlds[index - 1]))))));
}
