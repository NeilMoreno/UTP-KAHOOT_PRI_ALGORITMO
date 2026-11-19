// Exportación a CSV pensada para abrirse en Excel: BOM UTF-8 (tildes), comillas dobles y saltos escapados.
// Los textos que empiezan por = + - @ (o tabulación/retorno) se prefijan con ' para que una hoja de cálculo
// nunca los interprete como fórmula (inyección de fórmulas con nombres de estudiantes, por ejemplo).

const FORMULA_START = /^[=+\-@\t\r]/;

export const csvCell = (value) => {
    if (value === null || value === undefined) return '';
    let text = typeof value === 'number' ? String(value) : String(value);
    // Un número negativo real no es una fórmula; un texto que parece fórmula sí se neutraliza.
    if (typeof value !== 'number' && FORMULA_START.test(text)) text = `'${text}`;
    return /[",\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

// columns: [{ header, value: (row) => any }]
export const toCsv = (rows, columns) => {
    const lines = [columns.map((column) => csvCell(column.header)).join(',')];
    for (const row of rows) lines.push(columns.map((column) => csvCell(column.value(row))).join(','));
    return `﻿${lines.join('\r\n')}\r\n`;
};

export const downloadCsv = (filename, content) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
