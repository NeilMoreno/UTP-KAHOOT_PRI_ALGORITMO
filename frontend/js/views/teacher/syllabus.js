import { h, icon, toast, errorMessage, setBusy, openModal, skeleton, formatDate } from '../../ui.js';
import { api } from '../../api.js';
import { navigate } from '../../router.js';

const LEVEL_LABEL = { basico: 'Básico', intermedio: 'Intermedio', reto: 'Reto' };
const STATE_LABEL = { cargado: 'Cargado', procesando: 'Procesando…', procesado: 'Procesado', error: 'Con error' };
const MIN_UNITS = 3;

const field = (label, control, hint) => h('div', { class: 'field' }, h('label', {}, label), control, hint ? h('span', { class: 'hint' }, hint) : null);

// Campo ligado al estado: escribe en `target[key]` sin volver a pintar toda la vista.
const bound = (target, key, { multiline = false, rows = 3, max, placeholder } = {}) => {
    const input = multiline
        ? h('textarea', { class: 'input', rows, maxlength: max, placeholder })
        : h('input', { class: 'input', type: 'text', maxlength: max, placeholder });
    input.value = target[key] ?? '';
    input.addEventListener('input', () => { target[key] = input.value; });
    return input;
};

const exerciseEditor = (exercise) => h('details', { class: 'syl-exercise' },
    h('summary', {}, h('span', { class: `chip level-${exercise.nivel}` }, LEVEL_LABEL[exercise.nivel]), ' ', exercise.titulo),
    field('Título', bound(exercise, 'titulo', { max: 200 })),
    field('Enunciado', bound(exercise, 'enunciado', { multiline: true, rows: 5, max: 4000 })),
    field('Plantilla PSeInt inicial (opcional)', bound(exercise, 'plantilla_pseint', { multiline: true, rows: 3, max: 2000 })),
    h('div', { class: 'syl-rubric' }, h('strong', {}, 'Rúbrica con la que la IA corregirá'),
        exercise.rubrica.map((item) => h('div', { class: 'syl-rubric-row' },
            bound(item, 'criterio', { max: 120, placeholder: 'Criterio' }),
            bound(item, 'descripcion', { max: 400, placeholder: 'Qué se espera' })))),
    exercise.fuente ? h('p', { class: 'small muted' }, icon('shield', 13), ` Fuente en el sílabo: ${exercise.fuente}`) : null);

const questionEditor = (question, unitIndex, questionIndex) => {
    const group = `correcta-${unitIndex}-${questionIndex}`;
    return h('div', { class: 'syl-question' },
        bound(question, 'enunciado', { max: 300, placeholder: 'Pregunta' }),
        question.opciones.map((option, index) => {
            const radio = h('input', { type: 'radio', name: group, 'aria-label': `Marcar la opción ${index + 1} como correcta` });
            radio.checked = option.es_correcta;
            radio.addEventListener('change', () => { question.opciones.forEach((item, i) => { item.es_correcta = i === index; }); });
            return h('label', { class: 'syl-option' }, radio, bound(option, 'texto', { max: 120, placeholder: `Opción ${index + 1}` }));
        }));
};

export default async function syllabusView({ root, params }) {
    document.title = 'Sílabo con IA · codeInt';
    const courseId = params.id;
    const host = h('div', {}, skeleton(120), skeleton(200));
    root.append(h('div', { class: 'container syllabus-page' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/cursos' }, 'Cursos'), ' / ', h('a', { href: `#/cursos/${courseId}` }, 'Curso'), ' / Sílabo con IA'),
        h('div', { class: 'page-title' }, h('div', {},
            h('h1', {}, 'Sílabo con IA'),
            h('p', {}, 'Sube el sílabo en PDF: la IA propone unidades, ejercicios en tres niveles y preguntas para salas. Tú revisas y publicas.'))),
        host));

    let status = { silabo: null, borrador: null };
    let content = null; // copia editable del borrador

    const load = async () => {
        status = await api(`/cursos/${courseId}/silabo`);
        content = status.borrador && ['generado', 'editado'].includes(status.borrador.estado)
            ? JSON.parse(JSON.stringify(status.borrador.contenido)) : null;
        render();
    };

    const uploadCard = () => {
        const file = h('input', { type: 'file', id: 'silabo-file', accept: 'application/pdf,.pdf', class: 'sr-only' });
        const pick = h('label', { class: 'btn secondary', for: 'silabo-file' }, 'Elegir PDF');
        const upload = h('button', { class: 'btn', type: 'button', disabled: true }, 'Subir sílabo');
        const chosen = h('span', { class: 'muted small' }, 'Ningún archivo elegido (máx. 10 MB).');
        file.addEventListener('change', () => {
            const selected = file.files[0];
            chosen.textContent = selected ? `${selected.name} · ${(selected.size / 1048576).toFixed(1)} MB` : 'Ningún archivo elegido (máx. 10 MB).';
            upload.disabled = !selected;
        });
        upload.addEventListener('click', async () => {
            const selected = file.files[0];
            if (!selected) return;
            if (selected.size > 10 * 1024 * 1024) { toast('El PDF no puede superar los 10 MB.', 'error'); return; }
            setBusy(upload, true, 'Subiendo…');
            try {
                const body = new FormData();
                body.append('file', selected);
                const response = await api(`/cursos/${courseId}/silabo`, { method: 'POST', body });
                toast(response.message, 'success');
                await load();
            } catch (error) {
                toast(errorMessage(error), 'error');
                setBusy(upload, false);
            }
        });
        const silabo = status.silabo;
        return h('section', { class: 'card syl-card' },
            h('h2', {}, '1. Sílabo'),
            silabo
                ? h('p', {}, h('strong', {}, silabo.nombre_archivo), ' · ', h('span', { class: `chip${silabo.estado_procesamiento === 'error' ? ' red' : ''}` }, STATE_LABEL[silabo.estado_procesamiento] || silabo.estado_procesamiento),
                    ` · subido el ${formatDate(silabo.fecha_carga)}`)
                : h('p', { class: 'muted' }, 'Aún no hay un sílabo cargado.'),
            silabo?.mensaje_error ? h('div', { class: 'alert error' }, silabo.mensaje_error) : null,
            h('div', { class: 'row' }, file, pick, upload, chosen));
    };

    const generateCard = () => {
        const silabo = status.silabo;
        const button = h('button', { class: 'btn', type: 'button', disabled: !silabo || silabo.estado_procesamiento === 'procesando' }, icon('sparkles', 16),
            status.borrador ? 'Generar de nuevo con IA' : 'Generar con IA');
        button.addEventListener('click', async () => {
            setBusy(button, true, 'La IA está leyendo el sílabo…');
            try {
                const response = await api(`/cursos/${courseId}/silabo/${silabo.id_silabo}/generar`, { method: 'POST' });
                toast(response.message, 'success');
            } catch (error) {
                toast(errorMessage(error), 'error');
            }
            await load();
        });
        return h('section', { class: 'card syl-card' },
            h('h2', {}, '2. Borrador con IA'),
            h('p', { class: 'muted' }, 'Puede tardar hasta un par de minutos y consume tokens de la cuota de IA del docente. Generar de nuevo reemplaza el borrador actual.'),
            h('div', { class: 'row' }, button));
    };

    const confirmPublish = () => {
        const close = openModal(h('div', {},
            h('div', { class: 'modal-head' }, h('h2', {}, 'Publicar el curso')),
            h('p', {}, 'Los mundos y ejercicios del borrador pasarán a ser el contenido real del curso. Si aún no hay entregas de estudiantes, reemplazarán al contenido base; si ya las hay, se añadirán al final sin borrar nada.'),
            h('div', { class: 'form-actions' },
                h('button', {
                    class: 'btn', type: 'button',
                    onClick: async (event) => {
                        setBusy(event.currentTarget, true, 'Publicando…');
                        try {
                            await api(`/cursos/${courseId}/silabo/borrador`, { method: 'PUT', body: { contenido: content } });
                            const response = await api(`/cursos/${courseId}/silabo/borrador/publicar`, { method: 'POST' });
                            toast(response.message, 'success');
                            close();
                            navigate(`/cursos/${courseId}`);
                        } catch (error) {
                            toast(errorMessage(error), 'error');
                            setBusy(event.currentTarget, false);
                        }
                    }
                }, 'Publicar'),
                h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cancelar'))), { label: 'Publicar el curso' });
    };

    const draftCard = () => {
        if (!content) return null;
        const save = h('button', { class: 'btn secondary', type: 'button' }, 'Guardar cambios');
        save.addEventListener('click', async () => {
            setBusy(save, true, 'Guardando…');
            try {
                await api(`/cursos/${courseId}/silabo/borrador`, { method: 'PUT', body: { contenido: content } });
                toast('Borrador guardado.', 'success');
            } catch (error) {
                toast(errorMessage(error), 'error');
            }
            setBusy(save, false);
        });
        const units = content.unidades.map((unit, index) => h('article', { class: 'card syl-unit' },
            h('div', { class: 'section-heading' },
                h('h3', {}, `Unidad ${index + 1}`),
                h('span', { class: 'muted small' }, unit.semanas || ''),
                h('button', {
                    class: 'btn ghost small', type: 'button', disabled: content.unidades.length <= MIN_UNITS,
                    title: content.unidades.length <= MIN_UNITS ? `Un curso necesita al menos ${MIN_UNITS} unidades` : 'Quitar esta unidad',
                    onClick: () => { content.unidades.splice(index, 1); content.unidades.forEach((u, i) => { u.orden = i + 1; }); render(); }
                }, 'Quitar')),
            field('Nombre', bound(unit, 'nombre', { max: 100 })),
            field('Descripción', bound(unit, 'descripcion', { multiline: true, rows: 2, max: 600 })),
            h('h4', {}, 'Ejercicios'),
            unit.ejercicios.map(exerciseEditor),
            h('details', { class: 'syl-exercise' },
                h('summary', {}, `Preguntas para sala en vivo (${unit.preguntas_sala.length})`),
                h('p', { class: 'small muted' }, 'Marca con el círculo la opción correcta. Se usarán en el siguiente paso, el banco de preguntas.'),
                unit.preguntas_sala.map((question, qIndex) => questionEditor(question, index, qIndex)))));
        return h('section', { class: 'syl-draft' },
            h('div', { class: 'section-heading' },
                h('h2', {}, `3. Revisa el borrador (${content.unidades.length} unidades)`),
                h('div', { class: 'row' }, save,
                    h('button', { class: 'btn', type: 'button', onClick: confirmPublish }, icon('check', 15), 'Publicar curso'))),
            units);
    };

    const render = () => {
        host.replaceChildren(...[uploadCard(), generateCard(), draftCard()].filter(Boolean));
    };

    try {
        await load();
    } catch (error) {
        host.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
    }
}
