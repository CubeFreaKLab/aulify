import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

test('navegación móvil: foco contenido, Escape, fondo y destino', async ({ page }, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name.includes('movil')
      ? { width: 390, height: 640 }
      : { width: 760, height: 500 },
  );
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await enterDemo(page, 'docente');
  const opener = page.getByRole('button', { name: 'Abrir navegación' });
  const dialog = page.getByRole('dialog', { name: 'Menú de navegación' });
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cerrar navegación' })).toBeFocused();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  const axe = await new AxeBuilder({ page })
    .include('.navigation-overlay')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.mouse.click(page.viewportSize()!.width - 5, 100);
  await expect(dialog).toHaveCount(0);
  await opener.click();
  await dialog.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/demo\/biblioteca$/);
  await expect(page.locator('main h1')).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await testInfo.attach('biblioteca-tras-navegar', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('navegación móvil: ajustes accesibles con poca altura y cierre al ampliar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await enterDemo(page, 'docente');
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  const dialog = page.getByRole('dialog', { name: 'Menú de navegación' });
  await dialog.getByRole('link', { name: 'Preferencias', exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/preferencias$/);
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Navegación de la plataforma' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
