'use strict';

const vm = require('node:vm');

// ==============================================================
// codeInt - Revisión básica de sintaxis para Python, JavaScript, Java y C/C++
//
// Es una revisión LIGERA previa a la IA (que es quien evalúa la lógica). Solo se devuelve como error
// lo que es seguro que está mal (delimitadores sin cerrar, comillas sin cerrar, falta de ":" en Python,
// error de compilación de JavaScript). Lo dudoso va como advertencia y NUNCA bloquea el envío.
// Nada de lo que se revisa aquí se ejecuta.
// ==============================================================

const DEFAULT_MAX_CODE_LENGTH = 12000;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const OPENERS = { '(': ')', '[': ']', '{': '}' };
const CLOSERS = { ')': '(', ']': '[', '}': '{' };
const MAX_REPORTED = 5;

const issue = (code, line, message) => ({ code, line, message });

// Comprobaciones comunes a todos los lenguajes. Devuelve { code, errors, warnings } o un resultado final.
const prepare = (source, options = {}) => {
    const errors = [];
    const warnings = [];
    if (typeof source !== 'string') {
        return { done: { valid: false, errors: [issue('CODE_REQUIRED', null, 'El código debe enviarse como texto.')], warnings, summary: 'El código no tiene un formato válido.' } };
    }
    const code = source.replace(/\r\n?/g, '\n');
    if (!code.trim()) {
        return { done: { valid: false, errors: [issue('CODE_EMPTY', null, 'El código no puede estar vacío.')], warnings, summary: 'El código está vacío.' } };
    }
    const configured = Number.parseInt(options.maxLength, 10);
    const maxLength = Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_CODE_LENGTH;
    if (code.length > maxLength) errors.push(issue('CODE_TOO_LONG', null, `El código supera el máximo permitido de ${maxLength} caracteres.`));
    if (CONTROL_CHARACTERS.test(code)) errors.push(issue('CONTROL_CHARACTERS', null, 'El código contiene caracteres de control no permitidos.'));
    return { code, errors, warnings };
};

const finish = (errors, warnings) => ({
    valid: errors.length === 0,
    errors,
    warnings,
    summary: errors.length === 0
        ? (warnings.length === 0 ? 'La revisión básica no encontró errores de sintaxis. La IA evaluará la lógica.' : 'Sin errores de sintaxis evidentes, pero hay advertencias.')
        : `La revisión encontró ${errors.length} ${errors.length === 1 ? 'problema' : 'problemas'} de sintaxis.`
});

/**
 * Recorre el código respetando comentarios y cadenas. Devuelve { errors, clean } donde `clean` es el código
 * con los comentarios y el interior de las cadenas reemplazados por espacios (misma longitud y mismas líneas),
 * útil para comprobaciones posteriores sin falsos positivos.
 */
const scan = (code, config) => {
    const errors = [];
    const delimiterErrors = [];
    const stack = [];
    const clean = code.split('');
    let line = 1;
    let i = 0;
    let lineStart = true; // ¿solo hubo espacios desde el inicio de la línea? (directivas de C)

    const blank = (from, to) => { for (let k = from; k < to; k += 1) if (clean[k] !== '\n') clean[k] = ' '; };
    const startsWith = (token) => token && code.startsWith(token, i);
    const countLines = (from, to) => { let n = 0; for (let k = from; k < to; k += 1) if (code[k] === '\n') n += 1; return n; };

    while (i < code.length) {
        const ch = code[i];

        if (ch === '\n') { line += 1; i += 1; lineStart = true; continue; }
        if (ch === ' ' || ch === '\t') { i += 1; continue; }

        // Directivas del preprocesador de C/C++ (#include, #define…): no se analizan.
        if (config.preprocessor && ch === '#' && lineStart) {
            let end = code.indexOf('\n', i);
            // una directiva puede continuar con "\" al final de la línea
            while (end > 0 && code[end - 1] === '\\') end = code.indexOf('\n', end + 1);
            if (end === -1) end = code.length;
            blank(i, end);
            line += countLines(i, end);
            i = end;
            continue;
        }
        lineStart = false;

        if (config.blockComment && startsWith(config.blockComment[0])) {
            const end = code.indexOf(config.blockComment[1], i + config.blockComment[0].length);
            const stop = end === -1 ? code.length : end + config.blockComment[1].length;
            if (end === -1) errors.push(issue('UNTERMINATED_COMMENT', line, `El comentario iniciado en la línea ${line} no se cierra.`));
            blank(i, stop);
            line += countLines(i, stop);
            i = stop;
            continue;
        }
        if (config.lineComment && startsWith(config.lineComment)) {
            let end = code.indexOf('\n', i);
            if (end === -1) end = code.length;
            blank(i, end);
            i = end;
            continue;
        }

        // Cadenas de varias líneas (""" y ''' en Python, """ en Java).
        const triple = (config.triple || []).find((token) => startsWith(token));
        if (triple) {
            const end = code.indexOf(triple, i + 3);
            if (end === -1) {
                errors.push(issue('UNTERMINATED_STRING', line, `La cadena de varias líneas iniciada en la línea ${line} no se cierra.`));
                blank(i + 3, code.length);
                i = code.length;
                continue;
            }
            blank(i + 3, end);
            line += countLines(i, end + 3);
            i = end + 3;
            continue;
        }

        // C++: cadenas crudas R"delim( ... )delim"
        if (config.rawStrings && ch === '"' && code[i - 1] === 'R') {
            const open = code.indexOf('(', i + 1);
            const delimiter = open === -1 ? null : code.slice(i + 1, open);
            if (delimiter !== null && delimiter.length <= 16 && !/[\s\\)"]/.test(delimiter)) {
                const closeToken = `)${delimiter}"`;
                const end = code.indexOf(closeToken, open + 1);
                if (end !== -1) {
                    blank(open + 1, end);
                    line += countLines(i, end + closeToken.length);
                    i = end + closeToken.length;
                    continue;
                }
            }
        }

        if (config.strings.includes(ch)) {
            // Separador de dígitos de C++14 (1'000'000) no es una cadena.
            if (ch === "'" && config.digitSeparators && /[0-9a-fA-F]/.test(code[i - 1] || '') && /[0-9a-fA-F]/.test(code[i + 1] || '')) { i += 1; continue; }
            let j = i + 1;
            let closed = false;
            while (j < code.length) {
                if (code[j] === '\\') { j += 2; continue; } // escape (también salta un salto de línea escapado)
                if (code[j] === '\n') break;
                if (code[j] === ch) { closed = true; break; }
                j += 1;
            }
            if (!closed) {
                errors.push(issue('UNTERMINATED_STRING', line, `Falta cerrar las comillas (${ch}) abiertas en la línea ${line}.`));
                blank(i + 1, Math.min(j, code.length));
                i = Math.min(j, code.length);
                continue;
            }
            blank(i + 1, j);
            line += countLines(i, j);
            i = j + 1;
            continue;
        }

        if (OPENERS[ch]) {
            stack.push({ char: ch, line });
        } else if (CLOSERS[ch]) {
            const top = stack[stack.length - 1];
            if (top && top.char === CLOSERS[ch]) {
                stack.pop();
            } else if (!stack.some((open) => open.char === CLOSERS[ch])) {
                // No hay nada de ese tipo abierto: es un cierre de más, y no debe desordenar los demás.
                delimiterErrors.push(issue('UNEXPECTED_CLOSER', line, `Sobra un "${ch}" en la línea ${line}: no hay nada que cerrar.`));
            } else {
                delimiterErrors.push(issue('MISMATCHED_DELIMITER', line, `El "${ch}" de la línea ${line} no corresponde al "${top.char}" abierto en la línea ${top.line}.`));
                stack.pop();
            }
        }
        i += 1;
    }

    for (const open of stack) {
        delimiterErrors.push(issue('UNCLOSED_DELIMITER', open.line, `Falta cerrar el "${open.char}" abierto en la línea ${open.line} (se esperaba "${OPENERS[open.char]}").`));
    }
    // Si hay una cadena o un comentario sin cerrar, los delimitadores "desbalanceados" son solo un efecto de eso.
    return { errors: (errors.length > 0 ? errors : delimiterErrors).slice(0, MAX_REPORTED), clean: clean.join('') };
};

// ---------------------------------------------------------------- Python
const BLOCK_STATEMENT = /^(?:async\s+)?(?:def|class|if|elif|else|for|while|try|except|finally|with)\b/;

const pythonChecks = (clean, errors, warnings) => {
    const lines = clean.split('\n');
    const indentChars = new Set();
    for (const text of lines) {
        const indent = /^[ \t]*/.exec(text)[0];
        if (text.trim() && indent) indent.split('').forEach((ch) => indentChars.add(ch));
        if (/^\s*print\s+["'\w]/.test(text) && !/^\s*print\s*\(/.test(text)) {
            warnings.push(issue('PY2_PRINT', lines.indexOf(text) + 1, 'En Python 3 print es una función: usa print(...).'));
            break;
        }
    }
    const mixed = indentChars.has('\t') && indentChars.has(' ');
    if (mixed) warnings.push(issue('MIXED_INDENT', null, 'Mezclas tabuladores y espacios en la sangría; usa solo uno.'));

    // Líneas lógicas: se unen las que quedan dentro de paréntesis/corchetes/llaves abiertos o terminan en "\".
    const logical = [];
    let depth = 0;
    let current = null;
    lines.forEach((text, index) => {
        if (current === null) {
            if (!text.trim()) return;
            current = { start: index + 1, indent: /^[ \t]*/.exec(text)[0].length, text: '' };
        }
        current.text += `${text}\n`;
        for (const ch of text) {
            if (OPENERS[ch]) depth += 1;
            else if (CLOSERS[ch]) depth = Math.max(0, depth - 1);
        }
        if (depth === 0 && !/\\\s*$/.test(text)) { logical.push(current); current = null; }
    });
    if (current) logical.push(current);

    const topLevelColon = (text) => {
        let level = 0;
        for (const ch of text) {
            if (OPENERS[ch]) level += 1;
            else if (CLOSERS[ch]) level = Math.max(0, level - 1);
            else if (ch === ':' && level === 0) return true;
        }
        return false;
    };

    const levels = [0];
    let expectIndentAfter = null;
    for (const entry of logical) {
        const body = entry.text.trim();
        const startsBlock = BLOCK_STATEMENT.test(body);
        if (startsBlock && !topLevelColon(body)) {
            errors.push(issue('MISSING_COLON', entry.start, `Falta ":" al final de la sentencia de la línea ${entry.start}.`));
            continue;
        }
        if (!mixed) {
            if (expectIndentAfter) {
                if (entry.indent <= expectIndentAfter.indent) {
                    errors.push(issue('EXPECTED_INDENT', entry.start, `Se esperaba un bloque con sangría después de la línea ${expectIndentAfter.line}.`));
                } else {
                    levels.push(entry.indent);
                }
                expectIndentAfter = null;
            } else if (entry.indent > levels[levels.length - 1]) {
                errors.push(issue('UNEXPECTED_INDENT', entry.start, `Sangría inesperada en la línea ${entry.start}.`));
            }
            while (levels.length > 1 && entry.indent < levels[levels.length - 1]) levels.pop();
            if (entry.indent !== levels[levels.length - 1] && !errors.some((e) => e.line === entry.start)) {
                errors.push(issue('INCONSISTENT_DEDENT', entry.start, `La sangría de la línea ${entry.start} no coincide con ningún bloque anterior.`));
            }
        }
        if (!mixed && /:\s*$/.test(body)) expectIndentAfter = { line: entry.start, indent: entry.indent };
    }
    if (expectIndentAfter) {
        errors.push(issue('EXPECTED_INDENT', expectIndentAfter.line, `Falta el bloque con sangría después de la línea ${expectIndentAfter.line}.`));
    }
};

const validatePython = (source, options) => {
    const prepared = prepare(source, options);
    if (prepared.done) return prepared.done;
    const { code, errors, warnings } = prepared;
    const scanned = scan(code, { lineComment: '#', strings: ['"', "'"], triple: ['"""', "'''"] });
    errors.push(...scanned.errors);
    if (scanned.errors.length === 0) pythonChecks(scanned.clean, errors, warnings);
    return finish(errors.slice(0, MAX_REPORTED), warnings);
};

// ------------------------------------------------------------ JavaScript
// vm.Script solo COMPILA (no ejecuta nada). Los errores propios de módulos ES son válidos en un archivo .mjs,
// así que se avisan pero no bloquean.
const MODULE_ONLY = /Cannot use import statement outside a module|Unexpected token 'export'|Cannot use 'import\.meta'|await is only valid|Unexpected reserved word/;

const validateJavaScript = (source, options) => {
    const prepared = prepare(source, options);
    if (prepared.done) return prepared.done;
    const { code, errors, warnings } = prepared;
    if (errors.length === 0) {
        try {
            // eslint-disable-next-line no-new
            new vm.Script(code, { filename: 'codigo.js' });
        } catch (error) {
            const match = /codigo\.js:(\d+)/.exec(String(error.stack || ''));
            const line = match ? Number(match[1]) : null;
            const detail = String(error.message || 'Error de sintaxis');
            if (MODULE_ONLY.test(detail)) {
                warnings.push(issue('MODULE_SYNTAX', line, 'Usas sintaxis de módulos (import/export o await de nivel superior): revisa que el entorno la admita.'));
            } else {
                errors.push(issue('SYNTAX_ERROR', line, `Error de sintaxis${line ? ` en la línea ${line}` : ''}: ${detail}`));
            }
        }
    }
    return finish(errors, warnings);
};

// ------------------------------------------------------------- Java / C / C++
const validateJava = (source, options) => {
    const prepared = prepare(source, options);
    if (prepared.done) return prepared.done;
    const { code, errors, warnings } = prepared;
    const scanned = scan(code, { lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'"], triple: ['"""'] });
    errors.push(...scanned.errors);
    if (errors.length === 0 && !/\bclass\b|\binterface\b|\benum\b|\brecord\b/.test(scanned.clean)) {
        warnings.push(issue('NO_CLASS', null, 'No encontré una clase: en Java el código vive dentro de una clase.'));
    }
    return finish(errors.slice(0, MAX_REPORTED), warnings);
};

const validateCCpp = (source, options) => {
    const prepared = prepare(source, options);
    if (prepared.done) return prepared.done;
    const { code, errors, warnings } = prepared;
    const scanned = scan(code, {
        lineComment: '//', blockComment: ['/*', '*/'], strings: ['"', "'"], preprocessor: true, rawStrings: true, digitSeparators: true
    });
    errors.push(...scanned.errors);
    if (errors.length === 0 && !/\bmain\s*\(/.test(scanned.clean)) {
        warnings.push(issue('NO_MAIN', null, 'No encontré la función main().'));
    }
    return finish(errors.slice(0, MAX_REPORTED), warnings);
};

module.exports = { DEFAULT_MAX_CODE_LENGTH, validatePython, validateJavaScript, validateJava, validateCCpp };
