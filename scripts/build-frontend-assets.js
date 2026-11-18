// Copia las fuentes autoalojadas para servir todo desde 'self' (CSP de helmet).
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const fonts = [
    ['@fontsource-variable/baloo-2/files/baloo-2-latin-wght-normal.woff2', 'baloo-2-latin.woff2'],
    ['@fontsource-variable/baloo-2/files/baloo-2-latin-ext-wght-normal.woff2', 'baloo-2-latin-ext.woff2'],
    ['@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2', 'nunito-latin.woff2'],
    ['@fontsource-variable/nunito/files/nunito-latin-ext-wght-normal.woff2', 'nunito-latin-ext.woff2']
];

(async () => {
    fs.mkdirSync(path.join(root, 'frontend/fonts'), { recursive: true });
    for (const [from, to] of fonts) {
        fs.copyFileSync(path.join(root, 'node_modules', from), path.join(root, 'frontend/fonts', to));
    }
    console.log('Assets del frontend generados.');
})().catch(error => { console.error(error); process.exit(1); });
