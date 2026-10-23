import { expect, test } from '@playwright/test';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';
import type { DemoState } from '../../src/domain';

test('Columnas: conservar contenido al guardar, leer y volver a apilar', async ({ page }, info) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  await expect(page.locator('.bn-editor')).toBeVisible();
  const text = await page.locator('.bn-editor').innerText();
  await page.getByText('Ordenar bloques con botones', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Colocar bloque 1 junto al siguiente', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Apilar contenido', exact: true })).toBeVisible();
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Apilar contenido', exact: true })).toBeVisible();
  const columns = page.locator(
    '.bn-block:has(> .node-columns) > .bn-block-group > .bn-block-outer',
  );
  await expect(columns).toHaveCount(2);
  const boxes = await columns.evaluateAll((els) =>
    els.map((el) => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y })),
  );
  if (info.project.name.includes('movil')) expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
  else expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  await expect(page.locator('.reader-columns > .reader-block > .reader-column')).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
  await page.goto('/demo/editor/resource-ecosystems');
  await page.getByRole('button', { name: 'Apilar contenido', exact: true }).click();
  await expect(page.locator('.bn-editor')).toHaveText(text, { useInnerText: true });
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
});

test('Publicar: arrastre parcial no confirma; teclado abre configuración y confirma una sola actividad', async ({
  page,
}, info) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  await expect(page.locator('.bn-editor')).toBeVisible();
  const count = () =>
    page.evaluate(
      () => (JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState).activities.length,
    );
  const before = await count();
  const publish = page.getByRole('button', { name: 'Publicar', exact: true });
  if (!info.project.name.includes('movil')) {
    const box = (await publish.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await publish.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Comparte una nueva experiencia' });
  await expect(dialog).toBeVisible();
  expect(await count()).toBe(before);
  await dialog.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  expect(await count()).toBe(before);
  await publish.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Publicar en la materia', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/demo\/materia\/subject-biology$/);
  expect(await count()).toBe(before + 1);
});
