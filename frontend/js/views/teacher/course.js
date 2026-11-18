import {
    h, icon, skeleton, errorMessage, formatNumber, formatDate,
    openModal, setBusy, toast
} from '../../ui.js';
import { api } from '../../api.js';
import { courseFormModal, enrollmentModal, emptyState, statusChip } from './helpers.js';

const worldCard = (world) => {
    const total = Number(world.total_ejercicios || 0);
    return h('article', { class: 'card' },
        h('div', { class: 'section-heading' },
            h('h3', {}, `Mundo ${world.orden}: ${world.nombre}`),
            total === 0 ? h('span', { class: 'chip red' }, 'Sin contenido') : h('span', { class: 'chip blue' }, `${total} ejercicios`)),
        h('p', { class: 'muted small' }, world.descripcion),
        h('div', { class: 'form-actions' },
            h('a', { class: 'btn secondary small', href: `#/mundos/${world.id_mundo}` },
                total === 0 ? 'Agregar ejercicios' : 'Gestionar ejercicios')));
};

const studentRow = (student) => h('tr', {},
    h('td', {},
        h('div', { class: 'cell-main' },
            h('strong', {}, `${student.apellido}, ${student.nombre}`),
            h('small', {}, student.email))),
    h('td', {}, statusChip(student.estado)),
    h('td', { class: 'num' }, formatNumber(student.xp_en_curso)),
    h('td', { class: 'num' }, formatNumber(student.mundos_completados)),
    h('td', {}, formatDate(student.fecha_matricula)));

const csvModal = ({ idCurso, onFinished }) => {
    const file = h('input', { class: 'input', id: 'csv-file', type: 'file', accept: '.csv,text/csv' });
    const text = h('textarea', {
        class: 'input', id: 'csv-text', rows: 6,
        placeholder: 'nombre,apellido,email\nAna,Torres,ana.torres@utp.edu.pe\nLuis,Ramos,luis.ramos@utp.edu.pe'
    });
    const resultHost = h('div', { hidden: true });
    const errorBox = h('div', { role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Procesar CSV');

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
            resultHost.hidden = true;

            if (!file.files[0] && !text.value.trim()) {
                showError('Adjunta un archivo CSV o pega los registros en el cuadro de texto.');
                return;
            }

            const body = new FormData();
            if (file.files[0]) body.append('file', file.files[0]);
            else body.append('csvText', text.value);

            setBusy(submit, true, 'Procesando…');
            try {
                const response = await api(`/cursos/${idCurso}/matricular-csv`, { method: 'POST', body });
                const resumen = response.resumen || {};
                const errores = Array.isArray(resumen.errores) ? resumen.errores : [];

                resultHost.hidden = false;
                resultHost.replaceChildren(
                    h('div', { class: 'alert success' },
                        `Matrículas activadas: ${formatNumber(resumen.total_matriculas_activadas)} de ${formatNumber(resumen.total_lineas_procesadas)} líneas procesadas.`),
                    errores.length
                        ? h('div', { style: { marginTop: '12px' } },
                            h('strong', {}, `Incidencias (${errores.length})`),
                            h('ul', { class: 'problems' }, errores.map((item) => h('li', {}, item))))
                        : h('p', { class: 'small muted', style: { marginTop: '10px' } }, 'Sin incidencias: todas las filas se matricularon correctamente.'));

                toast('Procesamiento de matrículas completado.', 'success');
                if (onFinished) onFinished();
            } catch (error) {
                showError(errorMessage(error));
            } finally {
                setBusy(submit, false);
            }
        }
    },
    h('div', { class: 'alert info', style: { marginBottom: '16px' } },
        'Formato: nombre,apellido,email. Las cuentas deben estar registradas previamente, activas y pertenecer a la institución del curso.'),
    h('div', { class: 'field' }, h('label', { for: 'csv-file' }, 'Archivo CSV'), file,
        h('span', { class: 'hint' }, 'Máximo 5 MB y 1000 estudiantes por carga.')),
    h('div', { class: 'field' }, h('label', { for: 'csv-text' }, 'O pega el contenido CSV'), text),
    errorBox,
    resultHost,
    h('div', { class: 'form-actions' },
        submit,
        h('button', { class: 'btn ghost', type: 'button', onClick: () => close() }, 'Cerrar')));

    const close = openModal(h('div', {},
        h('div', { class: 'modal-head' }, h('h2', {}, 'Carga masiva de matrículas')),
        h('p', { class: 'muted small', style: { marginTop: '-6px' } },
            'El encabezado es opcional. Se ignoran las filas que no puedan matricularse y se detallan al final.'),
        form), { label: 'Carga masiva de matrículas' });
};

export default async function courseView({ root, params, user }) {
    document.title = 'Gestión del curso · codeInt';

    const headerHost = h('div', {}, skeleton(70));
    const tabHost = h('div', { class: 'row', style: { marginBottom: '16px' } });
    const contentHost = h('div', {}, skeleton(240));

    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Panel'), ' / ',
            h('a', { href: '#/cursos' }, 'Cursos'), ' / Curso'),
        headerHost,
        tabHost,
        contentHost));

    let course = null;
    let students = null;
    let studentsLoading = false;
    let activeTab = 'mundos';

    const loadStudents = async () => {
        if (studentsLoading) return;
        studentsLoading = true;
        students = null;
        contentHost.replaceChildren(skeleton(220));
        try {
            const response = await api(`/cursos/${params.id}/matriculados`);
            students = response.data;
            if (activeTab === 'estudiantes') renderTab();
        } catch (error) {
            if (activeTab === 'estudiantes') {
                contentHost.replaceChildren(h('div', { class: 'inline-error' }, errorMessage(error)));
            }
        } finally {
            studentsLoading = false;
        }
    };

    const renderStudents = () => {
        if (students === null) {
            loadStudents();
            return;
        }

        const toolbar = h('div', { class: 'toolbar' },
            h('span', { class: 'muted small' }, `${formatNumber(students.length)} estudiantes en el curso`),
            h('div', { class: 'row' },
                h('button', {
                    class: 'btn secondary', type: 'button',
                    onClick: () => enrollmentModal({ idCurso: course.id_curso, onSaved: () => loadStudents() })
                }, 'Matricular estudiante'),
                h('button', {
                    class: 'btn', type: 'button',
                    onClick: () => csvModal({ idCurso: course.id_curso, onFinished: () => loadStudents() })
                }, 'Carga CSV')));

        if (students.length === 0) {
            contentHost.replaceChildren(toolbar, emptyState('Aún no hay estudiantes matriculados',
                'Puedes matricularlos uno por uno o cargar una lista CSV con sus correos institucionales.'));
            return;
        }

        contentHost.replaceChildren(toolbar, h('div', { class: 'table-wrap' },
            h('table', { class: 'table' },
                h('thead', {}, h('tr', {},
                    h('th', {}, 'Estudiante'),
                    h('th', {}, 'Estado'),
                    h('th', { class: 'num' }, 'XP en curso'),
                    h('th', { class: 'num' }, 'Mundos completados'),
                    h('th', {}, 'Matriculado'))),
                h('tbody', {}, students.map(studentRow)))));
    };

    const renderWorlds = () => {
        const worlds = course.mundos || [];
        if (worlds.length === 0) {
            contentHost.replaceChildren(emptyState('Este curso no tiene mundos', 'Los mundos base deberían crearse junto con el curso.'));
            return;
        }

        contentHost.replaceChildren(
            h('div', { class: 'alert info', style: { marginBottom: '16px' } },
                'Un mundo sin ejercicios no puede completarse: los estudiantes necesitan aprobar todos sus ejercicios para desbloquear el siguiente.'),
            h('div', { class: 'grid cols-3' }, worlds.map(worldCard)));
    };

    const renderTab = () => {
        tabHost.replaceChildren(h('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Secciones del curso' },
            h('button', {
                type: 'button', role: 'tab', 'aria-selected': activeTab === 'mundos' ? 'true' : 'false',
                class: activeTab === 'mundos' ? 'is-active' : '',
                onClick: () => { activeTab = 'mundos'; renderTab(); }
            }, `Mundos (${(course.mundos || []).length})`),
            h('button', {
                type: 'button', role: 'tab', 'aria-selected': activeTab === 'estudiantes' ? 'true' : 'false',
                class: activeTab === 'estudiantes' ? 'is-active' : '',
                onClick: () => { activeTab = 'estudiantes'; renderTab(); }
            }, `Estudiantes${students ? ` (${students.length})` : ''}`)));

        if (!course) return;
        if (activeTab === 'mundos') {
            renderWorlds();
        } else {
            renderStudents();
        }
    };

    const renderHeader = () => {
        headerHost.replaceChildren(h('div', { class: 'page-head' },
            h('div', {},
                h('h1', {}, course.nombre),
                h('p', {}, `${course.codigo_curso} · ${course.periodo} · ${course.institucion_nombre}`)),
            h('div', { class: 'row' },
                statusChip(course.estado),
                h('button', {
                    class: 'btn secondary small', type: 'button',
                    onClick: () => courseFormModal({
                        course,
                        onSaved: () => loadCourse()
                    })
                }, 'Editar curso'),
                h('a', { class: 'btn small', href: `#/cursos/${params.id}/silabo` }, icon('sparkles', 14), 'Sílabo con IA'),
                h('a', { class: 'btn ghost small', href: '#/cursos' }, icon('arrow', 14), 'Volver'))));
    };

    const loadCourse = async () => {
        try {
            const response = await api(`/cursos/${params.id}`);
            course = response.data;
            document.title = `${course.nombre} · codeInt`;
            renderHeader();
            renderTab();
        } catch (error) {
            headerHost.replaceChildren(h('h1', {}, 'No pudimos abrir este curso'));
            tabHost.replaceChildren();
            contentHost.replaceChildren(h('div', { class: 'card' },
                h('div', { class: 'alert error' }, errorMessage(error)),
                h('a', { class: 'btn ghost', href: '#/cursos' }, 'Volver a mis cursos')));
        }
    };

    await loadCourse();
}
