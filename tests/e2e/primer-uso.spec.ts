import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { createDemoState, DEMO_IDS } from '../../src/domain';
import { expectNoHorizontalOverflow, expectLoadedImages } from './helpers';

test('registro: rechaza clave débil, avisa correo ocupado y confirma el envío en una tarjeta central', async ({
  page,
}, testInfo) => {
  let requests = 0;
  await page.route('**/api/auth', async (route) => {
    requests++;
    await route.fulfill({
      status: requests === 1 ? 409 : 200,
      json:
        requests === 1
          ? {
              error: 'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.',
              code: 'email_registered',
              field: 'email',
            }
          : { ok: true, message: 'Te enviamos un correo para confirmar tu cuenta.' },
    });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/registro');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Tu nombre', { exact: true }).fill('Persona de prueba');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('ocupado@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('aaaaaaaa');
  await page.getByRole('radio', { name: 'Estudiante', exact: true }).check();
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(requests).toBe(0);
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave-de-prueba-27!');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeFocused();
  await expect(page.getByText('Este correo ya está registrado.', { exact: false })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Recuperar contraseña', exact: true }),
  ).toHaveAttribute('href', '/recuperar');
  await expect(page.getByRole('heading', { name: 'Revisa tu correo', exact: true })).toHaveCount(0);
  await page.getByLabel('Correo electrónico', { exact: true }).fill('nuevo@example.test');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo', exact: true })).toBeFocused();
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('.auth-sent-card')).toContainText('nuevo@example.test');
  await expectLoadedImages(page);
  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await testInfo.attach('correo-enviado', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: 'Tema oscuro', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('materias vacías y ayuda directa del estudiante', async ({ page }, testInfo) => {
  const state = createDemoState();
  state.memberships = [];
  await page.addInitScript(
    ({ state, id }) => {
      localStorage.setItem('aulify.demo.v1', JSON.stringify(state));
      localStorage.setItem(`aulify:page-guide:manual:${id}:student`, 'true');
    },
    { state, id: DEMO_IDS.student },
  );
  await page.goto('/demo?perfil=estudiante');
  await expect(page.getByRole('heading', { name: 'Hola, Camila.' })).toBeVisible();
  await page.goto('/demo/materias');
  await expect(
    page.getByRole('heading', { name: 'Todavía no estás en ninguna materia' }),
  ).toBeVisible();
  await expectLoadedImages(page);
  await expectNoHorizontalOverflow(page);
  await testInfo.attach('materias-vacias', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: 'Tengo un código', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Únete a tu clase' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/demo/ayuda');
  await expect(page.getByRole('heading', { name: 'Una mano para empezar.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guía de esta página' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Repetir la guía' })).toHaveCount(0);
  await expect(page.locator('.page-guide-dialog')).toHaveCount(0);
});
