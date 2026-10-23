import { expect, test } from '@playwright/test';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

test('La preferencia de guías manuales puede volver a automática', async ({ page }) => {
  await enterDemo(page, 'docente');
  await page.getByRole('button', { name: 'Guía de esta página', exact: true }).click();
  const guide = page.locator('.page-guide-dialog');
  const manual = guide.getByRole('checkbox', {
    name: 'Abrir las próximas guías solo cuando las pida',
  });
  await expect(manual).toBeChecked();
  await manual.uncheck();
  await guide.getByRole('button', { name: 'Cerrar guía', exact: true }).click();
  await expect(guide).toHaveCount(0);
  await page.goto('/demo/biblioteca');
  await expect(guide).toBeVisible();
  await expect(manual).not.toBeChecked();
});

test('Carrusel infinito: rueda, vuelta completa, arrastre y punta del lápiz', async ({
  page,
}, info) => {
  test.skip(
    info.project.name.includes('movil'),
    'Rueda, ratón y portapapeles se verifican en escritorio.',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const arch = page.getByRole('group', { name: 'Carrusel de siete propuestas' });
  await arch.scrollIntoViewIfNeeded();
  await arch.focus();
  await expect(page.locator('.learning-card')).toHaveCount(7);
  await expect(page.locator('.learning-carousel-controls, .learning-carousel-dots')).toHaveCount(0);
  const position = () =>
    page
      .locator('.learning-card')
      .first()
      .evaluate((el) => el.style.getPropertyValue('--x'));
  const original = await position();
  for (let n = 0; n < 7; n++) await page.keyboard.press('ArrowRight');
  await expect.poll(position).toBe(original);
  const reel = page.locator('.learning-reel');
  await reel.hover();
  const scroll = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 100);
  await expect.poll(position).not.toBe(original);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll);
  const box = (await arch.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 130);
  await page.mouse.down();
  const before = await position();
  await page.mouse.move(box.x + box.width / 2 - 430, box.y + 130, { steps: 8 });
  await page.mouse.up();
  await expect.poll(position).not.toBe(before);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(350, 350);
  await expect(page.locator('.pencil-cursor .cursor-pencil-glyph')).toBeVisible();
  expect(
    await page.locator('.pencil-cursor').evaluate((el) => [el.style.left, el.style.top]),
  ).toEqual(['350px', '350px']);
  await page.mouse.down();
  await expect(page.locator('.pencil-cursor')).toHaveClass(/pencil-tap/);
  await page.mouse.up();
  await page.evaluate(() => {
    const carousel = document.querySelector('.learning-carousel')!;
    scrollTo({ top: carousel.getBoundingClientRect().top + scrollY + 340, behavior: 'instant' });
  });
  const nav = page.locator('.hero-nav');
  expect(
    await nav.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }),
  ).toBe(true);
  await page.getByRole('link', { name: 'Crear cuenta', exact: true }).first().click();
  await expect(page.locator('.pencil-cursor')).toHaveCount(1);
  await expect(page.locator('html')).not.toHaveClass(/pencil-cursor-active/);
});

test('Portapapeles: Ctrl+V guarda una imagen en el punto de edición y sobrevive a recarga', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name.includes('movil'), 'Portapapeles de escritorio.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  await expect(page.locator('.bn-editor')).toBeVisible();
  await page.locator('.bn-editor').click();
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#85bd6e';
    ctx.fillRect(0, 0, 48, 32);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), 'image/png'),
    );
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  });
  await page.keyboard.press('Control+v');
  const dialog = page.getByRole('dialog', { name: 'Imagen del recurso' });
  await expect(dialog.locator('.pasted-image-preview')).toBeVisible();
  await expect(dialog.locator('.pasted-image-preview')).toHaveJSProperty('naturalWidth', 48);
  await dialog
    .getByLabel('Descripción de la imagen', { exact: true })
    .fill('Muestra verde del ecosistema');
  await dialog.getByRole('button', { name: 'Guardar imagen', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Muestra verde del ecosistema', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('img', { name: 'Muestra verde del ecosistema', exact: true }),
  ).toBeVisible();
});

test('Lectura en demo, navegación por ruta y acceso directo al quiz', async ({ page }) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/biblioteca');
  await page.getByRole('button', { name: 'Crear recurso', exact: true }).click();
  await expect(page.locator('.bn-editor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tabla', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Comparte una nueva experiencia' });
  await expect(
    dialog.getByRole('button', { name: 'Publicar en la materia', exact: true }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Publicar en la materia', exact: true }).click();
  await expect(page).toHaveURL(/\/materia\/subject-biology$/);
  await expect(page.getByText('Mi nuevo recurso', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Leer recurso', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Recurso de lectura' })).toContainText(
    'Escribe una explicación',
  );
  await page.keyboard.press('Escape');
  await page
    .getByRole('navigation', { name: 'Ruta de navegación' })
    .getByRole('link', { name: 'Materias', exact: true })
    .click();
  await expect(page).toHaveURL(/\/demo\/materias$/);
  await page.goto('/demo/biblioteca');
  await page.getByRole('button', { name: 'Crear quiz', exact: true }).click();
  await expect(page.getByLabel('Título del recurso')).toHaveValue('Mi nuevo quiz');
  await expect(page.getByRole('button', { name: 'Añadir pregunta', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto('/demo/ayuda');
  await expect(page.locator('.help-step-icon')).toHaveCount(5);
  await expect(page.locator('.step-number')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
