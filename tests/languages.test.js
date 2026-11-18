'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const server = require('../backend/config/languages');

const loadFrontend = () => import(pathToFileURL(path.resolve(__dirname, '../frontend/js/languages.js')).href);

test('el servidor expone los cinco lenguajes y PSeInt es el predeterminado', () => {
    assert.deepEqual(server.LANGUAGE_IDS, ['pseint', 'python', 'javascript', 'java', 'c_cpp']);
    assert.equal(server.DEFAULT_LANGUAGE, 'pseint');
    assert.equal(server.getLanguage('no-existe').id, 'pseint', 'un id desconocido cae en PSeInt (cursos anteriores)');
    assert.equal(server.getLanguage(undefined).id, 'pseint');
    assert.equal(server.isValidLanguage('python'), true);
    assert.equal(server.isValidLanguage('cobol'), false);
    assert.equal(server.isValidLanguage('__proto__'), false);
    assert.equal(server.isValidLanguage(null), false);
});

test('cada lenguaje trae nombre, extensión, nombre para la IA, plantilla y revisión de sintaxis', () => {
    for (const language of Object.values(server.LANGUAGES)) {
        assert.ok(language.nombre && language.extension && language.promptName && language.plantilla, language.id);
        assert.equal(typeof language.validate, 'function', language.id);
        assert.match(language.plantilla, /Tu código/, `${language.id}: la plantilla indica dónde escribir`);
    }
});

test('publicLanguage solo expone datos visibles (sin funciones)', () => {
    const publicData = server.publicLanguage('python');
    assert.deepEqual(Object.keys(publicData).sort(), ['extension', 'id', 'nombre', 'plantilla']);
    assert.equal(publicData.nombre, 'Python');
    assert.equal(server.publicLanguage('zzz').id, 'pseint');
});

test('el frontend y el servidor coinciden en id, nombre, extensión y plantilla', async () => {
    const front = await loadFrontend();
    assert.deepEqual(front.LANGUAGE_IDS, server.LANGUAGE_IDS);
    assert.equal(front.DEFAULT_LANGUAGE, server.DEFAULT_LANGUAGE);
    for (const id of server.LANGUAGE_IDS) {
        const expected = server.publicLanguage(id);
        const actual = front.LANGUAGES[id];
        assert.equal(actual.id, expected.id);
        assert.equal(actual.nombre, expected.nombre, `${id}: nombre`);
        assert.equal(actual.extension, expected.extension, `${id}: extensión`);
        assert.equal(actual.plantilla, expected.plantilla, `${id}: plantilla`);
    }
    assert.equal(front.getLanguage('desconocido').id, 'pseint');
});

test('el cliente trae lo necesario para resaltar y sangrar cada lenguaje', async () => {
    const front = await loadFrontend();
    for (const language of Object.values(front.LANGUAGES)) {
        assert.match(language.indent, /^ {2,4}$/, `${language.id}: sangría`);
        const { comment, strings, keywords, types, functions } = language.highlight;
        assert.ok(comment && strings.length > 0, language.id);
        assert.ok(keywords instanceof Set && keywords.size > 5 && types instanceof Set && functions instanceof Set, language.id);
        assert.doesNotThrow(() => new RegExp(comment), `${language.id}: el patrón de comentario es una expresión válida`);
    }
});
