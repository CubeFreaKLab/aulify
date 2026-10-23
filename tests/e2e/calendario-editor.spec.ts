import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';
import { setDate } from './date-helpers';
import type { DemoState } from '../../src/domain/types';

test('calendario: fechas por teclado, límites, borrado y hora local', async ({ page }) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/resultados');
  await setDate(page, 'Desde la fecha', '2026-09-25');
  await setDate(page, 'Hasta la fecha', '2026-09-26');
  await page.locator('#result-through').getByRole('button').click();
  const calendar = page.locator('.brand-date-popover');
  await expect(calendar).toBeVisible();
  await expect(
    calendar.locator('[data-disabled="true"]:not([data-outside-month])'),
  ).not.toHaveCount(0);
  await expect(calendar.locator('[data-selected="true"]')).toHaveText('26');
  await expectNoHorizontalOverflow(page);
  const axe = await new AxeBuilder({ page }).include('.brand-date-popover').analyze();
  expect(axe.violations).toEqual([]);
  await calendar.getByRole('button', { name: 'Borrar', exact: true }).click();
  await expect(page.locator('#result-through [data-type="day"]')).toHaveAttribute(
    'data-placeholder',
    'true',
  );
  await page.goto('/demo/editor/resource-ecosystems');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await setDate(page, 'Disponible desde', '2026-10-25');
  const start = page.locator('#open-date');
  await start.getByRole('button').click();
  await calendar.locator('[data-type="hour"]').pressSequentially('18');
  await calendar.locator('[data-type="minute"]').pressSequentially('35');
  await calendar.getByRole('button', { name: 'Listo', exact: true }).click();
  await expect(start.locator('[data-type="day"]')).toHaveText('25');
  await expect(start.locator('[data-type="hour"]')).toHaveText('18');
  await expect(start.locator('[data-type="minute"]')).toHaveText('35');
  await expectNoHorizontalOverflow(page);
});

test('editor: recuperar contenido de columnas retiradas y conservar colores en celdas y texto', async ({
  page,
}) => {
  await enterDemo(page, 'docente');
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    state.resources.find((resource) => resource.id === 'resource-ecosystems')!.editorDocument = [
      {
        id: 'cols',
        type: 'columns',
        children: [
          {
            id: 'col1',
            type: 'column',
            props: { label: 'Primera columna' },
            children: [
              {
                id: 'heading',
                type: 'heading',
                props: { level: 1, isToggleable: true },
                content: [{ type: 'text', text: 'PalabrasSinEspacios'.repeat(5), styles: {} }],
              },
            ],
          },
          {
            id: 'col2',
            type: 'column',
            props: { label: 'Segunda columna' },
            children: [
              {
                id: 'paragraph',
                type: 'paragraph',
                content: [{ type: 'text', text: 'Nuestra segunda idea', styles: {} }],
              },
            ],
          },
        ],
      },
      {
        id: 'table',
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [
            { cells: [[{ type: 'text', text: 'Productores', styles: {} }], []] },
            { cells: [[], []] },
          ],
        },
      },
    ];
    localStorage.setItem('aulify.demo.v1', JSON.stringify(state));
  });
  await page.goto('/demo/previa/resource-ecosystems');
  await expect(
    page.locator('.rich-reader').getByText('Nuestra segunda idea', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.reader-columns, .reader-column')).toHaveCount(0);
  await page.goto('/demo/editor/resource-ecosystems');
  const editor = page.locator('.bn-editor[contenteditable="true"]');
  await expect(page.getByRole('button', { name: 'Dos columnas', exact: true })).toHaveCount(0);
  await expect(editor.locator('.node-columns, .node-column')).toHaveCount(0);
  await expect(editor.getByText('Nuestra segunda idea', { exact: true })).toBeVisible();
  await expect(editor).not.toContainText('Primera columna');
  const longText = editor.getByRole('heading', { name: /PalabrasSinEspacios/ });
  expect(await longText.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);
  await editor.getByText('Productores', { exact: true }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Home');
  await page.getByRole('button', { name: 'Colores', exact: true }).click();
  await page.getByRole('button', { name: 'Fondo de celda', exact: true }).click();
  const colorAccessibility = await new AxeBuilder({ page })
    .include('.bn-color-picker-dropdown')
    .analyze();
  expect(colorAccessibility.violations).toEqual([]);
  await page.getByRole('textbox', { name: 'Color hexadecimal' }).fill('#f4e6b9');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(editor.locator('td').first()).toHaveCSS('background-color', 'rgb(244, 230, 185)');
  await editor.getByText('Nuestra segunda idea', { exact: true }).click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await page.getByRole('button', { name: 'Colores', exact: true }).click();
  await page.getByRole('textbox', { name: 'Color hexadecimal' }).fill('#426d99');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(editor.locator('[data-style-type="textColor"]')).toHaveCSS(
    'color',
    'rgb(66, 109, 153)',
  );
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expect(editor.locator('.node-columns, .node-column')).toHaveCount(0);
  await expect(editor.locator('td').first()).toHaveCSS('background-color', 'rgb(244, 230, 185)');
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  await expect(page.locator('.rich-reader td').first()).toHaveCSS(
    'background-color',
    'rgb(244, 230, 185)',
  );
  await expect(
    page.locator('.rich-reader').getByText('Nuestra segunda idea', { exact: true }),
  ).toHaveCSS('color', 'rgb(66, 109, 153)');
  await expectNoHorizontalOverflow(page);
});
