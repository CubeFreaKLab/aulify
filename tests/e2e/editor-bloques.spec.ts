import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';
import type { DemoState } from '../../src/domain/types';

// Windows headless safeguard required by scroll-craft. Dragging is not claimed by these tests.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.requestPointerLock = () => Promise.resolve();
  });
});
async function createResource(page: Page) {
  await enterDemo(page, 'docente');
  await page.getByRole('button', { name: 'Crear recurso', exact: true }).click();
  await expect(page.locator('.bn-editor[contenteditable="true"]')).toBeVisible();
  await page.getByLabel('Título del recurso').fill('Nuestro ecosistema en bloques');
}
async function addQuestion(page: Page, name: string) {
  await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
}

test('bloques: slash buscable, formato, controles por teclado y recuperación', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createResource(page);
  const editor = page.locator('.bn-editor[contenteditable="true"]');
  await editor.getByText('Escribe una explicación para tu clase.', { exact: true }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/cita');
  const menuBounds = await page.getByRole('listbox').boundingBox();
  expect(menuBounds).not.toBeNull();
  expect(menuBounds!.x).toBeGreaterThanOrEqual(0);
  expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(menuBounds!.y).toBeGreaterThanOrEqual(0);
  expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.getByRole('option', { name: 'Cita Cita o extracto', exact: true }).click();
  await page.keyboard.type('Toda vida depende de conexiones.');
  await page.keyboard.press('Control+b');
  await page.keyboard.type(' Evidencia.');
  await page.keyboard.press('Control+b');
  await page.getByLabel('Insertar bloque', { exact: true }).selectOption('table');
  await expect(editor.locator('table')).toBeVisible();
  await page.getByLabel('Insertar bloque', { exact: true }).selectOption('checkListItem');
  await page.keyboard.type('Observar el entorno');
  await page.getByLabel('Insertar bloque', { exact: true }).selectOption('toggleListItem');
  await page.keyboard.type('Pista para la actividad');
  await page.getByLabel('Insertar bloque', { exact: true }).selectOption('codeBlock');
  await page.keyboard.type('energia = luz + agua');
  await page.getByLabel('Insertar bloque', { exact: true }).selectOption('paragraph');
  await editor.locator('[data-content-type="paragraph"]').last().click();
  await page.keyboard.type('Última idea.');
  await editor.evaluate((element) => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/html', '<p><strong>Texto pegado con formato</strong></p>');
    clipboard.setData('text/plain', 'Texto pegado con formato');
    const paste = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    // Firefox ignores constructor clipboardData for synthetic events.
    Object.defineProperty(paste, 'clipboardData', { value: clipboard });
    element.dispatchEvent(paste);
  });
  await expect(editor.getByText('Texto pegado con formato', { exact: true })).toBeVisible();
  await page.getByText('Ordenar bloques con botones', { exact: true }).click();
  const before = await page.locator('.block-order-row').count();
  await page.getByRole('button', { name: 'Duplicar bloque 1', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.block-order-row')).toHaveCount(before + 1);
  await page.getByRole('button', { name: 'Eliminar bloque 2', exact: true }).click();
  await expect(page.locator('.block-order-row')).toHaveCount(before);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.locator('.block-order-row')).toHaveCount(before + 1);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect(page.locator('.block-order-row')).toHaveCount(before);
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    editor.getByText('Toda vida depende de conexiones.', { exact: false }),
  ).toBeVisible();
  await expect(editor.locator('table')).toBeVisible();
  await expect(editor.getByText('Observar el entorno', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(editor.getByText('Pista para la actividad', { exact: true })).toHaveCSS(
    'color',
    'rgb(242, 243, 241)',
  );
  const result = await new AxeBuilder({ page })
    .include('.block-editor')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await testInfo.attach('axe-editor-completo-oscuro', {
    body: JSON.stringify(result.violations, null, 2),
    contentType: 'application/json',
  });
  expect(result.violations).toEqual([]);
  await testInfo.attach('editor-bloques', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('preguntas escritas: varios espacios UUID, guía privada y grupos', async ({
  page,
}, testInfo) => {
  await createResource(page);
  await addQuestion(page, 'Completar escribiendo');
  await page.getByLabel('Pregunta', { exact: true }).fill('Completa la relación entre recursos.');
  await page
    .getByLabel('Frase con espacios')
    .fill('La {palabra} transforma la {fuente} en alimento.');
  await page.getByRole('button', { name: 'Actualizar espacios', exact: true }).click();
  await expect(page.getByLabel('Nombre del espacio 2', { exact: true })).toBeVisible();
  await page.getByLabel('Nombre del espacio 1', { exact: true }).fill('Ser vivo');
  await page.getByLabel('Nombre del espacio 2', { exact: true }).fill('Fuente de energía');
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
  await expect(page.locator('.question-author-error')).toContainText('guía privada');
  await page
    .getByLabel('Guía de corrección (solo docente)', { exact: true })
    .fill('Un punto por planta y un punto por luz.');
  await page.getByLabel('Grupo de preguntas', { exact: true }).selectOption('new');
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
  await addQuestion(page, 'Ordenar');
  await page.getByLabel('Pregunta', { exact: true }).fill('Ordena las etapas.');
  await page.getByLabel('Elemento en posición 1', { exact: true }).fill('Semilla');
  await page.getByLabel('Elemento en posición 2', { exact: true }).fill('Planta');
  await page.getByRole('button', { name: 'Añadir elemento', exact: true }).click();
  await page.getByLabel('Elemento en posición 3', { exact: true }).fill('Fruto');
  await page.getByRole('button', { name: 'Adelantar elemento 3', exact: true }).click();
  await expect(page.getByLabel('Elemento en posición 2', { exact: true })).toHaveValue('Fruto');
  await page.getByRole('button', { name: 'Atrasar elemento 2', exact: true }).click();
  await page.getByLabel('Grupo de preguntas', { exact: true }).selectOption({ label: 'Grupo 1' });
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  const resource = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    return state.resources.find((r) => r.title === 'Nuestro ecosistema en bloques')!;
  });
  const questions = resource.blocks.flatMap((b) => (b.type === 'quiz' ? b.questions : []));
  const fill = questions[0];
  expect(fill.type).toBe('fill-text');
  if (fill.type === 'fill-text') {
    expect(fill.blanks).toHaveLength(2);
    for (const blank of fill.blanks) {
      expect(blank.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(fill.template).toContain(`{${blank.id}}`);
    }
  }
  expect(questions[0].groupId).toBe(questions[1].groupId);
  expect(JSON.stringify(resource.editorDocument || [])).not.toContain('manualGuide');
  await expectNoHorizontalOverflow(page);
  await testInfo.attach('preguntas-y-guia', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('imagen: descripción obligatoria, carga local sin API y vista previa segura', async ({
  page,
}, testInfo) => {
  await createResource(page);
  const uploaded: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/files')) uploaded.push(r.url());
  });
  await page.getByLabel('Insertar bloque', { exact: true }).selectOption('image');
  const dialog = page.getByRole('dialog', { name: 'Imagen del recurso' });
  await dialog.getByRole('button', { name: 'Guardar imagen', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Describe');
  await dialog
    .getByLabel('Descripción de la imagen', { exact: true })
    .fill('Un punto verde representa a la planta.');
  await dialog.getByLabel('Subir imagen', { exact: true }).setInputFiles({
    name: 'planta.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6wsAAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await dialog.getByRole('button', { name: 'Guardar imagen', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByAltText('Un punto verde representa a la planta.', { exact: true }),
  ).toBeVisible();
  expect(uploaded).toEqual([]);
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByAltText('Un punto verde representa a la planta.', { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await testInfo.attach('axe-editor', {
    body: JSON.stringify(axe.violations, null, 2),
    contentType: 'application/json',
  });
  expect(axe.violations).toEqual([]);
});

test('lector: estructura, tablas, desplegables, código y enlaces seguros', async ({
  page,
}, testInfo) => {
  await enterDemo(page, 'docente');
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    const resource = state.resources.find((r) => r.id === 'resource-ecosystems')!;
    resource.editorDocument = [
      {
        id: 'h',
        type: 'heading',
        props: { level: 1 },
        content: [{ text: 'Lectura enriquecida', styles: {} }],
      },
      { id: 'n1', type: 'numberedListItem', content: [{ text: 'Observar' }] },
      { id: 'n2', type: 'numberedListItem', content: [{ text: 'Comparar' }] },
      {
        id: 'toggle',
        type: 'toggleListItem',
        content: [{ text: 'Una pista' }],
        children: [
          {
            id: 'nested',
            type: 'paragraph',
            content: [{ text: 'Detalle de la observación', styles: { bold: true } }],
          },
        ],
      },
      {
        id: 'table',
        type: 'table',
        content: {
          type: 'tableContent',
          headerRows: 1,
          rows: [
            { cells: [[{ text: 'Factor' }], [{ text: 'Efecto' }]] },
            { cells: [[{ text: 'Luz' }], [{ text: 'Crecimiento' }]] },
          ],
        },
      },
      { id: 'code', type: 'codeBlock', content: [{ text: '<script>alert("nunca")</script>' }] },
      {
        id: 'link',
        type: 'paragraph',
        content: [
          {
            type: 'link',
            href: 'javascript:alert(1)',
            content: [{ text: 'Enlace no ejecutable' }],
          },
        ],
      },
      { id: 'quiz', type: 'quiz', props: { label: 'Actividad interactiva' } },
    ];
    localStorage.setItem('aulify.demo.v1', JSON.stringify(state));
  });
  await page.goto('/demo/previa/resource-ecosystems');
  const reader = page.locator('.rich-reader');
  await expect(
    reader.getByRole('heading', { name: 'Lectura enriquecida', exact: true }),
  ).toBeVisible();
  await expect(reader.locator('ol>li')).toHaveCount(2);
  await expect(reader.getByText('Detalle de la observación', { exact: true })).not.toBeVisible();
  await reader.locator('summary').filter({ hasText: 'Una pista' }).focus();
  await page.keyboard.press('Enter');
  await expect(reader.locator('strong', { hasText: 'Detalle de la observación' })).toBeVisible();
  await expect(reader.getByRole('columnheader', { name: 'Factor' })).toBeVisible();
  await expect(reader.locator('pre')).toHaveText('<script>alert("nunca")</script>');
  await expect(reader.getByRole('link', { name: 'Enlace no ejecutable' })).toHaveCount(0);
  await expect(reader.getByText('Enlace no ejecutable', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const axe = await new AxeBuilder({ page })
    .include('.rich-reader')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
  await testInfo.attach('lector-enriquecido', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('lector conserva colores, resaltado y alineación del editor en ambos temas', async ({
  page,
}) => {
  await enterDemo(page, 'docente');
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    const resource = state.resources.find((r) => r.id === 'resource-ecosystems')!;
    resource.editorDocument = [
      {
        id: 'colored',
        type: 'paragraph',
        props: { textAlignment: 'center', textColor: 'blue' },
        content: [
          { type: 'text', text: 'Observación centrada. ', styles: {} },
          {
            type: 'text',
            text: 'Plantas y luz',
            styles: { textColor: 'green', backgroundColor: 'yellow', bold: true },
          },
        ],
      },
      ...['gray', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'].map(
        (c) => ({
          id: c,
          type: 'paragraph',
          props: { textColor: c, backgroundColor: c },
          content: [{ type: 'text', text: `Ejemplo ${c}`, styles: {} }],
        }),
      ),
    ];
    localStorage.setItem('aulify.demo.v1', JSON.stringify(state));
  });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/demo/editor/resource-ecosystems');
    const original = page.locator('.bn-editor').getByText('Plantas y luz', { exact: true });
    await expect(original).toBeVisible();
    const styles = await original.evaluate((e) => ({
      color: getComputedStyle(e).color,
      background: getComputedStyle(e.closest('[data-style-type="backgroundColor"]') || e)
        .backgroundColor,
    }));
    await page.goto('/demo/previa/resource-ecosystems');
    const output = page.locator('.rich-reader').getByText('Plantas y luz', { exact: true });
    await expect(output).toHaveCSS('color', styles.color);
    await expect(output.locator('..')).toHaveCSS('background-color', styles.background);
    await expect(page.locator('.rich-reader .reader-block').first()).toHaveCSS(
      'text-align',
      'center',
    );
    const scan = await new AxeBuilder({ page })
      .include('.rich-reader')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(scan.violations).toEqual([]);
    await expectNoHorizontalOverflow(page);
  }
});
