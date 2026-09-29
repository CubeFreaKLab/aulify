import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { DemoState } from '../../src/domain/types';
import { dismissGuide, enterDemo, expectNoHorizontalOverflow } from './helpers';

test('ayuda opcional, navegación por rol y acceso no concedido a herramientas docentes', async ({
  page,
}) => {
  await page.goto('/demo?perfil=docente');
  await expect(page.getByRole('dialog')).toBeVisible();
  const attemptsBefore = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState).attempts.length,
  );
  await dismissGuide(page);
  await expect(page.getByRole('button', { name: 'Crear recurso', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Elena.', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState).attempts.length,
    ),
  ).toBe(attemptsBefore);
  await enterDemo(page, 'estudiante');
  await expect(page.getByRole('button', { name: 'Crear recurso', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Biblioteca', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Por revisar/ })).toHaveCount(0);
  await page.goto('/demo/editor/resource-ecosystems');
  await expect(
    page.getByRole('heading', { name: 'Este espacio no está disponible', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Título del recurso')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Cambiar perfil', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Lucía Flores/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Hola, Lucía.', exact: true })).toBeVisible();
  await dismissGuide(page);
  await page.goto('/demo/actividad/activity-ecosystems');
  await expect(
    page.getByRole('heading', { name: 'Esta actividad necesita una invitación.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar actividad', exact: true })).toHaveCount(0);
});

test('diálogo por teclado devuelve foco y no altera los datos al cerrar', async ({ page }) => {
  await enterDemo(page, 'docente');
  const trigger = page.getByRole('button', { name: 'Cambiar perfil', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Explora otro lado de la clase' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Hola, Elena.', exact: true })).toBeVisible();
});

for (const motion of ['no-preference', 'reduce'] as const) {
  test(`vista previa conserva foco y contenido con movimiento ${motion}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: motion });
    await enterDemo(page, 'docente');
    await page.goto('/demo/biblioteca');
    // La navegación enfoca el h1 en el siguiente frame; termina antes de probar otro foco.
    await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeFocused();
    const trigger = page.getByRole('button', { name: 'Vista previa', exact: true }).first();
    const dialog = page.getByRole('dialog', { name: 'Vista previa', exact: true });
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Ecosistemas: todo está conectado' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('link', { name: 'Explorar el recurso completo' }).click();
    await expect(page.locator('.rich-reader h1')).toHaveText('Ecosistemas: todo está conectado');
    expect(
      await page.evaluate(
        () => (JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState).attempts.length,
      ),
    ).toBe(1);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
}

for (const profile of ['docente', 'estudiante'] as const) {
  test(`accesibilidad automática y reflujo del inicio ${profile}`, async ({ page }, testInfo) => {
    await enterDemo(page, profile);
    await expectNoHorizontalOverflow(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    await testInfo.attach('axe-inicio', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });
    expect(results.violations).toEqual([]);
  });
}

test('almacenamiento corrupto ofrece recuperación explícita sin sobrescribir al leer', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('test-corruption-initialized')) {
      localStorage.setItem('aulify.demo.v1', '{invalid-demo');
      sessionStorage.setItem('test-corruption-initialized', 'yes');
    }
  });
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'No pudimos abrir la muestra.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('aulify.demo.v1'))).toBe('{invalid-demo');
  await page.getByRole('button', { name: 'Reiniciar datos de demostración' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Elena.' })).toBeVisible();
  await dismissGuide(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Elena.' })).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText('no se pudieron restaurar');
});

test('recurso existente conserva negrita, bloque quiz y orden después de recargar', async ({
  page,
}, testInfo) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  const richEditor = page.locator('.bn-editor[contenteditable="true"]');
  await expect(richEditor).toBeVisible();
  await expect(richEditor.getByRole('button', { name: 'Editar las preguntas ↓' })).toBeVisible();
  const initialOrder = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    return state.resources
      .find((resource) => resource.id === 'resource-ecosystems')!
      .blocks.slice(0, 2)
      .map((block) => block.id);
  });
  const boldText = 'Conexión comprobada';
  await richEditor.getByText(/^Un ecosistema está formado por seres vivos/).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' ');
  await page.keyboard.press('Control+b');
  await page.keyboard.type(boldText);
  await page.keyboard.press('Control+b');

  const readDocument = () =>
    page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
      const resource = state.resources.find((item) => item.id === 'resource-ecosystems')!;
      return resource.editorDocument as
        | Array<{
            id: string;
            type: string;
            content?: Array<{ text?: string; styles?: { bold?: boolean } }>;
          }>
        | undefined;
    });
  await expect
    .poll(async () =>
      (await readDocument())?.some((block) =>
        block.content?.some((text) => text.text?.includes(boldText) && text.styles?.bold),
      ),
    )
    .toBe(true);
  const persisted = (await readDocument())!;
  expect(persisted.filter((block) => block.type === 'quiz')).toHaveLength(1);
  expect(persisted.find((block) => block.type === 'quiz')).not.toHaveProperty('content');
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await expect(page.getByText('El borrador no se guardó.', { exact: true })).toHaveCount(0);
  await page.reload();
  const visibleBold = richEditor.getByText(boldText, { exact: true });
  await expect(visibleBold).toBeVisible();
  expect(
    await visibleBold.evaluate((element) => Number(getComputedStyle(element).fontWeight)),
  ).toBeGreaterThanOrEqual(600);
  expect(await readDocument()).toEqual(persisted);

  const orderControl = page.getByText('Ordenar bloques con botones', { exact: true });
  await orderControl.focus();
  await page.keyboard.press('Enter');
  const down = page.getByRole('button', { name: 'Bajar bloque 1', exact: true });
  await expect(down).toBeEnabled();
  await down.focus();
  await page.keyboard.press('Enter');
  const reordered = [initialOrder[1], initialOrder[0]];
  await expect
    .poll(async () => (await readDocument())?.slice(0, 2).map((block) => block.id))
    .toEqual(reordered);
  await page.reload();
  await expect(visibleBold).toBeVisible();
  await expect(richEditor.getByRole('button', { name: 'Editar las preguntas ↓' })).toBeVisible();
  expect((await readDocument())?.slice(0, 2).map((block) => block.id)).toEqual(reordered);
  await orderControl.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.block-order-row').first()).toContainText(
    '1. Un ecosistema está formado',
  );
  await expect(page.locator('.block-order-row').nth(1)).toContainText('2. Todo está conectado');
  await expect(page.getByText('8 preguntas', { exact: true })).toBeVisible();
  await testInfo.attach('editor-existente-negrita-y-orden', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('recurso → publicación → quiz oculto → revisión → nota publicada', async ({
  page,
}, testInfo) => {
  await enterDemo(page, 'docente');
  await page.getByRole('button', { name: 'Crear recurso', exact: true }).click();
  await expect(page.getByLabel('Título del recurso')).toHaveValue('Mi nuevo recurso');
  const editorURL = page.url();
  const title = 'La energía conecta nuestro ecosistema';
  await page.getByLabel('Título del recurso').fill(title);
  const richEditor = page.locator('.bn-editor[contenteditable="true"]');
  await expect(richEditor).toBeVisible();
  await richEditor.getByText('Escribe una explicación para tu clase.', { exact: true }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Las plantas transforman la luz en alimento para el ecosistema.');
  await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Una respuesta', exact: true })
    .click();
  await page.getByLabel('Pregunta', { exact: true }).fill('¿Cuál es un productor?');
  await page.getByLabel('Texto de opción 1', { exact: true }).fill('La planta');
  await page.getByLabel('Texto de opción 2', { exact: true }).fill('El conejo');
  await page
    .getByLabel('Explicación de la respuesta')
    .fill('La planta transforma la energía solar en alimento.');
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Respuesta abierta', exact: true })
    .click();
  await page
    .getByLabel('Pregunta', { exact: true })
    .fill('Explica una consecuencia de perder los productores.');
  await page
    .getByLabel('Guía de corrección (solo docente)')
    .fill('Relaciona productores, alimento y supervivencia de consumidores.');
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((expected) => {
        const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
        const resource = state.resources.find((item) => item.title === expected);
        return resource?.blocks.find((block) => block.type === 'quiz')?.questions.length;
      }, title),
    )
    .toBe(2);
  await page.reload();
  await expect(page.getByLabel('Título del recurso')).toHaveValue(title);
  await expect(page.locator('.bn-editor[contenteditable="true"]')).toContainText(
    'Las plantas transforman la luz en alimento para el ecosistema.',
  );
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  await expect(page.locator('.reader-toolbar')).toContainText('Vista previa');
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const attemptsBefore = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState).attempts.length,
  );
  expect(attemptsBefore).toBe(1);
  await page.getByRole('link', { name: 'Volver al editor', exact: true }).click();
  await expect(page.getByLabel('Título del recurso')).toHaveValue(title);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const publishDialog = page.getByRole('dialog', { name: 'Comparte una nueva experiencia' });
  await publishDialog.getByLabel('Incluir en el promedio de la materia').check();
  await publishDialog.getByText('Configuración avanzada', { exact: true }).click();
  await publishDialog.getByLabel('Cuándo mostrar las respuestas').selectOption('hidden');
  await publishDialog.getByRole('button', { name: 'Publicar en la materia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biología', exact: true })).toBeVisible();
  const activityId = await page.evaluate(
    (expected) =>
      (JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState).activities.find(
        (item) => item.title === expected,
      )!.id,
    title,
  );
  await enterDemo(page, 'estudiante');
  await page.goto(`/demo/actividad/${activityId}`);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Empezar actividad', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '¿Cuál es un productor?', exact: true }),
  ).toBeFocused();
  await page.getByRole('radio', { name: /La planta/ }).check();
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Explica una consecuencia de perder los productores.',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/¡Bien conectado!|Una oportunidad para descubrir|Respuesta guardada/),
  ).toHaveCount(0);
  await expect(
    page.getByText('La planta transforma la energía solar en alimento.', { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.quiz-feedback')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await testInfo.attach('quiz-sin-correccion-visible', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await page
    .getByLabel('Tu respuesta', { exact: true })
    .fill('Los consumidores perderían su fuente de alimento.');
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '¡Participación completada!', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver mis resultados', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cada paso cuenta.' })).toBeVisible();
  const ownRow = page.getByRole('row').filter({ has: page.getByText(title, { exact: true }) });
  await expect(ownRow).toContainText('Por revisar');
  await expect(ownRow).not.toContainText('0 / 100');
  await enterDemo(page, 'docente');
  await page.goto('/demo/revision');
  await page.getByRole('button', { name: new RegExp(`Camila Ríos.*${title}`) }).click();
  const review = page.getByRole('region', { name: 'Respuestas del intento seleccionado' });
  await expect(review.getByRole('button', { name: 'Publicar nota de Camila' })).toBeDisabled();
  await review.getByLabel('Puntos, de 0 a 1', { exact: true }).fill('0.5');
  await review
    .getByLabel('Comentario para el estudiante', { exact: true })
    .fill('La consecuencia es correcta; desarrolla cómo circula la energía.');
  await review.getByRole('button', { name: 'Guardar corrección', exact: true }).click();
  await review.getByRole('button', { name: 'Publicar nota de Camila', exact: true }).click();
  await expect(review.getByText('Nota publicada', { exact: true })).toBeVisible();
  await page.goto(editorURL);
  await expect(page.getByLabel('Título del recurso')).toHaveValue(title);
  await page.getByLabel('Título del recurso').fill('Borrador cambiado después de publicar');
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await enterDemo(page, 'estudiante');
  await page.goto('/demo/resultados');
  await expect(page.getByRole('heading', { name: 'Cada paso cuenta.' })).toBeVisible();
  const publishedRow = page
    .getByRole('row')
    .filter({ has: page.getByText(title, { exact: true }) });
  await expect(publishedRow).toContainText('Publicada');
  await expect(publishedRow).toContainText('75');
  await expect(publishedRow).not.toContainText('Pregunta 1:');
  await expect(
    page.getByText('Borrador cambiado después de publicar', { exact: true }),
  ).toHaveCount(0);
  await testInfo.attach('nota-publicada', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});
