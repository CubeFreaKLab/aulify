import { expect, test } from '@playwright/test';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

test('ocultamiento explica la reserva de respuestas y desactiva rachas y clasificación', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  await expect(page.getByLabel('Título del recurso')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Comparte una nueva experiencia' });
  await dialog.getByText('Configuración avanzada', { exact: true }).click();
  const feedback = dialog.getByLabel('Cuándo mostrar las respuestas', { exact: true });
  const streaks = dialog.getByRole('checkbox', {
    name: 'Mostrar rachas de aciertos cuando la corrección sea visible',
    exact: true,
  });
  const ranking = dialog.getByRole('checkbox', {
    name: 'Compartir clasificación con alias',
    exact: true,
  });
  await feedback.selectOption('immediate');
  await streaks.check();
  await ranking.check();
  await expect(streaks).toBeChecked();
  await expect(ranking).toBeChecked();

  await feedback.selectOption('hidden');
  const explanation = dialog.getByRole('status');
  await expect(explanation).toBeVisible();
  await expect(explanation).toContainText(
    'se desactivan las rachas y la clasificación para estudiantes porque pueden revelar aciertos',
  );
  await expect(explanation).toContainText(
    'Puedes publicar la nota final por separado; las respuestas y sus correcciones seguirán ocultas.',
  );
  for (const control of [streaks, ranking]) {
    await expect(control).not.toBeChecked();
    await expect(control).toBeDisabled();
    await expect(control).toHaveAccessibleDescription(/pueden revelar aciertos/);
  }
  await expect(feedback).toHaveAccessibleDescription(/Puedes publicar la nota final por separado/);
  await expectNoHorizontalOverflow(page);
  await explanation.scrollIntoViewIfNeeded();
  await expect(explanation).toBeInViewport();
  await testInfo.attach('configuracion-ocultamiento-explicada', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await feedback.selectOption('immediate');
  await expect(explanation).not.toContainText('se desactivan');
  await expect(feedback).toHaveAccessibleDescription(
    'La publicación de la nota es independiente de cuándo se muestran las respuestas.',
  );
  for (const control of [streaks, ranking]) {
    await expect(control).toBeEnabled();
    await expect(control).not.toBeChecked();
    await expect(control).not.toHaveAttribute('aria-describedby');
    await control.check();
    await expect(control).toBeChecked();
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});
