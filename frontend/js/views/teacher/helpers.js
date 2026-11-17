// Utilidades compartidas por las vistas del panel docente.
import { h, openModal, setBusy, errorMessage, toast } from '../../ui.js';
import { api } from '../../api.js';

const STATUS_TONE = {
    activo: 'green',
    activa: 'green',
    completado: 'green',
    finalizada: 'green',
    inactivo: 'red',
    inactiva: 'red',
    retirada: 'red',
    cancelada: 'red',
    vencida: 'red',
    revocada: 'red',
    usada: 'green',
    confirmado: 'green',
    reservado: 'blue',
    fallido: 'red',
    pendiente: '',
    bloqueado: '',
    en_progreso: 'blue',
    en_curso: 'blue',
    espera: 'blue',
    procesando: 'ai'
};

const STATUS_LABEL = {
    activo: 'Activo',
    activa: 'Activa',
    inactivo: 'Inactivo',
    inactiva: 'Inactiva',
    retirada: 'Retirada',
    pendiente: 'Pendiente',
    usada: 'Usada',
    confirmado: 'Confirmado',
    reservado: 'Reservado',
    fallido: 'Fallido',
    vencida: 'Vencida',
    revocada: 'Revocada',
    bloqueado: 'Bloqueado',
    en_progreso: 'En progreso',
    completado: 'Completado',
    en_curso: 'En curso',
    espera: 'En espera',
    finalizando: 'Finalizando',
    finalizada: 'Finalizada',
    cancelada: 'Cancelada',
    procesando: 'Procesando'
};

export const statusChip = (estado) => h(
    'span',
    { class: `chip ${STATUS_TONE[estado] || ''}`.trim() },
    STATUS_LABEL[estado] || estado
);

export const emptyState = (title, detail) => h('div', { class: 'empty-state' },
    h('strong', {}, title),
    detail ? h('p', {}, detail) : null);

// Modal de creación y edición de curso. Devuelve la función de cierre.
export const courseFormModal = ({ course = null, onSaved }) => {
    const editing = Boolean(course);
    const nombre = h('input', { class: 'input', id: 'curso-nombre', type: 'text', required: true, maxlength: 160, value: course?.nombre || '' });
    const codigo = h('input', { class: 'input', id: 'curso-codigo', type: 'text', required: true, maxlength: 40, value: course?.codigo_curso || '', placeholder: 'ALPR-002' });
    const periodo = h('input', { class: 'input', id: 'curso-periodo', type: 'text', required: true, maxlength: 20, value: course?.periodo || '', placeholder: '2026-II' });
    const estado = editing
        ? h('select', { class: 'input', id: 'curso-estado' },
            h('option', { value: 'activo', selected: course.estado === 'activo' }, 'Activo'),
            h('option', { value: 'inactivo', selected: course.estado === 'inactivo' }, 'Inactivo'))
        : null;
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, editing ? 'Guardar cambios' : 'Crear curso');

    const form = h('form', {
        novalidate: true,
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;

            const payload = {
                nombre: nombre.value.trim(),
                codigo_curso: codigo.value.trim().toUpperCase(),
                periodo: periodo.value.trim()
            };
            if (editing) payload.estado = estado.value;

            if (!payload.nombre || !payload.codigo_curso || !payload.periodo) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = 'Completa el nombre, el código y el periodo del curso.';
                return;
            }

            setBusy(submit, true, editing ? 'Guardando…' : 'Creando…');
            try {
                const response = editing
                    ? await api(`/cursos/${course.id_curso}`, { method: 'PUT', body: payload })
                    : await api('/cursos', { method: 'POST', body: payload });
                toast(response.message || (editing ? 'Curso actualizado.' : 'Curso creado.'), 'success');
                close();
                if (onSaved) onSaved(response.data);
            } catch (error) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = errorMessage(error);
                setBusy(submit, false);
            }
        }
    },
    h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { for: 'curso-nombre' }, 'Nombre del curso'), nombre),
        h('div', { class: 'field' }, h('label', { for: 'curso-codigo' }, 'Código'), codigo),
        h('div', { class: 'field' }, h('label', { for: 'curso-periodo' }, 'Periodo'), periodo),
        estado ? h('div', { class: 'field' }, h('label', { for: 'curso-estado' }, 'Estado'), estado) : null),
    errorBox,
    h('div', { class: 'form-actions' },
        submit,
        h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cancelar')));

    const close = openModal(h('div', {},
        h('div', { class: 'modal-head' }, h('h2', {}, editing ? 'Editar curso' : 'Nuevo curso')),
        editing
            ? h('p', { class: 'muted small' }, 'Los siete mundos y sus ejercicios base no se modifican al editar el curso.')
            : h('p', { class: 'muted small' }, 'Al crear el curso se generan los siete mundos con su contenido base y quedan listos para matricular estudiantes.'),
        form), { label: editing ? 'Editar curso' : 'Nuevo curso' });

    nombre.focus();
};

// Modal de matrícula individual por correo.
export const enrollmentModal = ({ idCurso, onSaved }) => {
    const email = h('input', { class: 'input', id: 'matricula-email', type: 'email', required: true, placeholder: 'estudiante@utp.edu.pe' });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Matricular');

    const form = h('form', {
        novalidate: true,
        onSubmit: async (event) => {
            event.preventDefault();
            errorBox.hidden = true;
            if (!email.value.trim()) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = 'Ingresa el correo del estudiante.';
                return;
            }

            setBusy(submit, true, 'Matriculando…');
            try {
                const response = await api(`/cursos/${idCurso}/matricular`, { method: 'POST', body: { email: email.value.trim() } });
                toast(response.message || 'Estudiante matriculado.', 'success');
                close();
                if (onSaved) onSaved(response.data);
            } catch (error) {
                errorBox.className = 'alert error';
                errorBox.hidden = false;
                errorBox.textContent = errorMessage(error);
                setBusy(submit, false);
            }
        }
    },
    h('div', { class: 'field' }, h('label', { for: 'matricula-email' }, 'Correo del estudiante'), email,
        h('span', { class: 'hint' }, 'La cuenta debe existir, estar activa y pertenecer a la misma institución del curso.')),
    errorBox,
    h('div', { class: 'form-actions' },
        submit,
        h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cancelar')));

    const close = openModal(h('div', {},
        h('div', { class: 'modal-head' }, h('h2', {}, 'Matricular estudiante')),
        form), { label: 'Matricular estudiante' });

    email.focus();
};
