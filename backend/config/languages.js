'use strict';

const { validatePseInt } = require('../services/pseintValidator');
const { validatePython, validateJavaScript, validateJava, validateCCpp } = require('../services/codeValidators');

// ==============================================================
// codeInt - Lenguajes de programación soportados por un curso
//
// Cada curso tiene un lenguaje. Aquí vive todo lo que depende de él: nombre, plantilla inicial donde el
// estudiante escribe su desarrollo, nombre para el prompt de la IA y la revisión de sintaxis previa.
// frontend/js/languages.js replica la parte visible; tests/languages.test.js comprueba que coincidan.
// ==============================================================

const LANGUAGES = Object.freeze({
    pseint: {
        id: 'pseint',
        nombre: 'PSeInt',
        extension: 'psc',
        promptName: 'PSeInt (pseudocódigo)',
        plantilla: 'Algoritmo Solucion\n\t// Tu código PSeInt aquí\nFinAlgoritmo',
        validate: validatePseInt
    },
    python: {
        id: 'python',
        nombre: 'Python',
        extension: 'py',
        promptName: 'Python 3',
        plantilla: 'def main():\n    # Tu código aquí\n    pass\n\n\nif __name__ == "__main__":\n    main()\n',
        validate: validatePython
    },
    javascript: {
        id: 'javascript',
        nombre: 'JavaScript',
        extension: 'js',
        promptName: 'JavaScript (Node.js)',
        plantilla: 'function main() {\n  // Tu código aquí\n}\n\nmain();\n',
        validate: validateJavaScript
    },
    java: {
        id: 'java',
        nombre: 'Java',
        extension: 'java',
        promptName: 'Java 17',
        plantilla: 'public class Main {\n    public static void main(String[] args) {\n        // Tu código aquí\n    }\n}\n',
        validate: validateJava
    },
    c_cpp: {
        id: 'c_cpp',
        nombre: 'C / C++',
        extension: 'cpp',
        promptName: 'C/C++',
        plantilla: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Tu código aquí\n    return 0;\n}\n',
        validate: validateCCpp
    }
});

const DEFAULT_LANGUAGE = 'pseint';
const LANGUAGE_IDS = Object.freeze(Object.keys(LANGUAGES));

// Devuelve el lenguaje o el predeterminado si el id es desconocido (cursos anteriores a la migración).
const getLanguage = (id) => LANGUAGES[id] || LANGUAGES[DEFAULT_LANGUAGE];
const isValidLanguage = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGES, id);

// Parte pública (sin funciones) para enviar al cliente.
const publicLanguage = (id) => {
    const { nombre, extension, plantilla } = getLanguage(id);
    return { id: getLanguage(id).id, nombre, extension, plantilla };
};

module.exports = { LANGUAGES, LANGUAGE_IDS, DEFAULT_LANGUAGE, getLanguage, isValidLanguage, publicLanguage };
