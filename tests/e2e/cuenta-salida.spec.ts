import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('cuenta: logo al aula, sin controles ficticios y salida a portada', async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(
    process.env.AULIFY_REMOTE_E2E !== '1',
    'Requiere la cuenta ficticia privada existente.',
  );
  const account = JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8'))
    .users.teacherOther;
  const origin = new URL(baseURL!).origin;
  const response = await context.request.post('/api/auth', {
    headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin' },
    data: { action: 'access', email: account.email, password: account.password },
  });
  expect(response.ok()).toBe(true);
  try {
    await page.addLocatorHandler(
      page.getByRole('button', { name: 'Cerrar guía', exact: true }),
      async (button) => {
        await button.click();
      },
    );
    await page.goto('/aula/preferencias');
    await page.getByRole('heading', { name: 'Tu perfil', exact: true }).waitFor();
    await expect(page.getByRole('heading', { name: 'Tu perfil', exact: true })).toBeVisible();
    await expect(page.getByText('Demostración', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cambiar perfil' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reiniciar datos', exact: true })).toHaveCount(0);
    if (await page.getByRole('button', { name: 'Más opciones' }).isVisible()) {
      await page.getByRole('button', { name: 'Más opciones' }).click();
    }
    await page
      .getByRole('link', { name: 'Aulify, mi inicio', exact: true })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/aula$/);
    await expectNoHorizontalOverflow(page);
    await page.route('**/api/auth', (route) =>
      route.fulfill({ status: 503, json: { error: 'Ensayo de indisponibilidad' } }),
    );
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'No pudimos cerrar la sesión' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveURL(/\/aula$/);
    await page.unroute('**/api/auth');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page).toHaveURL(origin + '/');
    const privateResponse = await context.request.get('/api/workspace');
    expect(privateResponse.status()).toBe(401);
    await page.goto('/aula/preferencias');
    await expect(page).toHaveURL(/\/acceso$/);
  } finally {
    await context.request.post('/api/auth', {
      headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin' },
      data: { action: 'signout' },
    });
  }
});

test('producción: no ofrece ni abre rutas de demostración', async ({ page, request }) => {
  test.skip(process.env.AULIFY_PRODUCTION_E2E !== '1', 'Requiere servidor compilado sin demo.');
  for (const route of ['/', '/acceso', '/registro', '/recuperar']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('a[href^="/demo"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }
  for (const route of ['/demo', '/demo/preferencias', '/jugar/ecosistema-demo']) {
    // Next can stream the shell with HTTP 200 before rendering notFound().
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'Esta página no está aquí.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cambiar perfil' })).toHaveCount(0);
  }
  const response = await request.get('/api/jugar/ecosistema-demo');
  expect(response.status()).toBe(404);
});
