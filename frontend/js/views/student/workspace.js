import { h, icon, toast, setBusy, errorMessage, formatDate } from '../../ui.js';
import { api, request, ApiError } from '../../api.js';
import { refreshUser } from '../../state.js';
import { createCodeEditor } from '../../code-editor.js';
import { createSignalTracker } from '../../integrity-signals.js';
import { showEvaluationResult, PASS_SCORE } from './result-modal.js';

const MAX_POLLS = 10;
const POLL_MS = 3000;

const STATE_LABEL = {
    rechazado_local: 'Rechazado',
    pendiente: 'Pendiente',
    procesando: 'Evaluando…',
    completado: 'Evaluado',
    fallido: 'Fallido'
};

// Un envío del historial puede traer el mensaje de validación como JSON serializado.
const parseValidationMessage = (message) => {
    try { return JSON.parse(message); } catch { return null; }
};

export default async function workspaceView({ root, params, user }) {
    const id = params.id;
    const draftKey = `codeint.draft.${user.id_usuario}.${id}`;

    const [{ data: exercise }, historyResponse] = await Promise.all([
        api(`/ejercicios/${id}`),
        api(`/ejercicios/${id}/historial`).catch(() => ({ data: [] }))
    ]);
    document.title = `${exercise.titulo} · codeInt`;

    let history = historyResponse.data;
    let attempt = null; // { key, code }: la misma clave se reutiliza solo para reintentar el mismo código
    let busy = false;
    let pollTimer = null;
    let disposed = false;

    const readDraft = () => { try { return sessionStorage.getItem(draftKey); } catch { return null; } };
    const writeDraft = (text) => { try { sessionStorage.setItem(draftKey, text); } catch { /* almacenamiento bloqueado */ } };

    // El lenguaje es el del curso; si el ejercicio no trae plantilla propia se usa la inicial del lenguaje.
    const language = exercise.lenguaje || { id: 'pseint', nombre: 'PSeInt', plantilla: '' };
    const starterCode = exercise.plantilla_pseint || language.plantilla || '';
    const initialCode = readDraft() ?? exercise.ultimo_envio?.codigo_pseint ?? starterCode;
    const editor = createCodeEditor({
        language: language.id,
        value: initialCode,
        describedBy: 'editor-help',
        onChange: (text) => writeDraft(text)
    });

    const statementElement = h('div', { class: 'statement' }, exercise.enunciado);
    const tracker = createSignalTracker({ editorInput: editor.input, statementElement });
    const problems = h('div', { 'aria-live': 'polite' });
    const historyHost = h('ul', { class: 'history-list' });

    const validateButton = h('button', { class: 'btn ghost', type: 'button' }, icon('check', 16), 'Revisar código');
    const submitButton = h('button', { class: 'btn ai', type: 'button' }, icon('sparkles', 16), 'Enviar a la IA');
    const resetButton = h('button', { class: 'btn ghost small', type: 'button' }, 'Restaurar plantilla');

    const setBusyState = (value) => {
        busy = value;
        validateButton.disabled = value;
        resetButton.disabled = value;
        if (!value) submitButton.disabled = false;
    };

    // ---------- Problemas de validación ----------
    const showProblems = (validation, { markLines = true } = {}) => {
        const errors = validation.errors || [];
        const warnings = validation.warnings || [];
        if (markLines) editor.setMarkers(errors, warnings);

        const lineTag = (item, warn) => h('span', { class: `line-tag${warn ? ' warn' : ''}` }, item.line ? `L${item.line}` : 'Código');
        if (errors.length === 0 && warnings.length === 0) {
            problems.replaceChildren(h('div', { class: 'alert success', role: 'status' },
                icon('check', 18), h('span', {}, 'La estructura es válida. Esta validación es gratuita y no consume tokens de IA.')));
            return;
        }
        problems.replaceChildren(h('div', { class: `alert ${errors.length > 0 ? 'error' : 'warn'}`, role: errors.length > 0 ? 'alert' : 'status' },
            icon('alert', 18),
            h('div', {},
                h('strong', {}, errors.length > 0 ? `${errors.length} problema(s) por corregir` : 'Advertencias'),
                h('ul', { class: 'problems', style: { marginTop: '8px' } },
                    errors.map((item) => h('li', {}, lineTag(item, false), h('span', {}, item.message))),
                    warnings.map((item) => h('li', {}, lineTag(item, true), h('span', {}, item.message)))))));
    };

    const validateLocally = async () => {
        const { body } = await request(`/ejercicios/${id}/validar`, { method: 'POST', body: { codigo_pseint: editor.getValue() } });
        return body.validacion;
    };

    // ---------- Historial ----------
    const renderHistory = () => {
        if (history.length === 0) {
            historyHost.replaceChildren(h('li', { class: 'small muted' }, 'Todavía no has enviado este ejercicio.'));
            return;
        }
        historyHost.replaceChildren(...history.slice(0, 15).map((item) => {
            const evaluated = item.puntaje !== null && item.puntaje !== undefined;
            return h('li', {}, h('button', {
                class: 'history-item', type: 'button',
                onClick: () => {
                    editor.setValue(item.codigo_pseint);
                    const validation = parseValidationMessage(item.mensaje_sintaxis);
                    if (!item.sintaxis_valida && validation) {
                        showProblems({ errors: validation.errores, warnings: validation.advertencias });
                    } else {
                        problems.replaceChildren();
                    }
                    if (evaluated) showEvaluationResult(item, { onUseCode: (code) => editor.setValue(code) });
                }
            },
            h('span', {}, h('span', { class: 'small' }, formatDate(item.fecha_envio))),
            evaluated
                ? h('span', { class: `chip ${item.puntaje >= PASS_SCORE ? 'green' : 'red'}` }, `${item.puntaje}/100`)
                : h('span', { class: 'chip' }, STATE_LABEL[item.estado_evaluacion] || item.estado_evaluacion)));
        }));
    };

    const reloadHistory = async () => {
        try { history = (await api(`/ejercicios/${id}/historial`)).data; } catch { /* se conserva la lista actual */ }
        if (!disposed) renderHistory();
    };

    // ---------- Acciones ----------
    validateButton.addEventListener('click', async () => {
        if (!editor.getValue().trim()) return toast('Escribe tu algoritmo antes de validarlo.');
        setBusyState(true);
        setBusy(validateButton, true, 'Validando…');
        try {
            showProblems(await validateLocally());
        } catch (error) {
            toast(errorMessage(error), 'error');
        } finally {
            setBusy(validateButton, false);
            setBusyState(false);
        }
    });

    resetButton.addEventListener('click', () => {
        editor.setValue(starterCode);
        problems.replaceChildren();
        attempt = null;
    });

    const finishWithResult = async (data) => {
        attempt = null;
        showEvaluationResult(data, { onUseCode: (code) => editor.setValue(code) });
        await Promise.all([reloadHistory(), refreshUser().catch(() => {})]);
    };

    // El servidor aún está evaluando (202): se consulta el historial hasta que termine.
    const pollEvaluation = (submissionId, count = 0) => {
        pollTimer = setTimeout(async () => {
            if (disposed) return;
            await reloadHistory();
            const current = history.find((item) => item.id_envio_ejercicio === submissionId);
            if (current && current.estado_evaluacion === 'completado' && current.puntaje !== null) {
                toast('Tu evaluación terminó.', 'success');
                attempt = null;
                refreshUser().catch(() => {});
                showEvaluationResult(current, { onUseCode: (code) => editor.setValue(code) });
            } else if (current && current.estado_evaluacion === 'fallido') {
                attempt = null;
                toast('La evaluación no se pudo completar. Inténtalo de nuevo.', 'error');
            } else if (count < MAX_POLLS) {
                pollEvaluation(submissionId, count + 1);
            }
        }, POLL_MS);
    };

    submitButton.addEventListener('click', async () => {
        if (busy) return;
        const code = editor.getValue();
        if (!code.trim()) return toast('Escribe tu algoritmo antes de enviarlo.');

        setBusyState(true);
        setBusy(submitButton, true, 'Evaluando con IA…');
        validateButton.disabled = true;
        try {
            // 1) Validación local gratuita: un código inválido nunca llega a la IA.
            const validation = await validateLocally();
            showProblems(validation);
            if (!validation.valid) {
                toast('Corrige los errores marcados antes de enviar a la IA.', 'error');
                return;
            }

            // 2) Envío idempotente: una clave nueva por cada código distinto.
            if (!attempt || attempt.code !== code) attempt = { key: crypto.randomUUID(), code };
            const { status, body } = await request(`/ejercicios/${id}/envios`, {
                method: 'POST',
                headers: { 'Idempotency-Key': attempt.key },
                body: { codigo_pseint: code, senales: tracker.snapshot() }
            });

            if (status === 202) {
                toast('La evaluación sigue en proceso…');
                pollEvaluation(body.data.id_envio_ejercicio);
                return;
            }
            await finishWithResult(body.data);
        } catch (error) {
            if (!(error instanceof ApiError)) {
                // Sin respuesta del servidor: se conserva la clave para reintentar sin cobrar dos veces.
                toast('Sin conexión con el servidor. Vuelve a pulsar «Enviar» para reintentar.', 'error');
                return;
            }
            attempt = null;
            if (error.status === 422) {
                const body = error.body;
                showProblems(body.validacion || { errors: [{ message: body.message }] });
                toast('El código no superó la validación local.', 'error');
            } else if (error.code === 'AI_QUOTA_UNAVAILABLE') {
                problems.replaceChildren(h('div', { class: 'alert error', role: 'alert' }, icon('alert', 18),
                    h('span', {}, 'Tu docente no tiene cuota de IA disponible por ahora. Puedes seguir validando tu código gratis.')));
            } else if ([502, 503, 504].includes(error.status)) {
                problems.replaceChildren(h('div', { class: 'alert error', role: 'alert' }, icon('alert', 18),
                    h('span', {}, 'El servicio de IA no respondió. No se descontó tu intento: inténtalo de nuevo en unos segundos.')));
            } else {
                toast(errorMessage(error), 'error');
            }
            reloadHistory();
        } finally {
            setBusy(submitButton, false);
            setBusyState(false);
        }
    });

    // ---------- Montaje ----------
    renderHistory();
    const passed = history.some((item) => item.puntaje >= PASS_SCORE);
    root.append(h('div', { class: 'container' },
        h('nav', { class: 'breadcrumb', 'aria-label': 'Ruta' },
            h('a', { href: '#/' }, 'Inicio'), ' / ', h('a', { href: `#/curso/${exercise.id_curso}` }, exercise.curso_nombre),
            ' / ', h('a', { href: `#/mundo/${exercise.id_mundo}` }, `Mundo ${exercise.mundo_orden}`)),
        h('div', { class: 'workspace' },
            h('aside', { class: 'workspace-side stack' },
                h('section', { class: 'card' },
                    h('h1', { style: { fontSize: '1.4rem' } }, exercise.titulo),
                    h('div', { class: 'row', style: { marginBottom: '12px' } },
                        h('span', { class: 'chip blue' }, `Mundo ${exercise.mundo_orden}: ${exercise.mundo_nombre}`),
                        h('span', { class: 'chip xp' }, icon('bolt', 13), `${exercise.xp_recompensa} XP`),
                        passed ? h('span', { class: 'chip green' }, icon('check', 13), 'Aprobado') : null),
                    statementElement),
                h('section', { class: 'card' },
                    h('div', { class: 'card-title' }, h('h2', { style: { fontSize: '1.05rem' } }, 'Mis intentos')),
                    historyHost)),
            h('section', { class: 'stack' },
                h('div', { class: 'card editor-card' },
                    h('div', { class: 'editor-bar' },
                        h('strong', {}, `Editor ${language.nombre}`),
                        h('span', { class: `chip lang-${language.id}` }, language.nombre),
                        resetButton),
                    editor.element,
                    h('div', { class: 'editor-bar', style: { borderTop: '1px solid var(--border)', borderBottom: 0 } },
                        h('span', { id: 'editor-help', class: 'hint' }, 'Tab inserta sangría · Esc y luego Tab sale del editor. Al enviar se registra si pegaste texto o saliste de la pestaña, para que tu docente pueda revisar.'),
                        h('div', { class: 'row' }, validateButton, submitButton))),
                problems))));

    return () => {
        disposed = true;
        if (pollTimer) clearTimeout(pollTimer);
    };
}
