import {
    h, icon, skeleton, errorMessage, formatNumber, formatDate,
    openModal, setBusy, toast
} from '../../ui.js';
import { api } from '../../api.js';
import { navigate } from '../../router.js';
import { emptyState, statusChip } from './helpers.js';

let questionSeed = 1;
const emptyQuestion = () => ({
    id: questionSeed++,
    enunciado: '',
    tiempo: '30',
    puntos: '1000',
    correcta: 0,
    opciones: ['', '', '', '']
});

const optionRow = (question, index, rerender) => {
    const label = String.fromCharCode(65 + index);
    const input = h('input', {
        class: 'input', type: 'text', maxlength: 200, value: question.opciones[index],
        placeholder: `Opción ${label}`, 'aria-label': `Opción ${label} de la pregunta`,
        onInput: (event) => { question.opciones[index] = event.target.value; }
    });
    const radio = h('input', {
        type: 'radio', name: `correcta-${question.id}`, checked: question.correcta === index,
        'aria-label': `Marcar opción ${label} como correcta`,
        onChange: () => { question.correcta = index; rerender(); }
    });
    return h('div', { class: 'option-row' }, radio, input,
        h('span', { class: 'chip', title: 'Marcar la opción correcta' }, label));
};

const questionBlock = (question, index, { questions, rerender }) => h('article', { class: 'question-block' },
    h('div', { class: 'section-heading' },
        h('h3', {}, `Pregunta ${index + 1}`),
        questions.length > 1
            ? h('button', {
                class: 'btn ghost small', type: 'button',
                onClick: () => {
                    questions.splice(index, 1);
                    rerender();
                }
            }, 'Quitar')
            : null),
    h('div', { class: 'field' },
        h('label', { for: `enunciado-${question.id}` }, 'Enunciado'),
        h('textarea', {
            class: 'input', id: `enunciado-${question.id}`, rows: 2, maxlength: 500,
            placeholder: '¿Cuál es la estructura que repite un bloque mientras se cumpla una condición?',
            onInput: (event) => { question.enunciado = event.target.value; }
        }, question.enunciado)),
    h('div', { class: 'form-grid' },
        h('div', { class: 'field' },
            h('label', { for: `tiempo-${question.id}` }, 'Tiempo límite (segundos)'),
            h('input', {
                class: 'input', id: `tiempo-${question.id}`, type: 'number', min: 5, max: 120, step: 1,
                value: question.tiempo, onInput: (event) => { question.tiempo = event.target.value; }
            })),
        h('div', { class: 'field' },
            h('label', { for: `puntos-${question.id}` }, 'Puntos base'),
            h('input', {
                class: 'input', id: `puntos-${question.id}`, type: 'number', min: 100, max: 5000, step: 100,
                value: question.puntos, onInput: (event) => { question.puntos = event.target.value; }
            }))),
    h('div', { class: 'stack', style: { gap: '8px' } },
        h('span', { class: 'hint' }, 'Opciones A–D. Marca la correcta y deja vacías las que no uses (mínimo 2).'),
        question.opciones.map((_, optionIndex) => optionRow(question, optionIndex, rerender))));

const roomBuilderModal = ({ courses, onCreated }) => {
    const activeCourses = courses.filter((course) => course.estado === 'activo');
    let selectedCourse = activeCourses.length === 1 ? activeCourses[0].id_curso : '';
    const courseSelect = h('select', {
        class: 'input', id: 'sala-curso', required: true,
        onChange: (event) => { selectedCourse = event.target.value; }
    }, h('option', { value: '' }, 'Selecciona un curso…'),
    activeCourses.map((course) => h('option', { value: course.id_curso }, `${course.nombre} · ${course.codigo_curso}`)));

    if (activeCourses.length === 1) courseSelect.value = activeCourses[0].id_curso;

    const questions = [emptyQuestion()];
    const questionsHost = h('div', { class: 'question-builder' });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Crear sala');

    const rerenderQuestions = () => {
        questionsHost.replaceChildren(
            ...questions.map((question, index) => questionBlock(question, index, { questions, rerender: rerenderQuestions })),
            h('div', { class: 'builder-actions' },
                h('button', {
                    class: 'btn secondary', type: 'button',
                    disabled: questions.length >= 50,
                    onClick: () => {
                        if (questions.length >= 50) return;
                        questions.push(emptyQuestion());
                        rerenderQuestions();
                    }
                }, '+ Agregar pregunta'),
                h('span', { class: 'hint' }, `${questions.length} de 50 preguntas`)));
    };

    const showError = (message) => {
        errorBox.className = 'alert error';
        errorBox.hidden = false;
        errorBox.textContent = message;
    };

    const form = h('form', {
        novalidate: true,
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;

            if (!selectedCourse) {
                showError('Selecciona el curso de la sala.');
                return;
            }

            const preguntas = [];
            for (const [index, question] of questions.entries()) {
                const enunciado = question.enunciado.trim();
                if (!enunciado) {
                    showError(`La pregunta ${index + 1} necesita un enunciado.`);
                    return;
                }

                const opciones = question.opciones
                    .map((texto, optionIndex) => ({ texto: texto.trim(), optionIndex }))
                    .filter((option) => option.texto.length > 0);
                if (opciones.length < 2) {
                    showError(`La pregunta ${index + 1} necesita al menos 2 opciones con texto.`);
                    return;
                }
                if (!opciones.some((option) => option.optionIndex === question.correcta)) {
                    showError(`Marca como correcta una de las opciones con texto en la pregunta ${index + 1}.`);
                    return;
                }

                preguntas.push({
                    enunciado,
                    tiempo_limite_seg: Number(question.tiempo),
                    puntos_base: Number(question.puntos),
                    opciones: opciones.map((option) => ({
                        texto: option.texto,
                        es_correcta: option.optionIndex === question.correcta
                    }))
                });
            }

            setBusy(submit, true, 'Creando…');
            try {
                const response = await api('/salas', {
                    method: 'POST',
                    body: { id_curso: selectedCourse, preguntas }
                });
                toast(`Sala ${response.data.pin} creada. Ya puedes abrirla.`, 'success');
                close();
                if (onCreated) onCreated(response.data);
            } catch (error) {
                showError(errorMessage(error));
                setBusy(submit, false);
            }
        }
    },
    activeCourses.length === 0
        ? h('div', { class: 'alert warn' }, 'Necesitas al menos un curso activo para crear una sala.')
        : h('div', { class: 'field' }, h('label', { for: 'sala-curso' }, 'Curso'), courseSelect),
    h('div', { class: 'alert info', style: { marginBottom: '16px' } },
        'Las preguntas se guardan al crear la sala. La partida se abre desde el panel del anfitrión.'),
    questionsHost,
    errorBox,
    h('div', { class: 'form-actions' },
        submit,
        h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cancelar')));

    const close = openModal(h('div', {},
        h('div', { class: 'modal-head' }, h('h2', {}, 'Nueva sala Kahoot')),
        h('p', { class: 'muted small', style: { marginTop: '-6px' } },
            'Define las preguntas y marca la respuesta correcta de cada una.'),
        form), { label: 'Nueva sala Kahoot' });

    rerenderQuestions();
    if (activeCourses.length > 0) courseSelect.focus();
};

const openRoomDetail = async (sala) => {
    const host = h('div', {}, skeleton(160));
    openModal(h('div', {},
        h('div', { class: 'modal-head' },
            h('h2', {}, `Sala ${sala.pin_sala}`),
            statusChip(sala.estado)),
        host), { label: `Detalle de la sala ${sala.pin_sala}` });

    try {
        const { data } = await api(`/salas/${sala.id_sala}/detalle`);
        host.replaceChildren(
            h('div', { class: 'info-list' },
                h('div', { class: 'info-row' }, h('span', {}, 'Curso'), h('strong', {}, data.curso_nombre)),
                h('div', { class: 'info-row' }, h('span', {}, 'Creada'), h('strong', {}, formatDate(data.fecha_creacion))),
                h('div', { class: 'info-row' }, h('span', {}, 'Inicio'), h('strong', {}, formatDate(data.fecha_inicio))),
                h('div', { class: 'info-row' }, h('span', {}, 'Fin'), h('strong', {}, formatDate(data.fecha_fin))),
                h('div', { class: 'info-row' }, h('span', {}, 'Preguntas'), h('strong', {}, formatNumber(data.preguntas.length)))),
            h('h3', { style: { marginTop: '18px' } }, 'Preguntas'),
            h('div', { class: 'stack', style: { marginTop: '10px' } }, data.preguntas.map((pregunta) => h('div', { class: 'card flat', style: { border: '1px solid var(--border)' } },
                h('div', { class: 'section-heading' },
                    h('strong', {}, `${pregunta.orden}. ${pregunta.enunciado}`),
                    h('span', { class: 'chip' }, `${pregunta.tiempo_limite_seg}s · ${pregunta.puntos_base} pts`)),
                h('ul', { style: { margin: '10px 0 0', paddingLeft: '18px' } },
                    pregunta.opciones.map((opcion) => h('li', { style: opcion.es_correcta ? { color: 'var(--positive)', fontWeight: 700 } : {} },
                        `${opcion.etiqueta}. ${opcion.texto}${opcion.es_correcta ? ' ✓' : ''}`)))))),
            h('h3', { style: { marginTop: '18px' } }, 'Participantes'),
            data.participantes.length === 0
                ? h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'La sala no registró participantes.')
                : h('div', { class: 'table-wrap', style: { marginTop: '10px' } },
                    h('table', { class: 'table' },
                        h('thead', {}, h('tr', {},
                            h('th', { class: 'num' }, 'Puesto'),
                            h('th', {}, 'Estudiante'),
                            h('th', { class: 'num' }, 'Puntaje'))),
                        h('tbody', {}, data.participantes.map((participante) => h('tr', {},
                            h('td', { class: 'num' }, participante.posicion_final ?? '—'),
                            h('td', {}, `${participante.apellido}, ${participante.nombre}`),
                            h('td', { class: 'num' }, formatNumber(participante.puntaje_final))))))));
    } catch (error) {
        host.replaceChildren(h('div', { class: 'alert error' }, errorMessage(error)));
    }
};

const roomRow = (sala, onOpenDetail) => {
    const canOpen = sala.estado === 'espera' || sala.estado === 'en_curso';
    return h('tr', {},
        h('td', {}, h('strong', { style: { letterSpacing: '.12em' } }, sala.pin_sala)),
        h('td', {},
            h('div', { class: 'cell-main' },
                h('strong', {}, sala.curso_nombre),
                h('small', {}, sala.codigo_curso))),
        h('td', {}, statusChip(sala.estado)),
        h('td', { class: 'num' }, formatNumber(sala.total_preguntas)),
        h('td', { class: 'num' }, formatNumber(sala.total_participantes)),
        h('td', {}, formatDate(sala.fecha_creacion)),
        h('td', {},
            h('div', { class: 'row-actions' },
                canOpen
                    ? h('a', { class: 'btn secondary small', href: `#/salas/${sala.pin_sala}` },
                        sala.estado === 'en_curso' ? 'Retomar' : 'Abrir')
                    : h('button', { class: 'btn ghost small', type: 'button', onClick: () => onOpenDetail(sala) }, 'Detalle'))));
};

export default async function salasView({ root }) {
    document.title = 'Salas Kahoot · codeInt';

    const host = h('div', { class: 'table-wrap' }, skeleton(240));
    const newButton = h('button', { class: 'btn', type: 'button' }, icon('play', 15), 'Nueva sala');
    const refreshButton = h('button', { class: 'btn ghost small', type: 'button' }, 'Actualizar');

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' }, h('a', { href: '#/' }, 'Panel'), ' / Salas'),
        h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, 'Salas Kahoot'),
                h('p', {}, 'Crea una partida con preguntas, proyecta el PIN y controla el avance en vivo.')),
            h('div', { class: 'row' }, refreshButton, newButton)),
        host));

    let courses = [];
    let salas = [];

    const paint = () => {
        if (salas.length === 0) {
            host.replaceChildren(emptyState('Aún no has creado salas',
                'Crea tu primera sala para que tus estudiantes se unan con un PIN de 6 dígitos.'));
            return;
        }

        host.replaceChildren(h('table', { class: 'table' },
            h('thead', {}, h('tr', {},
                h('th', {}, 'PIN'),
                h('th', {}, 'Curso'),
                h('th', {}, 'Estado'),
                h('th', { class: 'num' }, 'Preguntas'),
                h('th', { class: 'num' }, 'Participantes'),
                h('th', {}, 'Creada'),
                h('th', {}, h('span', { class: 'sr-only' }, 'Acciones')))),
            h('tbody', {}, salas.map((sala) => roomRow(sala, openRoomDetail)))));
    };

    const load = async () => {
        host.replaceChildren(skeleton(240));
        try {
            const [coursesResponse, salasResponse] = await Promise.all([
                api('/cursos'),
                api('/salas/docente')
            ]);
            courses = coursesResponse.data;
            salas = salasResponse.data;
            paint();
        } catch (error) {
            host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
        }
    };

    const openBuilder = () => roomBuilderModal({
        courses,
        onCreated: (sala) => navigate(`/salas/${sala.pin}`)
    });

    newButton.addEventListener('click', openBuilder);
    refreshButton.addEventListener('click', load);

    await load();
}
