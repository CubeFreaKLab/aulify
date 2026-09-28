import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { enterDemo, expectNoHorizontalOverflow, expectLoadedImages } from './helpers';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.requestPointerLock = () => Promise.resolve();
  });
});

test('apariencia por teclado, persistencia y preferencia del sistema', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const dark = page.getByRole('button', { name: 'Tema oscuro', exact: true });
  await dark.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  const other = await context.newPage();
  await other.goto('/acceso');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Tema claro', exact: true }).click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.close();
  await page.getByRole('button', { name: 'Tema del sistema', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('portada operable, capas inmóviles con movimiento reducido y contraste en ambos temas', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expectLoadedImages(page);
  await expectNoHorizontalOverflow(page);
  const animations = await page
    .locator('.l-scene-book, .l-paper-question, .l-paper-plant')
    .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).animationName));
  expect(animations).toEqual(['none', 'none', 'none']);
  for (const theme of ['Tema claro', 'Tema oscuro']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.getByLabel('Título del recurso', { exact: true }).fill('Una clase de prueba');
  await page.getByRole('button', { name: 'Añadir una pregunta de ejemplo', exact: true }).click();
  await expect(
    page.getByText('¿Qué necesita una planta para crecer?', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Quitar pregunta de ejemplo', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Añadir una pregunta de ejemplo', exact: true }),
  ).toBeVisible();
  await page.getByRole('radio', { name: /Luz, agua y dióxido de carbono/ }).check();
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('¡Lo tienes!');
});

test('contraste del espacio docente y de la participación en tema oscuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await enterDemo(page, 'docente');
  await expectNoHorizontalOverflow(page);
  const workspace = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(workspace.violations).toEqual([]);
  await enterDemo(page, 'estudiante');
  await page.goto('/demo/actividad/activity-ecosystems');
  await page.getByRole('button', { name: 'Empezar actividad', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: '¿Quién produce su propio alimento en este ecosistema?',
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const quiz = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(quiz.violations).toEqual([]);
});
