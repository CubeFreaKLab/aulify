import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import type { DemoState } from '../../src/domain/types';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.requestPointerLock = () => Promise.resolve();
  });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
});

async function imageGeometry(figure: Locator, expectedWidth: number, alignment: string) {
  await expect(figure).toHaveAttribute('data-image-width', String(expectedWidth));
  await expect(figure).toHaveAttribute('data-image-alignment', alignment);
  const geometry = await figure.evaluate((element) => {
    const image = element.querySelector('img')!;
    const frame = element.querySelector('.resource-image-frame')!.getBoundingClientRect();
    const outer = element.getBoundingClientRect();
    return {
      percent: (frame.width / outer.width) * 100,
      left: frame.left - outer.left,
      right: outer.right - frame.right,
      renderedRatio: image.width / image.height,
      intrinsicRatio: image.naturalWidth / image.naturalHeight,
    };
  });
  expect(geometry.percent).toBeCloseTo(expectedWidth, 0);
  expect(geometry.renderedRatio).toBeCloseTo(geometry.intrinsicRatio, 1);
  if (alignment === 'left') expect(Math.abs(geometry.left)).toBeLessThan(2);
  if (alignment === 'right') expect(Math.abs(geometry.right)).toBeLessThan(2);
  if (alignment === 'center') expect(Math.abs(geometry.left - geometry.right)).toBeLessThan(2);
}

async function setWidth(page: Page, value: number) {
  const range = page.getByRole('slider', { name: 'Ancho de la imagen' });
  await range.focus();
  await range.press('Home');
  for (let i = 25; i < value; i++) await range.press('ArrowRight');
  await expect(range).toHaveValue(String(value));
}

test('imagen: ancho y alineación persisten y conservan la proporción en editor y lectura', async ({
  page,
  isMobile,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await enterDemo(page, 'docente');
  await page.getByRole('button', { name: 'Crear recurso', exact: true }).click();
  await expect(page.locator('.bn-editor[contenteditable="true"]')).toBeVisible();
  await page.getByLabel('Título del recurso').fill('Nuestro cuaderno de observaciones');
  await page.getByLabel('Insertar bloque', { exact: true }).selectOption('image');
  const dialog = page.getByRole('dialog', { name: 'Imagen del recurso' });
  await dialog.getByRole('button', { name: 'Guardar imagen', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Describe');
  await dialog
    .getByLabel('Descripción de la imagen', { exact: true })
    .fill('Cuaderno verde abierto para registrar observaciones de clase.');
  await dialog
    .getByLabel('Pie de imagen (opcional)')
    .fill('Un espacio para observar, anotar y compartir.');
  await dialog
    .getByLabel('Subir imagen', { exact: true })
    .setInputFiles(path.resolve('public/illustrations/cuaderno.png'));
  await dialog.getByRole('button', { name: 'Guardar imagen', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const figure = page.locator('.bn-editor .resource-image');
  await expect(figure.getByRole('img')).toBeVisible();
  await expect
    .poll(() => figure.getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await figure.getByText('Tamaño y posición', { exact: true }).click();
  await setWidth(page, 60);
  for (const [alignment, label] of [
    ['left', 'Alinear imagen a la izquierda'],
    ['center', 'Centrar imagen'],
    ['right', 'Alinear imagen a la derecha'],
  ] as const) {
    await figure.getByRole('button', { name: label, exact: true }).click();
    await imageGeometry(figure, 60, alignment);
  }
  if (!isMobile) {
    await figure.getByRole('button', { name: 'Centrar imagen', exact: true }).click();
    const frame = await figure.locator('.resource-image-frame').boundingBox();
    const outer = await figure.boundingBox();
    expect(frame).not.toBeNull();
    expect(outer).not.toBeNull();
    await page.mouse.move(frame!.x + frame!.width, frame!.y + frame!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      frame!.x + frame!.width - outer!.width * 0.1,
      frame!.y + frame!.height / 2,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(figure).toHaveAttribute('data-image-width', '40');
    await setWidth(page, 60);
    await figure.getByRole('button', { name: 'Alinear imagen a la derecha', exact: true }).click();
  }
  const resourceId = new URL(page.url()).pathname.split('/').at(-1)!;
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
        const image = state.resources
          .find((resource) => resource.id === id)!
          .blocks.find((block) => block.type === 'image');
        return image?.type === 'image' ? [image.widthPercent, image.imageAlignment] : null;
      }, resourceId),
    )
    .toEqual([60, 'right']);
  await page.reload();
  await expect(figure).toBeVisible();
  await expect
    .poll(() => figure.getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await imageGeometry(figure, 60, 'right');
  await figure.getByText('Tamaño y posición', { exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Ancho de la imagen' })).toHaveValue('60');
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectNoHorizontalOverflow(page);
    const scan = await new AxeBuilder({ page })
      .include('.resource-image')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(scan.violations).toEqual([]);
    const screenshotPath = testInfo.outputPath(`imagen-editor-${theme}.png`);
    await page.screenshot({ fullPage: true, path: screenshotPath });
    await testInfo.attach(`imagen-editor-${theme}`, {
      path: screenshotPath,
      contentType: 'image/png',
    });
  }
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  const readImage = page.locator('.rich-reader .resource-image');
  await expect(
    page
      .locator('.rich-reader')
      .getByRole('heading', { name: 'Nuestro cuaderno de observaciones', exact: true }),
  ).toBeVisible();
  await expect(readImage.getByRole('img')).toBeVisible();
  await expect
    .poll(() =>
      readImage.getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(readImage.getByRole('button')).toHaveCount(0);
  await imageGeometry(readImage, 60, 'right');
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectNoHorizontalOverflow(page);
    const screenshotPath = testInfo.outputPath(`imagen-lectura-${theme}.png`);
    await page.screenshot({ fullPage: true, path: screenshotPath });
    await testInfo.attach(`imagen-lectura-${theme}`, {
      path: screenshotPath,
      contentType: 'image/png',
    });
  }
  expect(errors).toEqual([]);
});

test('imagen anterior sin dimensiones mantiene el ancho disponible y el fallback conserva cambios', async ({
  page,
}) => {
  await enterDemo(page, 'docente');
  await page.route('https://assets.aulify.test/cuaderno.png', (route) =>
    route.fulfill({ path: 'public/illustrations/cuaderno.png', contentType: 'image/png' }),
  );
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    const resource = state.resources.find((item) => item.id === 'resource-ecosystems')!;
    resource.blocks = [
      {
        id: 'image-old',
        type: 'image',
        url: 'https://assets.aulify.test/cuaderno.png',
        alt: 'Cuaderno de observaciones',
      },
    ];
    delete resource.editorDocument;
    localStorage.setItem('aulify.demo.v1', JSON.stringify(state));
  });
  await page.goto('/demo/editor/resource-ecosystems');
  const figure = page.locator('.bn-editor .resource-image');
  await expect(figure.getByRole('img')).toBeVisible();
  await expect
    .poll(() => figure.getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await imageGeometry(figure, 100, 'center');
  await figure.getByText('Tamaño y posición', { exact: true }).click();
  await setWidth(page, 50);
  await figure.getByRole('button', { name: 'Alinear imagen a la izquierda', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
        const image = state.resources.find((item) => item.id === 'resource-ecosystems')!.blocks[0];
        return image.type === 'image' ? [image.widthPercent, image.imageAlignment] : null;
      }),
    )
    .toEqual([50, 'left']);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    delete state.resources.find((item) => item.id === 'resource-ecosystems')!.editorDocument;
    localStorage.setItem('aulify.demo.v1', JSON.stringify(state));
  });
  await page.goto('/demo/previa/resource-ecosystems');
  const readImage = page.locator('.rich-reader .resource-image');
  await expect(readImage.getByRole('img')).toBeVisible();
  await expect
    .poll(() =>
      readImage.getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await imageGeometry(readImage, 50, 'left');
  await expectNoHorizontalOverflow(page);
});
