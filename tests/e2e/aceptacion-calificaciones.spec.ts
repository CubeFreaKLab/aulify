import { expect, test } from '@playwright/test';
import {
  createDemoState,
  DEMO_IDS,
  publishGrade,
  reviewAnswer,
  startAttempt,
  submitAnswer,
  type DemoState,
  type OperationContext,
  type Question,
} from '../../src/domain';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

function threeAttempts() {
  const now = new Date().toISOString();
  let state = createDemoState(now);
  const question: Question = {
    id: 'ac22-written',
    type: 'open',
    prompt: 'Explica cómo se relacionan dos seres vivos.',
    points: 5,
    manual: true,
    manualGuide: 'Valorar la relación explicada, hasta cinco puntos.',
  };
  state.attempts = [];
  state.evaluations = [];
  state.powerups = [];
  state.versions[0].blocks = [{ id: 'ac22-quiz', type: 'quiz', questions: [question] }];
  state.resources[0].blocks = structuredClone(state.versions[0].blocks);
  delete state.activities[0].lockedAt;
  state.activities[0].title = 'AC-22 · Tres intentos y una publicación';
  state.activities[0].settings = {
    ...state.activities[0].settings,
    maxGrade: 100,
    maxAttempts: 3,
    shuffleQuestions: false,
  };
  const context = (actorId: string, id: string): OperationContext => ({ actorId, id, now });
  for (const [index, points] of [3, 4, null].entries()) {
    const attemptId = `ac22-attempt-${index + 1}`;
    const student = context(DEMO_IDS.student, attemptId);
    state = startAttempt(state, DEMO_IDS.activity, DEMO_IDS.student, student).state;
    state = submitAnswer(
      state,
      attemptId,
      question.id,
      { type: 'open', text: `Explicación del intento ${index + 1}.` },
      `ac22-response-${index + 1}`,
      false,
      student,
    ).state;
    if (points !== null)
      state = reviewAnswer(
        state,
        attemptId,
        question.id,
        points,
        'Revisión docente.',
        undefined,
        context(DEMO_IDS.teacher, `ac22-review-${index + 1}`),
      ).state;
    if (index === 0)
      state = publishGrade(
        state,
        DEMO_IDS.activity,
        DEMO_IDS.student,
        context(DEMO_IDS.teacher, 'ac22-first-publication'),
      ).state;
  }
  return state;
}

test('AC-22: indica el tercer intento pendiente y conserva 60 hasta publicar el candidato 80', async ({
  page,
}, testInfo) => {
  await page.addInitScript((initial) => {
    if (!localStorage.getItem('aulify.demo.v1'))
      localStorage.setItem('aulify.demo.v1', JSON.stringify(initial));
  }, threeAttempts());
  await enterDemo(page, 'estudiante');
  await page.goto('/demo/resultados');
  const result = page
    .getByRole('row')
    .filter({ hasText: 'AC-22 · Tres intentos y una publicación' });
  await expect(result.locator('.grade-number')).toHaveText('60');

  await enterDemo(page, 'docente');
  await page.goto('/demo/revision');
  const pending = page.locator('.review-person').filter({ hasText: 'Intento 3' });
  await expect(pending).toContainText('1 por corregir');
  await pending.click();
  const detail = page.getByRole('region', { name: 'Respuestas del intento seleccionado' });
  await expect(detail.getByText('Pendiente de revisión', { exact: true })).toBeVisible();
  await expect(detail.getByText('1 respuestas por corregir', { exact: true })).toBeVisible();
  await expect(detail.locator('.results-publish-form')).toContainText(
    'El mejor intento completo es el 2: 80 / 100',
  );
  await expect(detail).toContainText('Última nota publicada: 60 / 100');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('ac22-pendiente.png'), fullPage: true });
  await detail
    .getByLabel('Motivo de la nueva publicación')
    .fill('Se publica el mejor intento corregido.');
  await detail.getByRole('button', { name: 'Publicar nota de Camila' }).click();
  await expect(detail).toContainText('Última nota publicada: 80 / 100');
  await expect(detail.getByText('Pendiente de revisión', { exact: true })).toBeVisible();
  await expect(pending).toContainText('1 por corregir');
  const persisted = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState,
  );
  expect(persisted.evaluations.map(({ grade }) => grade)).toEqual([60, 80]);
  expect(persisted.evaluations[1].attemptId).toBe('ac22-attempt-2');
  expect(persisted.attempts[2].answers[0].reviews).toEqual([]);
  await enterDemo(page, 'estudiante');
  await page.goto('/demo/resultados');
  await page.reload();
  await expect(result.locator('.grade-number')).toHaveText('80');
  await expect(result).toContainText('Publicada');
  await expectNoHorizontalOverflow(page);
});
