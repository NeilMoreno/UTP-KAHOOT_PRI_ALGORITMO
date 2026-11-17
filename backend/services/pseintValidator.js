'use strict';

const DEFAULT_MAX_CODE_LENGTH = 12000;

const normalizeForMatching = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const stripLineComment = (line) => {
    let quote = null;
    for (let index = 0; index < line.length - 1; index += 1) {
        const character = line[index];
        if ((character === '"' || character === "'") && line[index - 1] !== '\\') {
            quote = quote === character ? null : (quote || character);
        }
        if (!quote && character === '/' && line[index + 1] === '/') {
            return line.slice(0, index);
        }
    }
    return line;
};

const OPENERS = [
    { type: 'si', pattern: /^si\b.*\bentonces\b/, expected: 'FinSi' },
    { type: 'para', pattern: /^para\b.*\bhacer\b/, expected: 'FinPara' },
    { type: 'mientras', pattern: /^mientras\b.*\bhacer\b/, expected: 'FinMientras' },
    { type: 'repetir', pattern: /^repetir\b/, expected: 'Hasta Que' },
    { type: 'segun', pattern: /^segun\b.*\bhacer\b/, expected: 'FinSegun' },
    { type: 'subproceso', pattern: /^(subproceso|subalgoritmo|funcion)\b/, expected: 'FinSubProceso' }
];

const CLOSERS = [
    { type: 'si', pattern: /^fin\s*si\b/ },
    { type: 'para', pattern: /^fin\s*para\b/ },
    { type: 'mientras', pattern: /^fin\s*mientras\b/ },
    { type: 'repetir', pattern: /^hasta\s+que\b/ },
    { type: 'segun', pattern: /^fin\s*segun\b/ },
    { type: 'subproceso', pattern: /^fin\s*(subproceso|subalgoritmo|funcion)\b/ }
];

const validatePseInt = (source, options = {}) => {
    const configuredLimit = Number.parseInt(options.maxLength, 10);
    const maxLength = Number.isInteger(configuredLimit) && configuredLimit > 0
        ? configuredLimit
        : DEFAULT_MAX_CODE_LENGTH;
    const errors = [];
    const warnings = [];

    if (typeof source !== 'string') {
        return {
            valid: false,
            errors: [{ code: 'CODE_REQUIRED', line: null, message: 'El código PSeInt debe enviarse como texto.' }],
            warnings,
            summary: 'El código PSeInt no tiene un formato válido.'
        };
    }

    const code = source.replace(/\r\n?/g, '\n');
    if (!code.trim()) {
        return {
            valid: false,
            errors: [{ code: 'CODE_EMPTY', line: null, message: 'El código PSeInt no puede estar vacío.' }],
            warnings,
            summary: 'El código PSeInt está vacío.'
        };
    }

    if (code.length > maxLength) {
        errors.push({
            code: 'CODE_TOO_LONG',
            line: null,
            message: `El código supera el máximo permitido de ${maxLength} caracteres.`
        });
    }

    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(code)) {
        errors.push({
            code: 'CONTROL_CHARACTERS',
            line: null,
            message: 'El código contiene caracteres de control no permitidos.'
        });
    }

    const meaningfulLines = code.split('\n')
        .map((raw, index) => ({ raw, line: index + 1, normalized: normalizeForMatching(stripLineComment(raw)) }))
        .filter(entry => entry.normalized.length > 0);

    const programStarts = meaningfulLines.filter(entry => /^(algoritmo|proceso)\b/.test(entry.normalized));
    const programEnds = meaningfulLines.filter(entry => /^fin\s*(algoritmo|proceso)\b/.test(entry.normalized));

    if (programStarts.length !== 1) {
        errors.push({
            code: 'PROGRAM_START_COUNT',
            line: programStarts[1]?.line || null,
            message: programStarts.length === 0
                ? 'Debe existir una declaración Algoritmo o Proceso.'
                : 'Solo puede existir un Algoritmo o Proceso principal.'
        });
    }
    if (programEnds.length !== 1) {
        errors.push({
            code: 'PROGRAM_END_COUNT',
            line: programEnds[1]?.line || null,
            message: programEnds.length === 0
                ? 'Debe cerrar el programa con FinAlgoritmo o FinProceso.'
                : 'Solo puede existir un cierre del programa principal.'
        });
    }
    if (programStarts.length === 1 && programEnds.length === 1) {
        const startedAs = programStarts[0].normalized.match(/^(algoritmo|proceso)\b/)[1];
        const endedAs = programEnds[0].normalized.match(/^fin\s*(algoritmo|proceso)\b/)[1];
        if (programStarts[0].line >= programEnds[0].line) {
            errors.push({
                code: 'PROGRAM_ORDER',
                line: programEnds[0].line,
                message: 'El cierre del programa debe aparecer después de su declaración.'
            });
        }
        if (startedAs !== endedAs) {
            errors.push({
                code: 'PROGRAM_END_MISMATCH',
                line: programEnds[0].line,
                message: `El programa inicia con ${startedAs === 'algoritmo' ? 'Algoritmo' : 'Proceso'} y debe usar el cierre correspondiente.`
            });
        }
    }

    const stack = [];
    for (const entry of meaningfulLines) {
        if (/^(algoritmo|proceso|fin\s*(algoritmo|proceso))\b/.test(entry.normalized)) continue;

        const closer = CLOSERS.find(candidate => candidate.pattern.test(entry.normalized));
        if (closer) {
            const opened = stack.at(-1);
            if (!opened) {
                errors.push({
                    code: 'UNEXPECTED_CLOSER',
                    line: entry.line,
                    message: `Se encontró un cierre de ${closer.type} sin una estructura abierta.`
                });
            } else if (opened.type !== closer.type) {
                errors.push({
                    code: 'MISMATCHED_CLOSER',
                    line: entry.line,
                    message: `Cierre fuera de orden: primero debe cerrar ${opened.expected}, abierto en la línea ${opened.line}.`
                });
            } else {
                stack.pop();
            }
            continue;
        }

        const opener = OPENERS.find(candidate => candidate.pattern.test(entry.normalized));
        if (opener) stack.push({ type: opener.type, expected: opener.expected, line: entry.line });
    }

    for (const opened of stack.reverse()) {
        errors.push({
            code: 'UNCLOSED_STRUCTURE',
            line: opened.line,
            message: `Falta ${opened.expected} para la estructura abierta en la línea ${opened.line}.`
        });
    }

    if (meaningfulLines.length <= 2 && programStarts.length === 1 && programEnds.length === 1) {
        warnings.push({
            code: 'EMPTY_PROGRAM',
            line: programStarts[0].line,
            message: 'El programa no contiene instrucciones ejecutables.'
        });
    }

    const valid = errors.length === 0;
    return {
        valid,
        errors,
        warnings,
        summary: valid
            ? 'La estructura básica de PSeInt es válida.'
            : `Se encontraron ${errors.length} error(es) estructural(es).`
    };
};

module.exports = {
    DEFAULT_MAX_CODE_LENGTH,
    validatePseInt
};
