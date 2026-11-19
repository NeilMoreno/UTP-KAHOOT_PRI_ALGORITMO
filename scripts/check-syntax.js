'use strict';

// Revisa la sintaxis de todo el JavaScript del proyecto sin ejecutarlo:
//   backend, scripts y tests → CommonJS      |   frontend/js → módulos ES
//   npm run lint
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
});

let failures = 0;
let checked = 0;
for (const area of [['backend', false], ['scripts', false], ['tests', false], ['frontend/js', true]]) {
    const [folder, isModule] = area;
    for (const file of walk(path.join(root, folder)).filter((item) => item.endsWith('.js'))) {
        checked += 1;
        const args = isModule ? ['--check', '--input-type=module'] : ['--check', file];
        const result = spawnSync(process.execPath, args, {
            input: isModule ? fs.readFileSync(file) : undefined, encoding: 'utf8'
        });
        if (result.status !== 0) {
            failures += 1;
            console.error(`✖ ${path.relative(root, file)}\n${(result.stderr || '').split('\n').slice(0, 4).join('\n')}`);
        }
    }
}
console.log(`${failures === 0 ? 'OK' : 'ERROR'} | ${checked} archivos revisados, ${failures} con errores de sintaxis.`);
process.exit(failures === 0 ? 0 : 1);
