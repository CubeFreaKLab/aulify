import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { dismissGuide, expectNoHorizontalOverflow } from './helpers';

const enabled = process.env.AULIFY_REMOTE_E2E === '1';
test.use({ trace: 'off', video: 'off' });
type Account = { email: string; password: string };
function accounts() {
  return JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8'))
    .users as Record<string, Account>;
}
function fixtures() {
  return JSON.parse(fs.readFileSync('.local-private/remote-test-fixtures.json', 'utf8'));
}
async function login(page: Page, account: Account) {
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(account.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page).toHaveURL(/\/aula$/);
  await expect(page.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
  await dismissGuide(page);
}

test.describe('Integración con cuentas ficticias y servicios reales', () => {
  test.skip(!enabled, 'Requiere conexión privada al proyecto de pruebas y cuentas preparadas.');
  test('el docente recorre su aula y cerrar sesión protege el cambio de cuenta', async ({
    page,
  }) => {
    const account = accounts(),
      fixture = fixtures();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page, account.teacher);
    for (const route of [
      'materias',
      `materia/${fixture.subjectId}`,
      'biblioteca',
      'revision',
      'resultados',
      'preferencias',
    ]) {
      await page.goto(`/aula/${route}`);
      await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expect(page.getByRole('heading', { name: /no pudimos abrir/i })).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page).toHaveURL(/\/acceso$/);
    await login(page, account.studentOther);
    const response = await page.request.get('/api/workspace');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.state.resources).toEqual([]);
    expect(data.state.users.find((user: { id: string }) => user.id === data.userId).role).toBe(
      'student',
    );
    await page.goto(`/aula/editor/${fixture.resourceId}`);
    await expect(
      page.getByRole('heading', { name: 'Este espacio no está disponible' }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('publica una lectura desde el editor y el estudiante consulta su versión', async ({
    page,
    browser,
  }) => {
    const account = accounts(),
      fixture = fixtures();
    const title = `Lectura verificada ${Date.now()}`;
    await login(page, account.teacher);
    await page.goto('/aula/biblioteca');
    await page.getByRole('button', { name: 'Crear recurso', exact: true }).click();
    await expect(page).toHaveURL(/\/aula\/editor\//);
    await page.getByLabel('Título del recurso', { exact: true }).fill(title);
    await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Materia', { exact: true }).selectOption(fixture.subjectId);
    await expect(dialog.getByText('Se compartirá como lectura.', { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: 'Publicar en la materia', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/aula/materia/${fixture.subjectId}$`));
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const context = await browser.newContext();
    const student = await context.newPage();
    await login(student, account.student);
    await student.goto(`/aula/materia/${fixture.subjectId}`);
    await student
      .locator('.list-item')
      .filter({ has: student.getByRole('heading', { name: title, exact: true }) })
      .getByRole('button', { name: 'Leer recurso' })
      .click();
    await expect(
      student.getByRole('dialog').getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      student.getByRole('dialog').getByText('Escribe una explicación para tu clase.'),
    ).toBeVisible();
    await expectNoHorizontalOverflow(student);
    await context.close();
  });

  test('entrega un archivo real y solo su autor y docente pueden descargarlo', async ({
    page,
    browser,
  }) => {
    const account = accounts(),
      fixture = fixtures();
    const title = `Observación de una planta ${Date.now()}`;
    await login(page, account.teacher);
    await page.goto('/aula/tareas');
    await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
    await page.getByLabel('Materia', { exact: true }).first().selectOption(fixture.subjectId);
    await page.getByLabel('Título', { exact: true }).fill(title);
    await page
      .getByLabel('Consigna', { exact: true })
      .fill('Adjunta una imagen de tu observación y escribe una explicación breve.');
    await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const context = await browser.newContext();
    const student = await context.newPage();
    await login(student, account.student);
    await student.goto('/aula/tareas');
    const article = student
      .locator('article')
      .filter({ has: student.getByRole('heading', { name: title, exact: true }) });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=',
      'base64',
    );
    await article
      .getByLabel('Adjunta tu trabajo', { exact: true })
      .setInputFiles({ name: 'observacion.png', mimeType: 'image/png', buffer: png });
    await article.getByRole('button', { name: 'Entregar trabajo', exact: true }).click();
    await expect(article.getByText('Entrega pendiente de revisión', { exact: true })).toBeVisible();
    const link = article.getByRole('link', { name: 'observacion.png', exact: true });
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/api\/files\//);
    const own = await student.request.get(href!, { maxRedirects: 0 });
    expect(own.status()).toBe(307);
    const bytes = await student.request.get(own.headers().location);
    expect(await bytes.body()).toEqual(png);
    const allowed = await page.request.get(href!, { maxRedirects: 0 });
    expect(allowed.status()).toBe(307);
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await login(page, account.teacherOther);
    const denied = await page.request.get(href!, { maxRedirects: 0 });
    expect(denied.status()).toBe(404);
    await context.close();
  });
});
