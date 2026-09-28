import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectLoadedImages, expectNoHorizontalOverflow } from './helpers';

test('landing: marca, ilustraciones, vínculos y pregunta pública operativos', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Que tu clase');
  await expect(page.getByRole('link', { name: 'Explorar una clase', exact: true })).toHaveAttribute(
    'href',
    '/demo?perfil=docente',
  );
  await expect(page.getByRole('link', { name: 'Soy estudiante', exact: true })).toHaveAttribute(
    'href',
    '/demo?perfil=estudiante',
  );
  await expectLoadedImages(page);
  await expectNoHorizontalOverflow(page);
  const example = page.locator('#probar');
  await page.getByRole('link', { name: 'Probar una pregunta', exact: true }).click();
  await expect(example.getByRole('button', { name: 'Responder', exact: true })).toBeDisabled();
  await example.getByRole('radio').first().check();
  await example.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(example.getByRole('button', { name: /Siguiente/ })).toBeVisible();
  await expect(example.getByText(/no generan una nota/)).toBeVisible();
  await testInfo.attach('landing', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
});

test('landing: movimiento reducido mantiene la escena estable al desplazarse', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const scene = page.getByRole('group', { name: /Un cuaderno, explicaciones y preguntas/ });
  await expect(scene).toBeVisible();
  const book = scene.locator('.l-scene-book');
  const before = await book.evaluate((element) => getComputedStyle(element).transform);
  await scene.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => book.evaluate((element) => getComputedStyle(element).transform))
    .toBe(before);
  await expect(page.getByRole('link', { name: 'Explorar una clase', exact: true })).toBeAttached();
  await expectNoHorizontalOverflow(page);
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
