import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { chooseTheme, enterDemo, expectNoHorizontalOverflow } from './helpers';

test('barra lateral: contraer, navegar y conservar la preferencia', async ({ page }, info) => {
  test.skip(info.project.name.includes('movil'), 'La barra lateral pertenece a escritorio.');
  await enterDemo(page, 'docente');
  await page.getByRole('button', { name: 'Contraer barra lateral', exact: true }).click();
  const navigation = page.getByRole('navigation', { name: 'Navegación de la plataforma' });
  const library = navigation.getByRole('link', { name: 'Biblioteca', exact: true });
  await library.hover();
  await expect(page).toHaveURL(/\/demo\?perfil=docente$/);
  await expect(navigation.getByRole('link', { name: 'Mi inicio' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await library.click();
  await expect(page).toHaveURL(/\/demo\/biblioteca$/);
  await expect(library).toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Expandir barra lateral', exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const axe = await new AxeBuilder({ page }).include('.app-sidebar').analyze();
  expect(axe.violations).toEqual([]);
  await info.attach('barra-contraida', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Expandir barra lateral', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Contraer barra lateral', exact: true }),
  ).toBeVisible();
});

test('barra móvil: destinos por rol, más opciones y movimiento reducido', async ({
  page,
}, info) => {
  test.skip(!info.project.name.includes('movil'), 'Recorrido táctil en el perfil móvil.');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await enterDemo(page, 'docente');
  await chooseTheme(page, 'dark');
  const dock = page.getByRole('navigation', { name: 'Accesos rápidos' });
  await expect(dock).toBeVisible();
  await dock.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/biblioteca$/);
  await expect(dock.getByRole('link', { name: 'Biblioteca' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // The global reduced-motion rule uses 0.01ms to preserve transitionend handlers.
  expect(
    await dock
      .locator('.fluid-wave')
      .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration)),
  ).toBeLessThanOrEqual(0.001);
  await dock.getByRole('button', { name: 'Más opciones' }).click();
  const dialog = page.getByRole('dialog', { name: 'Menú de navegación' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Resultados', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/demo\/resultados$/);
  await expectNoHorizontalOverflow(page);
  await enterDemo(page, 'estudiante');
  await expect(dock.getByRole('link', { name: 'Biblioteca' })).toHaveCount(0);
  await dock.getByRole('link', { name: 'Tareas', exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/tareas$/);
  await page.setViewportSize({ width: 320, height: 640 });
  await expectNoHorizontalOverflow(page);
  const axe = await new AxeBuilder({ page }).include('.workspace-dock').analyze();
  expect(axe.violations).toEqual([]);
  await info.attach('barra-movil-oscura', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
