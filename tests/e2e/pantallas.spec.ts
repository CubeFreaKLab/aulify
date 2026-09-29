import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

for (const theme of ['light', 'dark'] as const) {
  test(`pantallas: reflujo de materia, revisión y resultados en ${theme}`, async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await enterDemo(page, 'docente');
    for (const width of isMobile ? [320, 390] : [1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/demo');
      await expect(page.getByRole('heading', { name: 'Hola, Elena.', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const illustration = page.locator('.welcome-art img');
      await expect(illustration).toBeVisible();
      const bounds = await illustration.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await page.goto('/demo/materia/subject-biology');
      const activity = page.getByRole('link', { name: 'Ver actividad', exact: true });
      await expect(activity).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (width === 320) {
        expect((await activity.boundingBox())!.height).toBeLessThanOrEqual(46);
        expect((await activity.boundingBox())!.width).toBeGreaterThan(240);
      }
      await page.goto('/demo/revision');
      await expect(
        page.getByRole('region', { name: 'Respuestas del intento seleccionado' }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.goto('/demo/resultados');
      const filters = page.locator('.results-filters');
      await expect(filters.getByLabel('Materia', { exact: true })).toBeVisible();
      for (const select of await filters.locator('select').all())
        expect((await select.boundingBox())!.width).toBeGreaterThanOrEqual(isMobile ? 280 : 160);
      await expectNoHorizontalOverflow(page);
      const table = page.getByRole('region', {
        name: 'Tabla de calificaciones, desplazable horizontalmente',
      });
      if (isMobile) {
        await expect(page.locator('#results-scroll-help')).toBeVisible();
        const firstCell = table.locator('tbody tr').first().locator('td').first();
        await table.scrollIntoViewIfNeeded();
        const before = (await firstCell.boundingBox())!.x;
        await table.focus();
        for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
        await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        expect(Math.abs((await firstCell.boundingBox())!.x - before)).toBeLessThan(2);
      }
      const scan = await new AxeBuilder({ page })
        .include('.app-content')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(scan.violations).toEqual([]);
    }
  });
}

async function answerAndContinue(page: Page) {
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

test('quiz: cabecera estable y relaciones legibles en ancho pequeño', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: isMobile ? 320 : 1440, height: 900 });
  await enterDemo(page, 'estudiante');
  await page.goto('/demo/actividad/activity-ecosystems');
  await page.getByRole('button', { name: 'Empezar actividad', exact: true }).click();
  const logo = page.locator('.quiz-logo');
  const exit = page.getByRole('link', { name: 'Salir', exact: true });
  const logoBox = (await logo.boundingBox())!;
  const exitBox = (await exit.boundingBox())!;
  expect(Math.abs(logoBox.y + logoBox.height / 2 - exitBox.y - exitBox.height / 2)).toBeLessThan(2);
  if (isMobile) {
    const progress = (await page.locator('.quiz-progress-wrap').boundingBox())!;
    expect(progress.y).toBeGreaterThanOrEqual(exitBox.y + exitBox.height);
    expect(progress.width).toBeGreaterThan(270);
  }
  await page.getByRole('radio', { name: /El pasto/ }).check();
  await answerAndContinue(page);
  await page.getByRole('checkbox', { name: /Agua/ }).check();
  await page.getByRole('checkbox', { name: /Luz solar/ }).check();
  await answerAndContinue(page);
  await page.getByRole('radio', { name: /Verdadero/ }).check();
  await answerAndContinue(page);
  for (const [left, right] of [
    ['Planta', 'Productor'],
    ['Venado', 'Consumidor'],
    ['Hongo', 'Descomponedor'],
  ]) {
    const select = page.getByLabel(`Relacionar ${left}`, { exact: true });
    await select.selectOption({ label: right });
    if (isMobile) expect((await select.boundingBox())!.width).toBeGreaterThan(240);
  }
  await expectNoHorizontalOverflow(page);
  if (isMobile) {
    await page.setViewportSize({ width: 390, height: 900 });
    await expectNoHorizontalOverflow(page);
    expect(
      (await page.getByLabel('Relacionar Hongo', { exact: true }).boundingBox())!.width,
    ).toBeGreaterThan(300);
    await page.setViewportSize({ width: 320, height: 900 });
  }
  await answerAndContinue(page);
  const ordering = page.locator('.ordering-row').first();
  await expect(ordering).toBeVisible();
  if (isMobile) {
    for (const button of await ordering.getByRole('button').all()) {
      const bounds = (await button.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
  }
  await expectNoHorizontalOverflow(page);
});
