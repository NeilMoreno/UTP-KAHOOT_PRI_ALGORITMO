'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.resolve(__dirname, '../frontend/js/csv.js')).href);

test('las celdas se escapan y las fórmulas se neutralizan', async () => {
    const { csvCell } = await load();
    assert.equal(csvCell('Ana'), 'Ana');
    assert.equal(csvCell('Pérez, Ana'), '"Pérez, Ana"');
    assert.equal(csvCell('dice "hola"'), '"dice ""hola"""');
    assert.equal(csvCell('línea\nnueva'), '"línea\nnueva"');
    assert.equal(csvCell(null), '');
    assert.equal(csvCell(undefined), '');
    assert.equal(csvCell(0), '0');
    assert.equal(csvCell(-5), '-5', 'un número negativo no es una fórmula');
    for (const attack of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd']) {
        assert.ok(csvCell(attack).replace(/^"/, '').startsWith("'"), `neutraliza ${JSON.stringify(attack)}`);
    }
});

test('toCsv arma cabecera, filas, BOM y saltos CRLF', async () => {
    const { toCsv } = await load();
    const csv = toCsv(
        [{ n: 'Ana', p: 80.5 }, { n: '=1+1', p: null }],
        [{ header: 'Nombre', value: (r) => r.n }, { header: 'Promedio', value: (r) => r.p }]
    );
    assert.equal(csv, "﻿Nombre,Promedio\r\nAna,80.5\r\n'=1+1,\r\n");
});
