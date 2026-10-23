import { test, expect } from '@playwright/test';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

test('Publicación: el diálogo espera la animación, confirma y navega una sola vez', async ({
  page,
}, info) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  await expect(page.locator('.bn-editor')).toBeVisible();
  const count = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('aulify.demo.v1')!).activities.length);
  const before = await count();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Comparte una nueva experiencia' });
  const send = dialog.getByRole('button', { name: 'Publicar en la materia', exact: true });
  await expect(send).toHaveAttribute('data-phase', 'idle');
  await send.click();
  await expect(send).toHaveAttribute('data-phase', 'sending');
  expect(await count()).toBe(before);
  await expect(send.locator('.document-action-label')).toHaveCSS('opacity', '0');
  await expect(dialog.getByText('Publicado', { exact: true })).toBeVisible();
  await page.screenshot({ path: `../output/publicacion-quiz/publicado-${info.project.name}.png` });
  await expect(page).toHaveURL(/materia\/subject-biology$/);
  expect(await count()).toBe(before + 1);
});

test('Editor: carga con separación, teclado animado y tabla ancha dentro de la hoja', async ({
  page,
}, info) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  await expect(page.locator('.bn-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Imagen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Imagen del recurso' });
  await expect(dialog).toBeVisible();
  const caption = dialog.getByLabel('Pie de imagen (opcional)');
  await caption.pressSequentially('Hola');
  await expect(page.locator('.piano-input-letter')).toHaveText('a');
  const inputBox = await caption.boundingBox();
  const saveBox = await dialog
    .getByRole('button', { name: 'Guardar imagen', exact: true })
    .boundingBox();
  expect(saveBox!.y - inputBox!.y - inputBox!.height).toBeGreaterThanOrEqual(16);
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Tabla', exact: true }).click();
  // Persist a large real BlockNote table, then exercise its scrolling canvas.
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!);
    const resource = state.resources.find(
      (item: { id: string }) => item.id === 'resource-ecosystems',
    );
    const visit = (blocks: { type: string; content: unknown; children?: unknown[] }[]) => {
      for (const block of blocks)
        if (block.type === 'table')
          block.content = {
            type: 'tableContent',
            rows: Array.from({ length: 3 }, () => ({
              cells: Array.from({ length: 12 }, () => 'Dato'),
            })),
          };
    };
    visit(resource.editorDocument);
    localStorage.setItem('aulify.demo.v1', JSON.stringify(state));
  });
  await page.reload();
  const table = page.locator('.tableWrapper');
  await expect(table).toBeVisible();
  await table.scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBeTruthy();
  await table.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(await table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
  if (!info.project.name.includes('movil')) {
    await table.locator('tr').first().locator('td').last().hover();
    const addColumn = page.locator('.bn-extend-button-add-remove-columns');
    await expect(addColumn).toBeVisible();
    const control = await addColumn.boundingBox();
    const canvas = await table.boundingBox();
    expect(control!.x + control!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width + 1);
    await addColumn.click();
    await expect(table.locator('tr').first().locator('td')).toHaveCount(13);
    const addedCell = await table.locator('tr').first().locator('td').last().boundingBox();
    expect(addedCell!.x).toBeGreaterThanOrEqual(canvas!.x);
    expect(addedCell!.x + addedCell!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width);
    await expectNoHorizontalOverflow(page);
  }
  await page.screenshot({ path: `../output/publicacion-quiz/tabla-${info.project.name}.png` });
});

test('Alumno: ejemplo ilustrado accesible con barra de tiempo', async ({ page }, info) => {
  await enterDemo(page, 'estudiante');
  await page.goto('/demo/actividad/activity-quiz-ilustrado');
  await page.getByRole('button', { name: 'Empezar actividad', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Tiempo restante' })).toBeVisible();
  await expect(page.locator('.quiz-scene')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `../output/publicacion-quiz/quiz-alumno-${info.project.name}.png`,
    fullPage: true,
  });
});

test('Docente: el QR abre una práctica sin cuenta y la lista muestra los avatares', async ({
  page,
}) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/materia/subject-biology');
  await page.getByRole('tab', { name: 'Integrantes', exact: true }).click();
  await expect(page.locator('tbody .profile-avatar')).toHaveCount(3);
  await page.goto('/demo/actividad/activity-quiz-ilustrado');
  await page.getByRole('button', { name: 'Invitar por QR', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Jugar sin cuenta' });
  await expect(dialog.getByAltText('Código QR para abrir esta práctica')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Probar como invitado' })).toHaveAttribute(
    'href',
    /\/jugar\/ecosistema-demo$/,
  );
  await expectNoHorizontalOverflow(page);
});

test('Lápiz: acceso y registro apuntan arriba a la izquierda; el campo cambia al cursor ilustrado de texto', async ({
  page,
}, info) => {
  test.skip(info.project.name.includes('movil'), 'El cursor ilustrado solo corresponde al ratón.');
  for (const path of ['/acceso', '/registro']) {
    await page.goto(path);
    const cursor = page.locator('.pencil-cursor');
    await expect
      .poll(async () => {
        await page.mouse.move(280, 200);
        await page.mouse.move(300, 200, { steps: 4 });
        return cursor.locator('.cursor-pencil-glyph').isVisible();
      })
      .toBe(true);
    await expect
      .poll(() =>
        cursor.locator('.cursor-pencil-glyph').evaluate((el) => {
          const matrix = new DOMMatrix(getComputedStyle(el).transform);
          return Math.round((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI);
        }),
      )
      .toBe(90);
    await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).hover();
    await expect(cursor).toHaveAttribute('data-mode', 'text');
    await expect(cursor.locator('.cursor-text-glyph')).toHaveCSS('opacity', '1');
    await expect(cursor.locator('.cursor-pencil-glyph')).toHaveCSS('opacity', '0');
  }
});

test('Invitado: sin cuenta, sin claves privadas, progreso conservado y respuesta idempotente', async ({
  page,
}, info) => {
  test.skip(
    Boolean(process.env.CI),
    'Integración con PostgreSQL alojado; el CI no recibe credenciales.',
  );
  await page.goto('/jugar/ecosistema-demo');
  await page.getByLabel('¿Cómo te llamas?').fill('Prueba invitada');
  await page.getByRole('button', { name: 'Empezar a jugar' }).click();
  await expect(page.getByRole('progressbar', { name: 'Tiempo restante' })).toBeVisible();
  const projection = await (await page.request.get('/api/jugar/ecosistema-demo')).json();
  expect(JSON.stringify(projection)).not.toMatch(
    /correctOption|correctOrder|secret_hash|teacher|owner_id/,
  );
  const body = {
    action: 'answer',
    index: 0,
    requestId: crypto.randomUUID(),
    answer: { type: 'single', optionId: 'grass' },
  };
  const origin = new URL(page.url()).origin;
  const first = await page.request.post('/api/jugar/ecosistema-demo', {
    headers: { origin },
    data: body,
  });
  expect(first.ok()).toBeTruthy();
  const second = await page.request.post('/api/jugar/ecosistema-demo', {
    headers: { origin },
    data: body,
  });
  expect((await second.json()).run.index).toBe(1);
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'Selecciona los dos componentes no vivos de un ecosistema.',
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const remaining = [
    { type: 'multiple', optionIds: ['water', 'sunlight'] },
    { type: 'true-false', value: true },
    { type: 'matching', pairs: { plant: 'producer', deer: 'consumer', mushroom: 'decomposer' } },
    { type: 'ordering', itemIds: ['sun', 'vegetation', 'herbivore', 'predator'] },
    { type: 'fill-options', choices: { living: 'biotic', nonliving: 'abiotic' } },
  ];
  for (const [index, answer] of remaining.entries()) {
    const response = await page.request.post('/api/jugar/ecosistema-demo', {
      headers: { origin },
      data: { action: 'answer', index: index + 1, requestId: crypto.randomUUID(), answer },
    });
    expect(response.ok()).toBeTruthy();
  }
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '¡Terminaste tu práctica, Prueba invitada!' }),
  ).toBeVisible();
  await expect(page.getByText(/no se registran como nota/)).toBeVisible();
  await page.screenshot({
    path: `../output/publicacion-quiz/quiz-invitado-final-${info.project.name}.png`,
    fullPage: true,
  });
});
