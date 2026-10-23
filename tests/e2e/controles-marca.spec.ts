import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { brandedQrSvg } from '../../src/lib/branded-qr';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';
import { chooseOption } from './select-helpers';

test('Selectores: teclado, Escape, valores de formulario y casillas de marca', async ({
  page,
}, info) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/biblioteca');
  const filter = page.getByRole('button', { name: 'Tipo de recurso', exact: true });
  await filter.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(filter).toContainText('Quizzes');
  await expect(page.locator('.library-item')).toHaveCount(1);
  await filter.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(filter).toBeFocused();
  await page.goto('/demo/tareas');
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  const subject = page.locator('form').getByRole('button', { name: 'Materia', exact: true });
  await chooseOption(subject, 'subject-biology');
  expect(
    await subject.evaluate((element) => new FormData(element.closest('form')!).get('subject')),
  ).toBe('subject-biology');
  await page.goto('/demo/editor/resource-ecosystems');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const check = page.getByRole('checkbox').first();
  await check.check();
  await expect(check).toHaveCSS('appearance', 'none');
  await expect(check).toHaveCSS('background-color', 'rgb(133, 189, 110)');
  expect(
    await check.evaluate((element) => getComputedStyle(element, '::before').borderBottomColor),
  ).toBe('rgb(25, 25, 25)');
  await page.screenshot({ path: `../output/controles-marca/controles-${info.project.name}.png` });
  await expectNoHorizontalOverflow(page);
});

test('Editor: iconos visibles y negrita persistente en ambos temas', async ({
  page,
  isMobile,
}, info) => {
  test.setTimeout(30000);
  test.skip(
    isMobile,
    'La selección de texto con ratón se cubre en escritorio; edición móvil en editor-bloques.',
  );
  await page.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  });
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  const editor = page.locator('.bn-editor');
  await editor.getByText('Todo está conectado', { exact: true }).dblclick();
  const selected = await page.evaluate(() => window.getSelection()?.toString() || '');
  expect(selected.trim().length).toBeGreaterThan(0);
  const bold = page.getByRole('button', { name: 'Negrita', exact: true });
  await expect(bold).toBeVisible();
  expect((await bold.locator('svg').boundingBox())!.width).toBeGreaterThanOrEqual(18);
  await bold.click();
  await expect(editor.locator('strong').filter({ hasText: selected.trim() })).toBeVisible();
  const toolbar = page.getByRole('toolbar').filter({ has: bold });
  expect(await toolbar.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: `../output/controles-marca/editor-claro-${info.project.name}.png`,
  });
  await page.getByRole('button', { name: 'Tema oscuro', exact: true }).click();
  await editor.getByText('Todo está conectado', { exact: true }).dblclick();
  await expect(bold).toBeVisible();
  expect((await bold.locator('svg').boundingBox())!.width).toBeGreaterThanOrEqual(18);
  await page.screenshot({
    path: `../output/controles-marca/editor-oscuro-${info.project.name}.png`,
  });
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(editor.locator('strong').filter({ hasText: selected.trim() })).toBeVisible();
});

test('QR: símbolo central, localizadores verdes y lectura de URLs cortas y largas', async ({
  page,
}, info) => {
  const symbol = await readFile('public/brand/aulify-symbol.svg', 'utf8');
  await enterDemo(page, 'docente');
  await page.goto('/demo/actividad/activity-quiz-ilustrado');
  await page.getByRole('button', { name: 'Invitar por QR', exact: true }).first().click();
  const qr = page.getByRole('img', { name: 'Código QR para abrir esta práctica' });
  await expect(qr).toBeVisible();
  const url = await page.getByLabel('Enlace para invitados').inputValue();
  const urls = [
    url,
    'https://aulify-qdxul8hs6-jdanielchfhd-9543s-projects.vercel.app/jugar/0123456789abcdef0123456789abcdef',
  ];
  for (const href of urls) {
    const svg = brandedQrSvg(href, symbol);
    expect(svg).toContain('fill="#416f35"');
    expect(svg).toContain('<image');
    const pixels = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = `data:image/svg+xml,${encodeURIComponent(source)}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 240;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0, 240, 240);
      return [...ctx.getImageData(0, 0, 240, 240).data];
    }, svg);
    expect(jsQR(new Uint8ClampedArray(pixels), 240, 240)?.data).toBe(href);
  }
  await page.screenshot({ path: `../output/controles-marca/qr-${info.project.name}.png` });
  await expectNoHorizontalOverflow(page);
});
