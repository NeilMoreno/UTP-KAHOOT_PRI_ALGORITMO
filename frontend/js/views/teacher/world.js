import {
    h, icon, skeleton, errorMessage, formatNumber,
    openModal, setBusy, toast
} from '../../ui.js';
import { api } from '../../api.js';
import { emptyState } from './helpers.js';
import { getLanguage } from '../../languages.js';

const TYPE_OPTIONS = [
    ['escribir', 'Escribir código (la IA lo corrige)'],
    ['predecir', 'Predecir la salida (corrección automática)'],
    ['completar', 'Completar el código (corrección automática)'],
    ['ordenar', 'Ordenar las líneas (corrección automática)'],
    ['corregir', 'Corregir el código (corrección automática)']
];

const lines = (value) => value.split('\n').map((line) => line.replace(/\s+$/, '')).filter((line) => line.trim() !== '');

// Campos propios de cada tipo. `read(tipo)` devuelve { material, solucion } o lanza Error con un mensaje claro.
const typedFields = (exercise) => {
    const material = exercise?.material || {};
    const solucion = exercise?.solucion || {};
    const area = (id, label, hint, value, rows = 5) => ({
        control: h('textarea', { class: 'input code', id, rows }, value || ''),
        wrap(control) { return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('span', { class: 'hint' }, hint) : null); }
    });
    const make = (id, label, hint, value, rows) => { const f = area(id, label, hint, value, rows); return { control: f.control, node: f.wrap(f.control) }; };

    const predictCode = make('t-pred-codigo', 'Código que verá el estudiante', null, material.codigo);
    const predictQuestion = h('input', { class: 'input', id: 't-pred-pregunta', type: 'text', maxlength: 300, value: material.pregunta || '¿Qué muestra este programa?' });
    const predictAnswer = h('input', { class: 'input', id: 't-pred-resp', type: 'text', maxlength: 200, value: solucion.respuesta || '' });
    const predictAlt = make('t-pred-alt', 'Otras respuestas válidas (una por línea, opcional)', null, (solucion.alternativas || []).join('\n'), 2);

    const fillCode = make('t-fill-codigo', 'Código con huecos', 'Marca cada hueco con ___ (tres guiones bajos).', material.codigo);
    const fillAnswers = make('t-fill-resp', 'Respuesta de cada hueco (una línea por hueco)', 'Si un hueco admite varias respuestas, sepáralas con |  (ej.: print|imprimir).',
        (solucion.huecos || []).map((options) => options.join('|')).join('\n'), 3);

    const orderLines = make('t-ord-lineas', 'Líneas en el orden CORRECTO (una por línea)', 'Conserva la sangría. El estudiante las verá mezcladas.', (solucion.lineas || []).join('\n'), 7);

    const fixCode = make('t-fix-codigo', 'Código con errores', null, material.codigo);
    const fixMust = make('t-fix-debe', 'El código corregido debe contener (una línea por fragmento)', 'Se compara ignorando espacios y comentarios.', (solucion.debe_contener || []).join('\n'), 3);
    const fixMustNot = make('t-fix-nodebe', 'El código corregido NO debe contener (una línea por fragmento)', null, (solucion.no_debe_contener || []).join('\n'), 3);

    const sections = {
        predecir: h('div', {}, predictCode.node,
            h('div', { class: 'field' }, h('label', { for: 't-pred-pregunta' }, 'Pregunta'), predictQuestion),
            h('div', { class: 'field' }, h('label', { for: 't-pred-resp' }, 'Respuesta correcta'), predictAnswer), predictAlt.node),
        completar: h('div', {}, fillCode.node, fillAnswers.node),
        ordenar: h('div', {}, orderLines.node),
        corregir: h('div', {}, fixCode.node, fixMust.node, fixMustNot.node)
    };

    const read = (tipo) => {
        if (tipo === 'predecir') {
            return {
                material: { codigo: predictCode.control.value, pregunta: predictQuestion.value },
                solucion: { respuesta: predictAnswer.value, alternativas: lines(predictAlt.control.value) }
            };
        }
        if (tipo === 'completar') {
            return {
                material: { codigo: fillCode.control.value },
                solucion: { huecos: lines(fillAnswers.control.value).map((row) => row.split('|').map((option) => option.trim()).filter(Boolean)) }
            };
        }
        if (tipo === 'ordenar') {
            // Conserva la sangría (solo se descartan líneas vacías).
            return { material: {}, solucion: { lineas: orderLines.control.value.split('\n').map((line) => line.replace(/\s+$/, '')).filter((line) => line.trim() !== '') } };
        }
        return {
            material: { codigo: fixCode.control.value },
            solucion: { debe_contener: lines(fixMust.control.value), no_debe_contener: lines(fixMustNot.control.value) }
        };
    };
    return { sections, read };
};

const exerciseFormModal = ({ idMundo, exercise = null, suggestedOrder = 1, language = getLanguage('pseint'), onSaved }) => {
    const editing = Boolean(exercise);
    const typed = typedFields(exercise);
    const tipo = h('select', { class: 'input', id: 'ejercicio-tipo' }, TYPE_OPTIONS.map(([value, label]) => h('option', { value }, label)));
    tipo.value = exercise?.tipo || 'escribir';
    tipo.disabled = editing; // el tipo no cambia al editar
    const typedHost = h('div', {});
    const plantillaField = { node: null };
    const syncType = () => {
        typedHost.replaceChildren(...(typed.sections[tipo.value] ? [typed.sections[tipo.value]] : []));
        if (plantillaField.node) plantillaField.node.hidden = tipo.value !== 'escribir';
    };
    const titulo = h('input', { class: 'input', id: 'ejercicio-titulo', type: 'text', required: true, maxlength: 200, value: exercise?.titulo || '' });
    const orden = h('input', { class: 'input', id: 'ejercicio-orden', type: 'number', min: 1, step: 1, required: true, value: exercise?.orden ?? suggestedOrder });
    const xp = h('input', { class: 'input', id: 'ejercicio-xp', type: 'number', min: 0, max: 1000, step: 10, required: true, value: exercise?.xp_recompensa ?? 50 });
    const enunciado = h('textarea', { class: 'input', id: 'ejercicio-enunciado', rows: 4, required: true }, exercise?.enunciado || '');
    const plantilla = h('textarea', { class: 'input code', id: 'ejercicio-plantilla', rows: 10 }, exercise?.plantilla_pseint || language.plantilla);
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, editing ? 'Guardar cambios' : 'Crear ejercicio');

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

            const payload = {
                titulo: titulo.value.trim(),
                enunciado: enunciado.value.trim(),
                orden: Number(orden.value),
                xp_recompensa: Number(xp.value)
            };
            if (tipo.value === 'escribir') {
                payload.plantilla_pseint = plantilla.value;
            } else {
                Object.assign(payload, typed.read(tipo.value));
                if (!editing) payload.tipo = tipo.value;
            }

            if (!payload.titulo || !payload.enunciado) {
                showError('El título y el enunciado son obligatorios.');
                return;
            }
            if (!Number.isInteger(payload.orden) || payload.orden < 1) {
                showError('El orden debe ser un número entero mayor que cero.');
                return;
            }
            if (!Number.isInteger(payload.xp_recompensa) || payload.xp_recompensa < 0 || payload.xp_recompensa > 1000) {
                showError('La recompensa de XP debe estar entre 0 y 1000.');
                return;
            }

            setBusy(submit, true, editing ? 'Guardando…' : 'Creando…');
            try {
                const response = editing
                    ? await api(`/ejercicios/${exercise.id_ejercicio}`, { method: 'PUT', body: payload })
                    : await api('/ejercicios', { method: 'POST', body: { id_mundo: idMundo, ...payload } });
                toast(response.message || (editing ? 'Ejercicio actualizado.' : 'Ejercicio creado.'), 'success');
                close();
                if (onSaved) onSaved(response.data);
            } catch (error) {
                showError(errorMessage(error));
                setBusy(submit, false);
            }
        }
    },
    h('div', { class: 'form-grid' },
        h('div', { class: 'field', style: { gridColumn: '1 / -1' } }, h('label', { for: 'ejercicio-titulo' }, 'Título'), titulo),
        h('div', { class: 'field' }, h('label', { for: 'ejercicio-orden' }, 'Orden'), orden,
            h('span', { class: 'hint' }, 'Debe ser único dentro del mundo.')),
        h('div', { class: 'field' }, h('label', { for: 'ejercicio-xp' }, 'XP de recompensa'), xp)),
    h('div', { class: 'field' }, h('label', { for: 'ejercicio-enunciado' }, 'Enunciado'), enunciado),
    h('div', { class: 'field' }, h('label', { for: 'ejercicio-tipo' }, 'Tipo de ejercicio'), tipo,
        h('span', { class: 'hint' }, editing ? 'El tipo no se puede cambiar al editar.' : 'Los tipos con corrección automática no gastan tokens de IA.')),
    plantillaField.node = h('div', { class: 'field' }, h('label', { for: 'ejercicio-plantilla' }, `Plantilla ${language.nombre}`), plantilla,
        h('span', { class: 'hint' }, 'El estudiante verá esta plantilla al abrir el ejercicio.')),
    typedHost,
    errorBox,
    h('div', { class: 'form-actions' },
        submit,
        h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cancelar')));

    const close = openModal(h('div', {},
        h('div', { class: 'modal-head' }, h('h2', {}, editing ? 'Editar ejercicio' : 'Nuevo ejercicio')),
        form), { label: editing ? 'Editar ejercicio' : 'Nuevo ejercicio' });

    tipo.addEventListener('change', syncType);
    syncType();
    titulo.focus();
};

const exerciseRow = (exercise, onEdit) => h('tr', {},
    h('td', { class: 'num' }, formatNumber(exercise.orden)),
    h('td', {},
        h('div', { class: 'cell-main' },
            h('strong', {}, exercise.titulo, exercise.tipo && exercise.tipo !== 'escribir' ? h('span', { class: 'chip blue', style: { marginLeft: '8px' } }, exercise.tipo) : null),
            h('small', {}, exercise.enunciado.length > 120 ? `${exercise.enunciado.slice(0, 120)}…` : exercise.enunciado))),
    h('td', { class: 'num' }, `${formatNumber(exercise.xp_recompensa)} XP`),
    h('td', { class: 'num' }, formatNumber(exercise.total_envios)),
    h('td', {}, h('div', { class: 'row-actions' },
        h('button', { class: 'btn ghost small', type: 'button', onClick: () => onEdit(exercise) }, 'Editar'))));

export default async function worldView({ root, params }) {
    document.title = 'Ejercicios del mundo · codeInt';

    const breadcrumbHost = h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' }, 'Mundo');
    const headerHost = h('div', {}, skeleton(70));
    const contentHost = h('div', {}, skeleton(240));

    root.append(h('div', { class: 'container' }, breadcrumbHost, headerHost, contentHost));

    let mundo = null;
    let idCurso = null;
    let cursoNombre = 'Curso';
    let language = getLanguage('pseint');
    let exercises = [];

    const openCreate = () => {
        const maxOrder = exercises.reduce((max, item) => Math.max(max, Number(item.orden) || 0), 0);
        exerciseFormModal({
            idMundo: mundo.id_mundo,
            suggestedOrder: maxOrder + 1,
            language,
            onSaved: () => load()
        });
    };

    const render = () => {
        breadcrumbHost.replaceChildren(
            h('a', { href: '#/' }, 'Panel'), ' / ',
            h('a', { href: '#/cursos' }, 'Cursos'), ' / ',
            h('a', { href: `#/cursos/${idCurso}` }, cursoNombre), ' / ',
            `Mundo ${mundo.orden}`);

        headerHost.replaceChildren(h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, `Mundo ${mundo.orden}: ${mundo.nombre}`),
                h('p', {}, mundo.descripcion)),
            h('div', { class: 'row' },
                h('span', { class: 'chip blue' }, `${exercises.length} ejercicios`),
                h('button', { class: 'btn', type: 'button', onClick: openCreate }, icon('play', 15), 'Nuevo ejercicio'),
                h('a', { class: 'btn ghost small', href: `#/cursos/${idCurso}` }, icon('arrow', 14), 'Volver al curso'))));

        if (exercises.length === 0) {
            contentHost.replaceChildren(
                h('div', { class: 'alert warn', style: { marginBottom: '16px' } },
                    'Este mundo no tiene ejercicios. Los estudiantes no podrán completarlo y quedarán bloqueados en el siguiente mundo.'),
                emptyState('Mundo sin contenido', 'Crea el primer ejercicio con su enunciado y su plantilla de código.'));
            return;
        }

        contentHost.replaceChildren(h('div', { class: 'table-wrap' },
            h('table', { class: 'table' },
                h('thead', {}, h('tr', {},
                    h('th', { class: 'num' }, 'Orden'),
                    h('th', {}, 'Ejercicio'),
                    h('th', { class: 'num' }, 'Recompensa'),
                    h('th', { class: 'num' }, 'Envíos'),
                    h('th', {}, h('span', { class: 'sr-only' }, 'Acciones')))),
                h('tbody', {}, exercises.map((exercise) => exerciseRow(exercise, (item) => {
                    exerciseFormModal({
                        language,
                        idMundo: mundo.id_mundo,
                        exercise: item,
                        onSaved: () => load()
                    });
                }))))));
    };

    const load = async () => {
        headerHost.replaceChildren(skeleton(70));
        contentHost.replaceChildren(skeleton(240));
        try {
            const response = await api(`/ejercicios/mundo/${params.id}`);
            mundo = response.mundo;
            exercises = response.data;
            idCurso = mundo.id_curso;
            language = getLanguage(mundo.lenguaje); // plantilla y nombre según el lenguaje del curso

            try {
                const courseResponse = await api(`/cursos/${idCurso}`);
                cursoNombre = courseResponse.data.nombre;
            } catch { /* el curso puede no estar accesible para mostrar sólo el nombre */ }

            document.title = `Mundo ${mundo.orden}: ${mundo.nombre} · codeInt`;
            render();
        } catch (error) {
            headerHost.replaceChildren(h('h1', {}, 'No pudimos abrir este mundo'));
            contentHost.replaceChildren(h('div', { class: 'card' },
                h('div', { class: 'alert error' }, errorMessage(error)),
                h('a', { class: 'btn ghost', href: '#/cursos' }, 'Volver a mis cursos')));
        }
    };

    await load();
}
