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
  await expect(page.getByRole('button', { name: 'Tema claro', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Tema claro', exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/acceso');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Tema claro', exact: true }).click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.close();
  await page.evaluate(() => localStorage.removeItem('aulify.theme'));
  await page.reload();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('inicio mínimo conserva contraste en ambos temas y respeta movimiento reducido', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  await expectLoadedImages(page);
  await expectNoHorizontalOverflow(page);
  for (const nextTheme of ['Tema oscuro', 'Tema claro']) {
    await page.getByRole('button', { name: nextTheme, exact: true }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition', 'circle');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
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
