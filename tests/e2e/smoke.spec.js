'use strict';

const { test, expect } = require('@playwright/test');

const login = async (page, email) => {
    await page.goto('/#/login');
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill('codeint123');
    await page.locator('button[type=submit]').click();
};

test('la página pública muestra la landing, el acceso por PIN y los términos', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Programa\. Compite\./ })).toBeVisible();
    await expect(page.getByLabel(/PIN/i).or(page.locator('input[inputmode="numeric"]')).first()).toBeVisible();
    await page.goto('/#/terminos');
    await expect(page.getByRole('heading', { name: /términos/i }).first()).toBeVisible();
});

test('un acceso con datos inválidos muestra un error y no entra', async ({ page }) => {
    await page.goto('/#/login');
    await page.locator('input[type=email]').fill('nadie@utp.edu.pe');
    await page.locator('input[type=password]').fill('incorrecta');
    await page.locator('button[type=submit]').click();
    await expect(page.locator('[role=alert], .alert.error').first()).toBeVisible();
    await expect(page).toHaveURL(/#\/login/);
});

test('el estudiante entra al centro de misiones, ve la campana y puede unirse con un código', async ({ page }) => {
    await login(page, 'estudiante.demo@utp.edu.pe');
    await expect(page.getByText('Centro de misiones').first()).toBeVisible();
    await expect(page.locator('.bell')).toBeVisible();
    await expect(page.locator('#join-code')).toBeVisible();
    await page.locator('#join-code').fill('ZZQ9');
    await page.getByRole('button', { name: 'Unirme' }).click();
    await expect(page.locator('.join-form .alert')).toContainText(/No encontramos/);
});

test('el docente ve su panel, las analíticas y el formulario de curso con lenguaje', async ({ page }) => {
    await login(page, 'docente.demo@utp.edu.pe');
    await expect(page.getByText('Panel').first()).toBeVisible();
    await page.goto('/#/cursos');
    await page.getByRole('button', { name: /Nuevo curso/ }).click();
    await expect(page.locator('#curso-lenguaje')).toBeVisible();
    await expect(page.locator('#curso-lenguaje option')).toHaveCount(5);
    await page.keyboard.press('Escape');
    await page.goto('/#/analiticas');
    await expect(page.getByText(/Analíticas/i).first()).toBeVisible();
});

test('un estudiante no puede abrir las pantallas del docente', async ({ page }) => {
    await login(page, 'estudiante.demo@utp.edu.pe');
    await expect(page.getByText('Centro de misiones').first()).toBeVisible();
    await page.goto('/#/analiticas');
    // El router lo devuelve al inicio del estudiante.
    await expect(page.getByText('Centro de misiones').first()).toBeVisible();
    await expect(page.getByText(/Analíticas del curso/)).toHaveCount(0);
});
