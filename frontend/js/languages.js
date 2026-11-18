// Lenguajes soportados por un curso: parte visible para el cliente (nombre, plantilla inicial, sangría y
// resaltado). La revisión de sintaxis vive en el servidor (backend/config/languages.js);
// tests/languages.test.js comprueba que id, nombre, extensión y plantilla coincidan en ambos lados.

const words = (text) => new Set(text.split(/\s+/).filter(Boolean));

export const DEFAULT_LANGUAGE = 'pseint';

export const LANGUAGES = {
    pseint: {
        id: 'pseint',
        nombre: 'PSeInt',
        extension: 'psc',
        plantilla: 'Algoritmo Solucion\n\t// Tu código PSeInt aquí\nFinAlgoritmo',
        indent: '  ',
        highlight: {
            comment: '\\/\\/.*$',
            strings: ['"', "'"],
            caseInsensitive: true, // PSeInt ignora mayúsculas y tildes
            keywords: words(`algoritmo proceso finalgoritmo finproceso subproceso subalgoritmo funcion finsubproceso finsubalgoritmo
                finfuncion definir como dimension escribir leer si entonces sino finsi segun hacer de otro modo finsegun fin para
                hasta con paso finpara mientras finmientras repetir que retornar esperar tecla limpiar pantalla borrar sin bajar
                saltar por referencia valor y o no mod verdadero falso`),
            types: words('entero real caracter logico texto numero numerico cadena'),
            functions: words(`rc abs trunc redon azar aleatorio longitud subcadena concatenar mayusculas minusculas
                convertiranumero convertiratexto seno coseno tan ln exp`)
        }
    },
    python: {
        id: 'python',
        nombre: 'Python',
        extension: 'py',
        plantilla: 'def main():\n    # Tu código aquí\n    pass\n\n\nif __name__ == "__main__":\n    main()\n',
        indent: '    ',
        highlight: {
            comment: '#.*$',
            strings: ['"', "'"],
            keywords: words(`and as assert async await break class continue def del elif else except finally for from global if
                import in is lambda nonlocal not or pass raise return try while with yield match case True False None`),
            types: words('int float str bool list dict set tuple bytes object'),
            functions: words('print input len range int float str list dict set sum min max abs sorted enumerate zip open map filter round type isinstance')
        }
    },
    javascript: {
        id: 'javascript',
        nombre: 'JavaScript',
        extension: 'js',
        plantilla: 'function main() {\n  // Tu código aquí\n}\n\nmain();\n',
        indent: '  ',
        highlight: {
            comment: '\\/\\/.*$',
            strings: ['"', "'", '`'],
            keywords: words(`async await break case catch class const continue debugger default delete do else export extends finally for
                function if import in instanceof let new of return static super switch this throw try typeof var void while with yield
                true false null undefined`),
            types: words('Array Object String Number Boolean Map Set Promise Date Math JSON'),
            functions: words('console log require parseInt parseFloat setTimeout setInterval fetch')
        }
    },
    java: {
        id: 'java',
        nombre: 'Java',
        extension: 'java',
        plantilla: 'public class Main {\n    public static void main(String[] args) {\n        // Tu código aquí\n    }\n}\n',
        indent: '    ',
        highlight: {
            comment: '\\/\\/.*$',
            strings: ['"', "'"],
            keywords: words(`abstract assert break case catch class const continue default do else enum extends final finally for if
                implements import instanceof interface native new package private protected public return static strictfp super switch
                synchronized this throw throws transient try void volatile while var record true false null`),
            types: words('int long short byte char boolean double float String Integer Double Boolean List Map Set Scanner Math Object'),
            functions: words('println print printf main nextInt nextLine next nextDouble')
        }
    },
    c_cpp: {
        id: 'c_cpp',
        nombre: 'C / C++',
        extension: 'cpp',
        plantilla: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Tu código aquí\n    return 0;\n}\n',
        indent: '    ',
        highlight: {
            comment: '\\/\\/.*$',
            strings: ['"', "'"],
            wordStart: '#A-Za-z_', // las directivas (#include) se resaltan como palabras clave
            keywords: words(`auto break case const continue default do else enum extern for goto if inline namespace new delete register
                return sizeof static struct switch typedef union using volatile while class public private protected template typename
                try catch throw true false nullptr #include #define #ifdef #ifndef #endif #pragma`),
            types: words('int long short char float double void bool unsigned signed string vector size_t'),
            functions: words('printf scanf puts gets cout cin cerr endl main malloc free strlen strcpy')
        }
    }
};

export const LANGUAGE_IDS = Object.keys(LANGUAGES);
export const isValidLanguage = (id) => Object.prototype.hasOwnProperty.call(LANGUAGES, id);
// Desconocido o ausente (cursos anteriores) → PSeInt.
export const getLanguage = (id) => LANGUAGES[id] || LANGUAGES[DEFAULT_LANGUAGE];
