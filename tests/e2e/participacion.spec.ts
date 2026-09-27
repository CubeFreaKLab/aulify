import { expect, test, type Page } from '@playwright/test';
import type { DemoState } from '../../src/domain/types';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

async function answerAndContinue(page: Page, nextPrompt: string) {
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: nextPrompt, exact: true })).toBeVisible();
}

test('ocho tipos de pregunta, pista y doble únicos, escritura pendiente', async ({
  page,
}, testInfo) => {
  await enterDemo(page, 'estudiante');
  await page.goto('/demo/actividad/activity-ecosystems');
  await page.getByRole('button', { name: 'Empezar actividad', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: '¿Quién produce su propio alimento en este ecosistema?',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Una pista', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('utiliza la luz del sol');
  await expect(page.getByRole('button', { name: 'Pista utilizada', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Puntos ×2', exact: true }).click();
  await page.getByRole('radio', { name: /El pasto/ }).check();
  await answerAndContinue(page, 'Selecciona los dos componentes no vivos de un ecosistema.');
  await expect(page.getByRole('button', { name: 'Doble utilizado', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Pista utilizada', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: /Agua/ }).check();
  await page.getByRole('checkbox', { name: /Luz solar/ }).check();
  await answerAndContinue(page, 'La energía pasa de los productores a los consumidores.');
  await page.getByRole('radio', { name: /Verdadero/ }).check();
  await answerAndContinue(page, 'Relaciona cada ser vivo con su función.');
  await page.getByLabel('Relacionar Planta', { exact: true }).selectOption({ label: 'Productor' });
  await page.getByLabel('Relacionar Venado', { exact: true }).selectOption({ label: 'Consumidor' });
  await page
    .getByLabel('Relacionar Hongo', { exact: true })
    .selectOption({ label: 'Descomponedor' });
  await answerAndContinue(page, 'Ordena la cadena alimentaria desde el origen de la energía.');
  // Move each desired element to the top in reverse order, using the keyboard alternative to dragging.
  for (const label of ['Zorro', 'Conejo', 'Pasto', 'Sol']) {
    const up = page.getByRole('button', { name: `Subir ${label}`, exact: true });
    for (let movement = 0; movement < 4 && (await up.isEnabled()); movement++) await up.click();
  }
  await answerAndContinue(page, 'Completa la idea sobre los ecosistemas.');
  await page.getByLabel('Espacio 1', { exact: true }).selectOption({ label: 'bióticos' });
  await page.getByLabel('Espacio 2', { exact: true }).selectOption({ label: 'abióticos' });
  await answerAndContinue(page, 'Completa con tus propias palabras.');
  await page
    .getByLabel('Tu explicación', { exact: true })
    .fill('permite que plantas y animales sobrevivan');
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: '¿Qué podría pasar si desaparecieran los productores? Explica una consecuencia.',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText('¡Bien conectado!', { exact: true })).toHaveCount(0);
  await page
    .getByLabel('Tu respuesta', { exact: true })
    .fill('Se reduciría el alimento disponible para los consumidores.');
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '¡Participación completada!', exact: true }),
  ).toBeVisible();
  const outcome = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    const attempt = state.attempts.find(
      (item) => item.studentId === 'student-camila' && item.activityId === 'activity-ecosystems',
    )!;
    return {
      answeredTypes: attempt.answers.map((answer) => answer.value.type),
      pending: attempt.answers.filter((answer) => answer.reviews.length === 0).length,
      powerups: state.powerups
        .filter((item) => item.studentId === 'student-camila')
        .map((item) => item.kind),
      publications: state.evaluations.filter((item) => item.studentId === 'student-camila').length,
    };
  });
  expect(outcome.answeredTypes).toEqual([
    'single',
    'multiple',
    'true-false',
    'matching',
    'ordering',
    'fill-options',
    'fill-text',
    'open',
  ]);
  expect(outcome.pending).toBe(2);
  expect(outcome.powerups.sort()).toEqual(['double', 'hint']);
  expect(outcome.publications).toBe(0);
  await expectNoHorizontalOverflow(page);
  await testInfo.attach('ocho-tipos-completados', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('sesión guiada creada en interfaz coordina dos pestañas del mismo navegador', async ({
  page,
  context,
}, testInfo) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  await page.getByLabel('Título del recurso').fill('Ecosistema en grupo');
  for (let index = 7; index >= 2; index--)
    await page.getByRole('button', { name: `Eliminar pregunta ${index}`, exact: true }).click();
  await expect(page.getByText('2 preguntas', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Comparte una nueva experiencia' });
  await dialog.getByText('Configuración avanzada', { exact: true }).click();
  await dialog.getByLabel('Ritmo de participación').selectOption('guided');
  await expect(dialog.getByLabel('Intentos por estudiante')).toHaveValue('1');
  await expect(dialog.getByLabel('Mezclar preguntas')).not.toBeChecked();
  await dialog.getByLabel('Cuándo mostrar las respuestas').selectOption('hidden');
  await dialog.getByRole('button', { name: 'Publicar en la materia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biología', exact: true })).toBeVisible();
  const activityId = await page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState).activities.find(
        (item) => item.title === 'Ecosistema en grupo',
      )!.id,
  );
  const studentPage = await context.newPage();
  await enterDemo(studentPage, 'estudiante');
  await studentPage.goto(`/demo/actividad/${activityId}`);
  await studentPage.getByRole('button', { name: 'Unirme a la sala', exact: true }).click();
  expect(
    await studentPage.evaluate(
      (id) =>
        (JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState).attempts.filter(
          (item) => item.activityId === id,
        ).length,
      activityId,
    ),
  ).toBe(0);
  await page.goto(`/demo/actividad/${activityId}`);
  await expect(page.getByText('1 participantes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Comenzar sesión', exact: true }).click();
  await studentPage.getByRole('button', { name: 'Entrar a la actividad', exact: true }).click();
  await expect(
    studentPage.getByRole('heading', {
      name: '¿Quién produce su propio alimento en este ecosistema?',
      exact: true,
    }),
  ).toBeVisible();
  await studentPage.getByRole('radio', { name: /El pasto/ }).check();
  await studentPage.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(
    studentPage.getByRole('heading', { name: 'Tu clase sigue pensando.', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('1 estudiantes respondieron esta pregunta.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar pregunta', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir siguiente pregunta', exact: true }).click();
  await expect(
    studentPage.getByRole('heading', {
      name: '¿Qué podría pasar si desaparecieran los productores? Explica una consecuencia.',
      exact: true,
    }),
  ).toBeVisible();
  await studentPage
    .getByLabel('Tu respuesta', { exact: true })
    .fill('Los consumidores no tendrían suficiente alimento.');
  await studentPage.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(
    studentPage.getByRole('heading', { name: 'Tu clase sigue pensando.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar pregunta', exact: true }).click();
  await expect(
    studentPage.getByRole('heading', { name: '¡Participación completada!', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Finalizada', { exact: true })).toBeVisible();
  expect(
    await studentPage.evaluate((id) => {
      const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
      return state.attempts
        .filter((item) => item.activityId === id)
        .map((item) => ({
          status: item.status,
          pending: item.answers.filter((answer) => answer.reviews.length === 0).length,
        }));
    }, activityId),
  ).toEqual([{ status: 'closed', pending: 1 }]);
  await testInfo.attach('sala-guiada-finalizada', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await studentPage.close();
});
