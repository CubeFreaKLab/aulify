import { expect, test } from '@playwright/test';
import type { DemoState, Question } from '../../src/domain/types';
import { enterDemo } from './helpers';

test('racha se interrumpe con respuesta manual sin bonificar rapidez ni reproducir sonidos', async ({
  page,
}, testInfo) => {
  test.setTimeout(45_000);
  page.setDefaultTimeout(10_000);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const create = AudioContext.prototype.createOscillator;
    const events: number[] = [];
    Object.defineProperty(window, '__aulifyStreakAudio', { value: events });
    AudioContext.prototype.createOscillator = function () {
      const oscillator = create.call(this);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (when) => {
        events.push(performance.now());
        start(when);
      };
      return oscillator;
    };
  });
  await enterDemo(page, 'estudiante');
  const questions: Question[] = [
    {
      id: 'racha-1',
      type: 'single',
      prompt: 'Primera conexión',
      points: 2,
      options: [
        { id: 'si-1', text: 'Productor' },
        { id: 'no-1', text: 'Consumidor' },
      ],
      correctOptionId: 'si-1',
    },
    {
      id: 'racha-2',
      type: 'single',
      prompt: 'Segunda conexión',
      points: 2,
      options: [
        { id: 'si-2', text: 'Luz solar' },
        { id: 'no-2', text: 'Plástico' },
      ],
      correctOptionId: 'si-2',
    },
    {
      id: 'racha-3',
      type: 'open',
      prompt: 'Explica con tus palabras',
      points: 2,
      manual: true,
      manualGuide: 'Valorar la relación entre energía y organismos.',
    },
    {
      id: 'racha-4',
      type: 'single',
      prompt: 'Última conexión',
      points: 2,
      options: [
        { id: 'si-4', text: 'Agua' },
        { id: 'no-4', text: 'Metal' },
      ],
      correctOptionId: 'si-4',
    },
  ];
  await page.evaluate((items) => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    const activity = structuredClone(state.activities.find((a) => a.id === 'activity-ecosystems')!);
    const version = structuredClone(state.versions.find((v) => v.id === activity.versionId)!);
    activity.id = 'activity-racha';
    activity.versionId = 'version-racha';
    version.id = 'version-racha';
    version.blocks = [{ id: 'bloque-racha', type: 'quiz', questions: items }];
    Object.assign(activity.settings, {
      sound: false,
      streaks: true,
      allowHint: false,
      allowDouble: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      feedback: 'immediate',
      manualCorrection: false,
    });
    state.activities.push(activity);
    state.versions.push(version);
    localStorage.setItem('aulify.demo.v1', JSON.stringify(state));
  }, questions);
  await page.goto('/demo/actividad/activity-racha');
  await page.getByRole('button', { name: 'Empezar actividad', exact: true }).click();
  const streak = page.getByRole('status').filter({ hasText: /aciertos seguidos/ });
  for (const [index, option] of ['Productor', 'Luz solar'].entries()) {
    await page.getByRole('radio', { name: new RegExp(`${option}$`) }).check();
    await page.getByRole('button', { name: 'Responder', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '¡Bien conectado!', exact: true }),
    ).toBeVisible();
    if (index === 0) await expect(streak).toHaveCount(0);
    else await expect(streak).toHaveText('2 aciertos seguidos. ¡Sigue pensando!');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  }
  await expect(
    page.getByRole('heading', { name: 'Explica con tus palabras', exact: true }),
  ).toBeVisible();
  await page.getByRole('textbox').fill('La energía conecta los organismos de un ecosistema.');
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Última conexión', exact: true })).toBeVisible();
  await expect(streak).toHaveCount(0);
  // La pausa deliberada también conserva el valor: el tiempo de respuesta no bonifica puntos.
  await page.waitForTimeout(1100);
  await page.getByRole('radio', { name: /Agua$/ }).check();
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¡Bien conectado!', exact: true })).toBeVisible();
  await expect(streak).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '¡Participación completada!', exact: true }),
  ).toBeVisible();
  const observation = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
    const attempt = state.attempts.find(
      (a) => a.studentId === 'student-camila' && a.activityId === 'activity-racha',
    )!;
    return {
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      audio: (window as unknown as { __aulifyStreakAudio: number[] }).__aulifyStreakAudio,
      answers: attempt.answers.map((answer) => ({
        id: answer.questionId,
        usedDouble: answer.usedDouble,
        reviews: answer.reviews,
      })),
      powerups: state.powerups.filter((use) => use.studentId === 'student-camila'),
      status: attempt.status,
    };
  });
  expect(observation.status).toBe('closed');
  expect(observation.reducedMotion).toBe(true);
  expect(observation.audio).toEqual([]);
  expect(observation.powerups).toEqual([]);
  expect(observation.answers).toHaveLength(4);
  expect(observation.answers[2].reviews).toEqual([]);
  for (const index of [0, 1, 3]) {
    expect(observation.answers[index].usedDouble).toBe(false);
    expect(observation.answers[index].reviews.at(-1)?.points).toEqual({
      numerator: 2,
      denominator: 1,
    });
  }
  await testInfo.attach('racha-y-puntos', {
    body: JSON.stringify(observation, null, 2),
    contentType: 'application/json',
  });
});
