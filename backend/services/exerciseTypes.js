'use strict';

// Tipos de ejercicio que se corrigen en el servidor, sin IA:
//   predecir  - lee un código y escribe qué imprime
//   completar - rellena los huecos (___) de un código
//   ordenar   - ordena las líneas desordenadas de un programa
//   corregir  - arregla un código con errores (se comprueba que aparezcan/desaparezcan fragmentos clave)
// "escribir" es el ejercicio clásico (corrige la IA). `solucion` jamás sale hacia el estudiante.

const { httpError } = require('../utils/httpError');
const { stripComments } = require('./promptGuard');

const TYPES = Object.freeze(['escribir', 'predecir', 'completar', 'ordenar', 'corregir']);
const LOCAL_TYPES = Object.freeze(['predecir', 'completar', 'ordenar', 'corregir']);
const BLANK = '___';
const NOT_PERFECT_CAP = 69; // ordenar, predecir y corregir solo aprueban si todo está bien

const bad = (message) => httpError(400, message, 'INVALID_EXERCISE_TYPE');

// keepIndent: conserva la sangría inicial (líneas de código de "ordenar"); solo se quita el final.
const text = (value, label, { min = 1, max, multiline = false, keepIndent = false } = {}) => {
    if (typeof value !== 'string') throw bad(`${label} debe ser texto.`);
    const stripped = value.replace(/\r\n?/g, '\n').replace(multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g : /[\u0000-\u001F]/g, '');
    const clean = multiline || keepIndent ? stripped.trimEnd() : stripped.trim();
    if (clean.trim().length < min || clean.length > max) throw bad(`${label} debe tener entre ${min} y ${max} caracteres.`);
    return clean;
};

const stringList = (value, label, { min = 0, max, itemMax, keepIndent = false }) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) throw bad(`${label} debe tener entre ${min} y ${max} elementos.`);
    return value.map((item, index) => text(item, `${label} #${index + 1}`, { min: 1, max: itemMax, keepIndent }));
};

// Normaliza respuestas de texto para comparar: minúsculas, espacios colapsados, comillas externas fuera.
const normalizeAnswer = (value) => String(value ?? '')
    .normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim().replace(/^(["'`])(.*)\1$/, '$2').trim();

const countBlanks = (code) => code.split(BLANK).length - 1;

// Valida y limpia lo que el docente guarda. Devuelve { tipo, material, solucion }.
const validateTypedExercise = ({ tipo, material, solucion }) => {
    if (!TYPES.includes(tipo)) throw bad('El tipo de ejercicio no es válido.');
    if (tipo === 'escribir') return { tipo, material: null, solucion: null };
    if (!material || typeof material !== 'object' || !solucion || typeof solucion !== 'object') {
        throw bad('Este tipo de ejercicio necesita material y solución.');
    }

    if (tipo === 'predecir') {
        return {
            tipo,
            material: {
                codigo: text(material.codigo, 'El código', { max: 3000, multiline: true }),
                pregunta: material.pregunta ? text(material.pregunta, 'La pregunta', { max: 300 }) : '¿Qué muestra este programa?'
            },
            solucion: {
                respuesta: text(solucion.respuesta, 'La respuesta', { max: 200 }),
                alternativas: solucion.alternativas ? stringList(solucion.alternativas, 'Las alternativas', { max: 5, itemMax: 200 }) : []
            }
        };
    }

    if (tipo === 'completar') {
        const codigo = text(material.codigo, 'El código', { max: 3000, multiline: true });
        const blanks = countBlanks(codigo);
        if (blanks < 1 || blanks > 8) throw bad(`El código debe tener entre 1 y 8 huecos marcados con ${BLANK}.`);
        if (!Array.isArray(solucion.huecos) || solucion.huecos.length !== blanks) {
            throw bad(`Hay ${blanks} hueco(s) en el código: da la respuesta de cada uno.`);
        }
        return {
            tipo,
            material: { codigo },
            solucion: { huecos: solucion.huecos.map((options, index) => stringList(Array.isArray(options) ? options : [options], `Respuestas del hueco ${index + 1}`, { min: 1, max: 5, itemMax: 100 })) }
        };
    }

    if (tipo === 'ordenar') {
        const lineas = stringList(solucion.lineas, 'Las líneas', { min: 3, max: 15, itemMax: 200, keepIndent: true });
        if (new Set(lineas).size < 2) throw bad('Las líneas no pueden ser todas iguales.');
        return { tipo, material: {}, solucion: { lineas } };
    }

    // corregir
    const debe = stringList(solucion.debe_contener ?? [], 'Lo que debe contener', { max: 8, itemMax: 150 });
    const noDebe = stringList(solucion.no_debe_contener ?? [], 'Lo que no debe contener', { max: 8, itemMax: 150 });
    if (debe.length + noDebe.length === 0) throw bad('Indica al menos una comprobación (qué debe o no debe contener el código corregido).');
    return {
        tipo,
        material: { codigo: text(material.codigo, 'El código con errores', { max: 4000, multiline: true }) },
        solucion: { debe_contener: debe, no_debe_contener: noDebe }
    };
};

const shuffled = (items, avoid) => {
    let copy = [...items];
    for (let attempt = 0; attempt < 6; attempt += 1) {
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        if (!avoid || copy.join('\n') !== avoid.join('\n')) break;
    }
    return copy;
};

// Lo que el estudiante puede ver. `solucion` nunca se incluye.
const publicMaterial = (tipo, material, solucion) => {
    if (!material || tipo === 'escribir') return null;
    if (tipo === 'ordenar') return { lineas: shuffled(solucion.lineas, solucion.lineas) };
    if (tipo === 'completar') return { codigo: material.codigo, huecos: countBlanks(material.codigo) };
    return { ...material };
};

// Convierte lo que envía el estudiante en el texto que se guarda (columna codigo_pseint, máx. 12000).
const readAnswer = (tipo, body) => {
    if (tipo === 'predecir') {
        if (typeof body?.respuesta !== 'string') throw httpError(400, 'Escribe tu respuesta.', 'ANSWER_REQUIRED');
        return text(body.respuesta, 'La respuesta', { max: 500 });
    }
    if (tipo === 'completar' || tipo === 'ordenar') {
        const max = tipo === 'completar' ? 8 : 15;
        if (!Array.isArray(body?.respuesta) || body.respuesta.length < 1 || body.respuesta.length > max) {
            throw httpError(400, 'Envía tu respuesta completa.', 'ANSWER_REQUIRED');
        }
        return JSON.stringify(body.respuesta.map((item) => (typeof item === 'string' ? item.replace(/\r\n?/g, '\n').slice(0, 300) : '')));
    }
    throw httpError(400, 'Este tipo de ejercicio no usa respuesta de texto.', 'ANSWER_NOT_SUPPORTED');
};

const result = (puntaje, aciertos, total, feedback) => ({
    puntaje,
    categoria_error: puntaje === 100 ? 'ninguno' : 'logica',
    retroalimentacion: feedback,
    sugerencias: puntaje === 100 ? [] : ['Revisa el enunciado y vuelve a intentarlo: puedes repetirlo las veces que quieras.'],
    eficiencia_algoritmica: 'No aplica: ejercicio de corrección automática.',
    codigo_sugerido_mejora: '',
    intento_manipulacion: false,
    aciertos, total
});

// Corrige un envío. `answer` es el texto guardado (ver readAnswer) o el código en "corregir".
const gradeLocal = ({ tipo, solucion, answer, language = 'pseint' }) => {
    if (tipo === 'predecir') {
        const given = normalizeAnswer(answer);
        const accepted = [solucion.respuesta, ...(solucion.alternativas || [])].map(normalizeAnswer);
        const ok = given.length > 0 && accepted.includes(given);
        return ok
            ? result(100, 1, 1, '¡Correcto! Leíste el código y predijiste bien lo que muestra.')
            : result(0, 0, 1, 'Esa no es la salida del programa. Sigue el código línea por línea, anotando el valor de cada variable.');
    }

    if (tipo === 'completar') {
        let given;
        try { given = JSON.parse(answer); } catch { given = []; }
        const wrong = [];
        solucion.huecos.forEach((options, index) => {
            const value = normalizeAnswer(given[index]);
            if (!options.map(normalizeAnswer).includes(value) || value === '') wrong.push(index + 1);
        });
        const total = solucion.huecos.length;
        const hits = total - wrong.length;
        return wrong.length === 0
            ? result(100, hits, total, '¡Perfecto! Completaste todos los huecos correctamente.')
            : result(Math.round((hits / total) * 100), hits, total,
                `Acertaste ${hits} de ${total} huecos. Revisa el hueco ${wrong.join(', ')}.`);
    }

    if (tipo === 'ordenar') {
        let given;
        try { given = JSON.parse(answer); } catch { given = []; }
        const canon = solucion.lineas;
        const hits = canon.filter((line, index) => given[index] === line).length;
        if (hits === canon.length && given.length === canon.length) {
            return result(100, hits, canon.length, '¡Orden correcto! El programa quedó bien armado.');
        }
        return result(Math.min(NOT_PERFECT_CAP, Math.round((hits / canon.length) * 100)), hits, canon.length,
            `${hits} de ${canon.length} líneas están en su lugar. Piensa qué debe ocurrir primero y qué depende de qué.`);
    }

    // corregir: comprobaciones de fragmentos sobre el código SIN comentarios y sin espacios extra
    // (si no, bastaría con escribir la respuesta dentro de un comentario).
    const flat = normalizeAnswer(stripComments(answer, language)).replace(/\s+/g, '');
    const has = (fragment) => flat.includes(normalizeAnswer(fragment).replace(/\s+/g, ''));
    const checks = [
        ...solucion.debe_contener.map((fragment) => has(fragment)),
        ...solucion.no_debe_contener.map((fragment) => !has(fragment))
    ];
    const hits = checks.filter(Boolean).length;
    return hits === checks.length
        ? result(100, hits, checks.length, '¡Corregido! Encontraste y arreglaste los errores del código.')
        : result(Math.min(NOT_PERFECT_CAP, Math.round((hits / checks.length) * 100)), hits, checks.length,
            `Arreglaste ${hits} de ${checks.length} puntos. Todavía queda algo por corregir: vuelve a leer el código buscando qué no hace lo que dice el enunciado.`);
};

module.exports = {
    TYPES, LOCAL_TYPES, BLANK, NOT_PERFECT_CAP,
    validateTypedExercise, publicMaterial, readAnswer, gradeLocal, normalizeAnswer, countBlanks
};
