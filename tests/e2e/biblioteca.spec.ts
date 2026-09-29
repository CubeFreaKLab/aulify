import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createDemoState, DEMO_IDS } from '../../src/domain/demo-data';
import type { DemoState } from '../../src/domain/types';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

test.beforeEach(async ({ page }) => {
  const state = createDemoState();
  state.resources[0].updatedAt = '2026-09-20T12:00:00.000Z';
  state.resources.push(
    {
      id: 'resource-astronomy',
      ownerId: DEMO_IDS.teacher,
      title: 'Astronomía: una noche de observación',
      kind: 'resource',
      revision: 1,
      updatedAt: '2026-09-10T12:00:00.000Z',
      blocks: [
        {
          id: 'text-stars',
          type: 'text',
          text: 'Busca un lugar sin luces y reconoce las constelaciones visibles. Anota lo que cambia a lo largo de la noche.',
        },
      ],
    },
    {
      id: 'resource-zoology',
      ownerId: DEMO_IDS.teacher,
      title: 'Zoología: ¿cuánto sabes?',
      kind: 'quiz',
      revision: 1,
      updatedAt: '2026-09-25T12:00:00.000Z',
      blocks: [
        {
          id: 'quiz-zoology',
          type: 'quiz',
          questions: [
            {
              id: 'question-mammal',
              type: 'single',
              prompt: '¿Cuál de estos animales es un mamífero?',
              points: 1,
              options: [
                { id: 'dolphin', text: 'Delfín' },
                { id: 'shark', text: 'Tiburón' },
              ],
              correctOptionId: 'dolphin',
            },
          ],
        },
      ],
    },
    {
      id: 'resource-other-owner',
      ownerId: DEMO_IDS.student,
      title: 'Recurso de otra cuenta',
      kind: 'resource',
      revision: 1,
      updatedAt: '2026-09-26T12:00:00.000Z',
      blocks: [],
    },
  );
  await page.addInitScript((initial) => {
    if (!localStorage.getItem('aulify.demo.v1'))
      localStorage.setItem('aulify.demo.v1', JSON.stringify(initial));
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }, state);
  await enterDemo(page, 'docente');
  await page.goto('/demo/biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
});

test('biblioteca: búsqueda, tipo y orden; vista previa y copia independientes', async ({
  page,
}) => {
  const rows = page.locator('.library-item');
  await expect(rows).toHaveCount(3);
  await expect(rows.first().getByRole('heading')).toHaveText('Zoología: ¿cuánto sabes?');
  await expect(page.getByText('Recurso de otra cuenta', { exact: true })).toHaveCount(0);
  await page.getByLabel('Ordenar recursos').selectOption('title');
  await expect(rows.first().getByRole('heading')).toHaveText(
    'Astronomía: una noche de observación',
  );
  await page.getByLabel('Buscar recursos').fill('observación');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Busca un lugar sin luces');
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await page.getByLabel('Tipo de recurso').selectOption('quiz');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('¿Cuál de estos animales es un mamífero?');
  await expectNoHorizontalOverflow(page);
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState,
  );
  await rows.getByRole('button', { name: 'Vista previa', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Delfín', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('La vista previa no publica cambios ni registra respuestas.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(rows.getByRole('button', { name: 'Vista previa', exact: true })).toBeFocused();
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState,
  );
  expect(after.resources).toEqual(before.resources);
  expect(after.versions).toEqual(before.versions);
  expect(after.attempts).toEqual(before.attempts);
  await rows.getByRole('button', { name: 'Duplicar', exact: true }).click();
  await expect(page.getByLabel('Título del recurso')).toHaveValue(
    'Zoología: ¿cuánto sabes? (copia)',
  );
  await page.getByLabel('Título del recurso').fill('Quiz de animales para otro curso');
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  const copied = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState,
  );
  expect(copied.resources.find((resource) => resource.id === 'resource-zoology')).toEqual(
    before.resources.find((resource) => resource.id === 'resource-zoology'),
  );
  expect(copied.versions).toEqual(before.versions);
});

test('biblioteca: lectura, filtros vacíos y reflujo en ambos temas', async ({ page }, testInfo) => {
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('biblioteca-clara.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectNoHorizontalOverflow(page);
  const scan = await new AxeBuilder({ page }).include('.library-screen').analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('biblioteca-oscura.png'), fullPage: true });
  await page
    .locator('.library-item')
    .first()
    .getByRole('button', { name: 'Vista previa', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('biblioteca-vista-previa.png'),
    fullPage: true,
  });
  const previewScan = await new AxeBuilder({ page }).include('.dialog').analyze();
  expect(previewScan.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByLabel('Buscar recursos').fill('Sin coincidencias');
  await expect(page.getByRole('heading', { name: 'No encontramos ese recurso' })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await expect(page.locator('.library-item')).toHaveCount(3);
  await page.setViewportSize({ width: 320, height: 700 });
  await expectNoHorizontalOverflow(page);
  for (const label of ['Tipo de recurso', 'Ordenar recursos']) {
    const bounds = await page.getByLabel(label).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThan(110);
  }
});
