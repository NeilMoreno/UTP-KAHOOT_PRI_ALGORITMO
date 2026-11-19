'use strict';

// Pruebas e2e de humo (navegador real). Usan la base de PRUEBAS (scripts/with-test-db.js) en el puerto 3200.
//   npm run test:e2e                      (requiere: npm run db:test-setup)
//   E2E_CHANNEL=msedge npm run test:e2e   (usa el Edge/Chrome instalado en lugar del Chromium de Playwright)
const { defineConfig } = require('@playwright/test');

const PORT = 3200;

module.exports = defineConfig({
    testDir: 'tests/e2e',
    timeout: 60000,
    workers: 1,
    fullyParallel: false,
    reporter: [['list']],
    use: {
        baseURL: `http://localhost:${PORT}`,
        channel: process.env.E2E_CHANNEL || undefined,
        trace: 'retain-on-failure',
        locale: 'es-PE'
    },
    webServer: {
        command: 'node scripts/with-test-db.js node backend/server.js',
        url: `http://localhost:${PORT}/api/health`,
        env: { PORT: String(PORT) },
        reuseExistingServer: !process.env.CI,
        timeout: 60000
    }
});
