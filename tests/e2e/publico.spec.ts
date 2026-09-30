import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectLoadedImages, expectNoHorizontalOverflow } from './helpers';

test('inicio mínimo: marca y accesos operativos', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Aulify' })).toBeVisible();
  for (const [name, href] of [
    ['Entrar', '/acceso'],
    ['Registrarse', '/registro'],
    ['Demo docente', '/demo?perfil=docente'],
    ['Demo estudiante', '/demo?perfil=estudiante'],
  ]) {
    await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
  await expect(page.locator('.theme-switcher')).toHaveCount(1);
  await expectLoadedImages(page);
  await expectNoHorizontalOverflow(page);
  await testInfo.attach('inicio', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
});

test('landing y acceso conservan reflujo a 320 píxeles CSS', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ['/', '/acceso']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

for (const route of ['/', '/acceso', '/registro', '/recuperar']) {
  test(`accesibilidad automática de ${route}`, async ({ page }, testInfo) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    await testInfo.attach('axe', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });
    expect(results.violations).toEqual([]);
  });
}

test('formularios validan y muestran respuestas del servidor sin guardar credenciales en Web Storage', async ({
  page,
}) => {
  await page.route('**/api/auth', async (route) => {
    const request = route.request().postDataJSON();
    await route.fulfill({
      status: request.action === 'access' ? 401 : 200,
      contentType: 'application/json',
      body: JSON.stringify(
        request.action === 'access'
          ? { error: 'No pudimos iniciar sesión. Revisa tu correo y contraseña.' }
          : { message: 'Si existe una cuenta con ese correo, recibirás un enlace.' },
      ),
    });
  });
  await page.goto('/acceso');
  const password = 'Ejemplo-solo-prueba-726!';
  const email = 'verificacion@example.test';
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No pudimos iniciar sesión');
  await expect(page).toHaveURL(/\/acceso$/);
  const stored = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(stored).not.toContain(password);
  expect(stored).not.toContain(email);
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(
    page.getByRole('heading', { name: 'Recupera tu acceso.', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click();
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta');
  await expectNoHorizontalOverflow(page);
});
