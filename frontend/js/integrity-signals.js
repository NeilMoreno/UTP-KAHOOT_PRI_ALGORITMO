// Señales de integridad académica del editor: cuántas veces se pegó texto, cuánto, cuántas veces se salió de la
// pestaña y cuánto tiempo, si se copió el enunciado y cuánto tiempo estuvo abierto el ejercicio.
// Solo cuenta; nunca guarda el contenido pegado. Se envían con el código y el docente las revisa: no bloquean
// nada al estudiante. El navegador no es un examen supervisado, así que esto es evidencia, no una prueba.

export const createSignalTracker = ({ editorInput, statementElement }) => {
    const startedAt = Date.now();
    const state = {
        pegados: 0, chars_pegados: 0, max_pegado: 0, cambios_foco: 0, segundos_fuera: 0,
        copias_enunciado: 0, pulsaciones: 0
    };
    let awaySince = null;

    const leave = () => { if (awaySince === null) { awaySince = Date.now(); state.cambios_foco += 1; } };
    const back = () => { if (awaySince !== null) { state.segundos_fuera += (Date.now() - awaySince) / 1000; awaySince = null; } };

    const onVisibility = () => (document.hidden ? leave() : back());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', leave);
    window.addEventListener('focus', back);

    editorInput.addEventListener('paste', (event) => {
        const text = event.clipboardData?.getData('text') || '';
        state.pegados += 1;
        state.chars_pegados += text.length;
        state.max_pegado = Math.max(state.max_pegado, text.length);
    });
    editorInput.addEventListener('keydown', (event) => {
        if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Enter') state.pulsaciones += 1;
    });
    statementElement?.addEventListener('copy', () => { state.copias_enunciado += 1; });

    return {
        // Foto de las señales en este momento (el servidor las acota de nuevo).
        snapshot() {
            back();
            return { ...state, segundos_fuera: Math.round(state.segundos_fuera), segundos_abierto: Math.round((Date.now() - startedAt) / 1000) };
        },
        destroy() {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('blur', leave);
            window.removeEventListener('focus', back);
        }
    };
};
