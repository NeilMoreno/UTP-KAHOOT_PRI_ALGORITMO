'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LANGUAGES } = require('../backend/config/languages');
const v = require('../backend/services/codeValidators');

const codes = (result) => result.errors.map((error) => error.code);
const lineOf = (result, code) => result.errors.find((error) => error.code === code)?.line;

// ------------------------------------------------------------------ comunes
test('todas las validaciones devuelven la misma forma y rechazan vacío, no-texto y exceso de longitud', () => {
    for (const validate of [v.validatePython, v.validateJavaScript, v.validateJava, v.validateCCpp]) {
        assert.deepEqual(codes(validate('   \n  ')), ['CODE_EMPTY']);
        assert.deepEqual(codes(validate(undefined)), ['CODE_REQUIRED']);
        assert.deepEqual(codes(validate(42)), ['CODE_REQUIRED']);
        assert.ok(codes(validate('x'.repeat(50), { maxLength: 10 })).includes('CODE_TOO_LONG'));
        assert.ok(codes(validate('a\u0000b')).includes('CONTROL_CHARACTERS'));
        const ok = validate('x');
        assert.ok('valid' in ok && Array.isArray(ok.errors) && Array.isArray(ok.warnings) && typeof ok.summary === 'string');
    }
});

test('las plantillas iniciales de cada lenguaje pasan su propia revisión', () => {
    for (const language of Object.values(LANGUAGES)) {
        const result = language.validate(language.plantilla);
        assert.equal(result.valid, true, `${language.id}: ${JSON.stringify(result.errors)}`);
    }
});

// ------------------------------------------------------------------- Python
test('Python: acepta código válido con casos que suelen dar falsos errores', () => {
    const samples = {
        fstring: 'nombre = "Ana"\nprint(f"Hola {nombre}! {{literal}} {1 + 1}")\n',
        diccionario: 'datos = {\n    "a": 1,\n    "b": [x for x in range(3)],\n}\nprint(datos)\n',
        unaLinea: 'x = 3\nif x > 2: print("grande")\nelse: print("chico")\n',
        lambdaYSlice: 'f = lambda a: a + 1\nprint(f(2), [1, 2, 3, 4][1:3])\n',
        anotaciones: 'def suma(a: int, b: int = 2) -> int:\n    return a + b\n',
        decoradores: 'import functools\n\n@functools.lru_cache(maxsize=None)\ndef fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n',
        comentarioConLlave: 'x = 1  # cierra con } y comillas " \'\nprint("texto # no es comentario {")\n',
        docstring: 'def f():\n    """Calcula algo:\n    con llaves { y (paréntesis sin cerrar\n    """\n    return 1\n',
        continuacion: 'total = 1 + \\\n    2\nprint(total)\n',
        anidado: 'for i in range(3):\n    if i % 2 == 0:\n        print(i)\n    else:\n        pass\n\n    # comentario\n    print("fin")\nprint("listo")\n',
        trycatch: 'try:\n    x = int(input())\nexcept ValueError as error:\n    print(error)\nfinally:\n    print("ok")\n',
        clases: 'class Animal:\n    def __init__(self, nombre):\n        self.nombre = nombre\n\n    def hablar(self):\n        return "..."\n',
        tabs: 'if True:\n\tprint(1)\n\tif False:\n\t\tprint(2)\n',
        whileTrue: 'while True:\n    break\n',
        lineasEnBlanco: '\n\n\ndef f():\n\n    return 1\n\n\n',
        withOpen: 'with open("a.txt") as archivo:\n    for linea in archivo:\n        print(linea)\n',
        match: 'x = 1\nmatch x:\n    case 1:\n        print("uno")\n'
    };
    for (const [name, code] of Object.entries(samples)) {
        const result = v.validatePython(code);
        assert.equal(result.valid, true, `${name}: ${JSON.stringify(result.errors)}`);
    }
});

test('Python: detecta los errores seguros con su línea', () => {
    assert.equal(lineOf(v.validatePython('x = 5\nif x > 3\n    print(x)\n'), 'MISSING_COLON'), 2);
    assert.equal(lineOf(v.validatePython('def f():\nprint(1)\n'), 'EXPECTED_INDENT'), 2);
    assert.ok(codes(v.validatePython('def f():')).includes('EXPECTED_INDENT'), 'bloque vacío al final');
    assert.equal(lineOf(v.validatePython('print("a"\nx = 1\n'), 'UNCLOSED_DELIMITER'), 1);
    assert.equal(lineOf(v.validatePython('x = (1 + 2))\n'), 'UNEXPECTED_CLOSER'), 1);
    assert.equal(lineOf(v.validatePython('x = 1\ny = "hola\n'), 'UNTERMINATED_STRING'), 2);
    assert.equal(lineOf(v.validatePython('x = 1\n    y = 2\n'), 'UNEXPECTED_INDENT'), 2);
    assert.equal(lineOf(v.validatePython('if a:\n        x = 1\n    y = 2\n'), 'INCONSISTENT_DEDENT'), 3);
    assert.ok(codes(v.validatePython('s = """sin cerrar\nmás texto\n')).includes('UNTERMINATED_STRING'));
    assert.ok(codes(v.validatePython('for i in range(3)\n    pass\n')).includes('MISSING_COLON'));
});

test('Python: lo dudoso es advertencia y no bloquea', () => {
    const py2 = v.validatePython('print "hola"\n');
    assert.equal(py2.valid, true);
    assert.ok(py2.warnings.some((warning) => warning.code === 'PY2_PRINT'));
    const mixed = v.validatePython('if True:\n\tx = 1\n        y = 2\n');
    assert.equal(mixed.valid, true, JSON.stringify(mixed.errors));
    assert.ok(mixed.warnings.some((warning) => warning.code === 'MIXED_INDENT'));
});

// --------------------------------------------------------------- JavaScript
test('JavaScript: acepta código válido (compila sin ejecutar)', () => {
    const samples = [
        'function suma(a, b) { return a + b; }\nconsole.log(suma(1, 2));',
        'const f = (x) => x * 2;\nconst { a, b = 2 } = { a: 1 };\nconsole.log(`valor: ${f(a)} ${b}`);',
        'const re = /ab+c\\/d/gi;\nconst texto = "llave { sin cerrar";\n// } comentario\n/* ( */',
        'class Animal {\n  constructor(n) { this.n = n; }\n  hablar() { return "..."; }\n}',
        'async function leer() { const r = await Promise.resolve(1); return r; }',
        'for (let i = 0; i < 3; i++) { if (i % 2) continue; console.log(i); }',
        'let x = 1\nlet y = 2\nconsole.log(x + y)'
    ];
    for (const code of samples) {
        const result = v.validateJavaScript(code);
        assert.equal(result.valid, true, `${code} -> ${JSON.stringify(result.errors)}`);
    }
});

test('JavaScript: detecta errores de sintaxis con la línea y no ejecuta nada', () => {
    const unclosed = v.validateJavaScript('function f( {\n  return 1;\n}');
    assert.equal(unclosed.valid, false);
    assert.equal(unclosed.errors[0].code, 'SYNTAX_ERROR');
    assert.ok(unclosed.errors[0].line >= 1 && unclosed.errors[0].line <= 3, 'V8 indica la línea donde detecta el problema');
    const badToken = v.validateJavaScript('let a = 1;\nlet b = ;\n');
    assert.equal(badToken.errors[0].line, 2);
    assert.equal(v.validateJavaScript('if (x) {\n  y();\n').valid, false);

    globalThis.__codigoEjecutado = false;
    const hostile = v.validateJavaScript('globalThis.__codigoEjecutado = true; while (true) {}');
    assert.equal(hostile.valid, true, 'compila bien: no se ejecuta, así que no se cuelga');
    assert.equal(globalThis.__codigoEjecutado, false, 'la revisión nunca ejecuta el código');
});

test('JavaScript: sintaxis de módulos es advertencia, no error', () => {
    const result = v.validateJavaScript('import fs from "fs";\nconsole.log(fs);');
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some((warning) => warning.code === 'MODULE_SYNTAX'));
});

// -------------------------------------------------------------------- Java
test('Java: acepta código válido con cadenas, caracteres y comentarios traicioneros', () => {
    const samples = [
        'public class Main {\n    public static void main(String[] args) {\n        System.out.println("llave { y // no comentario");\n        char c = \'{\';\n        char q = \'\\\'\';\n    }\n}\n',
        'import java.util.*;\n/* comentario con { y " */\npublic class A {\n    List<String> xs = new ArrayList<>();\n    void f() { xs.forEach(x -> System.out.println(x)); }\n}\n',
        'public class T {\n    String s = """\n        texto { con "comillas"\n        """;\n}\n',
        '@FunctionalInterface\ninterface Op { int apply(int a, int b); }\n',
        'public class B { int[] a = {1, 2, 3}; int[][] m = {{1}, {2}}; }\n'
    ];
    for (const code of samples) {
        const result = v.validateJava(code);
        assert.equal(result.valid, true, `${code.slice(0, 40)} -> ${JSON.stringify(result.errors)}`);
    }
});

test('Java: detecta llaves y comillas sin cerrar, y avisa si falta la clase', () => {
    assert.equal(lineOf(v.validateJava('public class A {\n    void f() {\n        int x = 1;\n}\n'), 'UNCLOSED_DELIMITER'), 1);
    assert.equal(lineOf(v.validateJava('public class A {\n    String s = "hola;\n}\n'), 'UNTERMINATED_STRING'), 2);
    assert.equal(lineOf(v.validateJava('class A {}\n}\n'), 'UNEXPECTED_CLOSER'), 2);
    assert.ok(codes(v.validateJava('class A { /* sin cerrar\n')).includes('UNTERMINATED_COMMENT'));
    const noClass = v.validateJava('int x = 1;\n');
    assert.equal(noClass.valid, true);
    assert.ok(noClass.warnings.some((warning) => warning.code === 'NO_CLASS'));
});

// ------------------------------------------------------------------ C / C++
test('C/C++: acepta código válido con macros, directivas y literales especiales', () => {
    const samples = [
        '#include <stdio.h>\n#define MAX(a, b) ((a) > (b) ? (a) : (b))\nint main() {\n    printf("%d\\n", MAX(1, 2));\n    return 0;\n}\n',
        '#include <iostream>\nint main() {\n    std::cout << "http://ejemplo.com // no es comentario" << std::endl;\n    char c = \'\\\'\';\n    return 0;\n}\n',
        '#include <iostream>\nint main() {\n    int n = 1\'000\'000;\n    std::cout << n;\n}\n',
        '#include <string>\nint main() {\n    std::string s = R"(texto con ) y " dentro)";\n    return 0;\n}\n',
        '/* no cierra con \' ni " */\nint main() { return 0; }\n',
        '#define LARGA(x) \\\n    do { x; } while (0)\nint main() { LARGA(0); }\n',
        'int main() {\n    int a[3] = {1, 2, 3};\n    for (int i = 0; i < 3; i++) { a[i] *= 2; }\n}\n',
        '#include <vector>\ntemplate <typename T>\nT dos(T x) { return x * 2; }\nint main() { std::vector<int> v{1, 2}; }\n'
    ];
    for (const code of samples) {
        const result = v.validateCCpp(code);
        assert.equal(result.valid, true, `${code.slice(0, 50).replace(/\n/g, ' ')} -> ${JSON.stringify(result.errors)}`);
    }
});

test('C/C++: detecta delimitadores y comillas sin cerrar, y avisa si falta main', () => {
    assert.equal(lineOf(v.validateCCpp('int main() {\n    printf("hola");\n'), 'UNCLOSED_DELIMITER'), 1);
    const unterminated = v.validateCCpp('int main() {\n    printf("hola);\n}\n');
    assert.equal(lineOf(unterminated, 'UNTERMINATED_STRING'), 2);
    assert.deepEqual(codes(unterminated), ['UNTERMINATED_STRING'], 'sin errores de llaves derivados de la cadena sin cerrar');
    assert.equal(lineOf(v.validateCCpp('int main() {\n    int x = (1 + 2));\n}\n'), 'UNEXPECTED_CLOSER'), 2);
    assert.equal(lineOf(v.validateCCpp('int main() { char c = \'ab; }\n'), 'UNTERMINATED_STRING'), 1);
    const noMain = v.validateCCpp('int suma(int a, int b) { return a + b; }\n');
    assert.equal(noMain.valid, true);
    assert.ok(noMain.warnings.some((warning) => warning.code === 'NO_MAIN'));
});

test('el resumen explica el resultado y los errores se limitan para no inundar al estudiante', () => {
    const many = v.validateCCpp('int main() {\n' + '((((((((((\n'.repeat(5));
    assert.ok(many.errors.length <= 5);
    assert.match(many.summary, /problemas? de sintaxis/);
    assert.match(v.validatePython('x = 1\n').summary, /no encontró errores/);
});
