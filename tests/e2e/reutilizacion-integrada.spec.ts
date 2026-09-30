import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { Activity, DemoState, Resource, ResourceVersion } from '../../src/domain/types';
import { defaultActivitySettings } from '../../src/domain/demo-data';
import { questionsOf } from '../../src/domain/rules';
import { dismissGuide, expectNoHorizontalOverflow } from './helpers';

test.use({ trace: 'off', video: 'off', screenshot: 'off', reducedMotion: 'reduce' });
test.setTimeout(180_000);
const enabled = process.env.AULIFY_REMOTE_E2E === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001';
const headers = { Origin: new URL(baseURL).origin, 'Sec-Fetch-Site': 'same-origin' };
type Account = { id: string; email: string; password: string };
type Snapshot = {
  state: DemoState;
  readings: { id: string; subjectId: string; title: string; content: ResourceVersion }[];
};

async function login(request: APIRequestContext, account: Account) {
  const response = await request.post(`${baseURL}/api/auth`, {
    headers,
    data: { action: 'access', email: account.email, password: account.password },
  });
  expect(response.status(), 'Acceso de cuenta ficticia').toBe(200);
}
async function command<T = unknown>(
  request: APIRequestContext,
  action: string,
  ...args: unknown[]
) {
  const response = await request.post(`${baseURL}/api/commands`, {
    headers,
    data: { action, args },
  });
  if (!response.ok())
    throw new Error(`${action}: HTTP ${response.status()}: ${(await response.json()).error}`);
  return (await response.json()).result as T;
}
async function snapshot(request: APIRequestContext, activityId?: string): Promise<Snapshot> {
  const response = await request.get(
    `${baseURL}/api/workspace${activityId ? `?activity=${activityId}` : ''}`,
  );
  expect(response.status()).toBe(200);
  return response.json();
}
async function publishFromEditor(page: Page, subjectId: string, quiz: boolean) {
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Comparte una nueva experiencia' });
  await dialog.getByLabel('Materia', { exact: true }).selectOption(subjectId);
  if (quiz) {
    await dialog.getByLabel('Nota máxima', { exact: true }).fill('30');
    await dialog.getByText('Configuración avanzada', { exact: true }).click();
    await dialog.getByLabel('Intentos por estudiante', { exact: true }).fill('1');
  } else {
    await expect(dialog).toContainText(
      'Se compartirá como lectura. No genera intentos ni calificación.',
    );
    await expect(dialog.getByLabel('Nota máxima', { exact: true })).toHaveCount(0);
  }
  await dialog.getByRole('button', { name: 'Publicar en la materia', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(`${baseURL}/aula/materia/${subjectId}`);
}
async function answerTrue(page: Page, activityId: string, prompt: string) {
  await page.goto(`/aula/actividad/${activityId}`);
  await dismissGuide(page);
  await page.getByRole('button', { name: 'Empezar actividad', exact: true }).click();
  await expect(page.getByRole('heading', { name: prompt, exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /Verdadero$/ }).check();
  const answered = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/commands') &&
      response.request().postDataJSON()?.action === 'submitAnswer' &&
      response.ok(),
  );
  await page.getByRole('button', { name: 'Responder', exact: true }).click();
  await answered;
  await expect
    .poll(async () => (await snapshot(page.request, activityId)).state.attempts[0]?.status)
    .toBe('closed');
}

test('reutiliza un quiz respondido entre materias y publica lectura sin copiar personas, respuestas ni notas', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(!enabled, 'Necesita las cuentas ficticias y el servicio remoto del proyecto.');
  expect(new URL(baseURL).hostname).toBe('127.0.0.1');
  const accounts = JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8'));
  expect(accounts.projectRef).toBe('bnqyyumfmyexsqszglab');
  const studentContexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({
        baseURL,
        locale: 'es-BO',
        timezoneId: 'America/La_Paz',
        viewport: testInfo.project.use.viewport,
        reducedMotion: 'reduce',
        colorScheme: 'light',
      }),
    ),
  );
  const subjects: string[] = [];
  const checks: string[] = [];
  const evidence: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    status: 'running',
    cases: ['AP-01', 'AP-02'],
    project: testInfo.project.name,
    baseURL,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    buildId: fs.readFileSync('.next/BUILD_ID', 'utf8').trim(),
    sourceSha256: createHash('sha256').update(fs.readFileSync(testInfo.file)).digest('hex'),
    checks,
  };
  try {
    await login(page.request, accounts.users.teacher);
    await login(studentContexts[0].request, accounts.users.student);
    await login(studentContexts[1].request, accounts.users.studentOther);
    const students = await Promise.all(studentContexts.map((c) => c.newPage()));
    const suffix = `${testInfo.project.name} · ${randomUUID().slice(0, 6)}`;
    for (const course of ['3.º A', '3.º B']) {
      const subject = await command<{ id: string }>(page.request, 'createSubject', {
        name: `Reutilización · ${course} · ${suffix}`,
        course,
        year: 2026,
        description: 'Materia ficticia para comprobar versiones independientes y lecturas.',
      });
      subjects.push(subject.id);
    }
    evidence.subjectIds = subjects;
    let overview = await snapshot(page.request);
    const codeA = overview.state.subjects.find((s) => s.id === subjects[0])!.code;
    const memberA = await command<{ id: string }>(students[0].request, 'requestMembership', codeA);
    await command(page.request, 'decideMembership', memberA.id, 'approved');
    const question = {
      id: randomUUID(),
      type: 'true-false',
      prompt: 'Las plantas necesitan agua.',
      points: 2,
      correct: true,
    };
    const resource = await command<Resource>(
      page.request,
      'saveDraft',
      {
        id: randomUUID(),
        title: `El agua en las plantas · ${suffix}`,
        kind: 'quiz',
        revision: 0,
        blocks: [{ id: randomUUID(), type: 'quiz', questions: [question] }],
      },
      0,
    );
    const version = await command<ResourceVersion>(page.request, 'publishResource', resource.id);
    const original = await command<Activity>(
      page.request,
      'createActivity',
      version.id,
      subjects[0],
      {
        ...defaultActivitySettings(new Date(Date.now() - 60_000).toISOString()),
        maxGrade: 20,
        maxAttempts: 1,
        feedback: 'hidden',
        streaks: false,
        ranking: false,
        sound: false,
        shuffleQuestions: false,
        shuffleOptions: false,
      },
    );
    await answerTrue(students[0], original.id, question.prompt);
    const originalGrade = await command<{ grade: number }>(
      page.request,
      'publishGrade',
      original.id,
      accounts.users.student.id,
    );
    expect(originalGrade.grade).toBe(20);
    const beforeOriginal = await snapshot(page.request, original.id);
    const beforeAttempt = beforeOriginal.state.attempts[0];
    expect(beforeAttempt.answers).toHaveLength(1);
    const beforeVersion = beforeOriginal.state.versions.find((v) => v.id === version.id);
    expect(beforeVersion?.id).toBe(version.id);
    const beforeEvaluations = beforeOriginal.state.evaluations.filter(
      (e) => e.activityId === original.id,
    );
    expect(beforeEvaluations).toHaveLength(1);
    evidence.original = {
      resourceId: resource.id,
      versionId: version.id,
      activityId: original.id,
      attemptId: beforeAttempt.id,
      grade: 20,
    };
    checks.push(
      'Materia A con E1 aprobado, quiz independiente respondido y nota 20/20 publicada antes de duplicar.',
    );

    await page.goto('/aula/biblioteca');
    await dismissGuide(page);
    await page.getByLabel('Buscar recursos').fill(resource.title);
    const item = page.getByRole('article', { name: resource.title, exact: true });
    await item.getByRole('button', { name: 'Duplicar', exact: true }).click();
    await expect(page.getByLabel('Título del recurso')).toHaveValue(`${resource.title} (copia)`);
    const copyId = new URL(page.url()).pathname.split('/').at(-1)!;
    expect(copyId).not.toBe(resource.id);
    const copyTitle = `Las raíces toman agua · ${suffix}`;
    const copyPrompt = 'Las raíces absorben agua del suelo.';
    await page.getByLabel('Título del recurso').fill(copyTitle);
    await page.getByRole('button', { name: `1. ${question.prompt}`, exact: true }).click();
    await page.getByLabel('Pregunta', { exact: true }).fill(copyPrompt);
    await page.getByLabel('Valor en puntos', { exact: true }).fill('4');
    await publishFromEditor(page, subjects[1], true);
    overview = await snapshot(page.request);
    const copy = overview.state.resources.find((r) => r.id === copyId)!;
    const copiedActivity = overview.state.activities.find((a) => a.subjectId === subjects[1])!;
    expect(copy.kind).toBe('quiz');
    expect(questionsOf(copy)).toMatchObject([{ prompt: copyPrompt, points: 4 }]);
    expect(copiedActivity.versionId).not.toBe(version.id);
    expect(copiedActivity.settings).toMatchObject({
      maxGrade: 30,
      maxAttempts: 1,
      pace: 'individual',
    });
    expect(overview.state.memberships.filter((m) => m.subjectId === subjects[1])).toEqual([]);
    expect(overview.state.attempts.filter((a) => a.activityId === copiedActivity.id)).toEqual([]);
    expect(overview.state.evaluations.filter((e) => e.activityId === copiedActivity.id)).toEqual(
      [],
    );
    expect(overview.state.resources.find((r) => r.id === resource.id)).toEqual(resource);
    const originalAfterCopy = await snapshot(page.request, original.id);
    expect(originalAfterCopy.state.versions.find((v) => v.id === version.id)).toEqual(
      beforeVersion,
    );
    expect(originalAfterCopy.state.attempts).toEqual([beforeAttempt]);
    expect(originalAfterCopy.state.evaluations.filter((e) => e.activityId === original.id)).toEqual(
      beforeEvaluations,
    );
    evidence.copy = {
      resourceId: copyId,
      activityId: copiedActivity.id,
      versionId: copiedActivity.versionId,
    };
    checks.push(
      'Duplicación y edición por interfaz; copia publicada en B, sin integrantes, intentos ni notas. Original, versión respondida, respuesta y evaluación intactos.',
    );

    const codeB = overview.state.subjects.find((s) => s.id === subjects[1])!.code;
    const memberB = await command<{ id: string }>(students[1].request, 'requestMembership', codeB);
    await command(page.request, 'decideMembership', memberB.id, 'approved');
    const studentAOverview = await snapshot(students[0].request);
    const studentBOverview = await snapshot(students[1].request);
    expect(studentAOverview.state.subjects.some((s) => s.id === subjects[1])).toBe(false);
    expect(studentBOverview.state.subjects.some((s) => s.id === subjects[0])).toBe(false);
    expect(
      studentBOverview.state.attempts.filter((a) => a.activityId === copiedActivity.id),
    ).toEqual([]);
    checks.push(
      'E2 se incorpora a B mediante código y aprobación; ambas materias mantienen pertenencia y acceso separados.',
    );

    const readingText =
      'Observa una planta durante una semana y describe cómo cambia el suelo al regarla.';
    const reading = await command<Resource>(
      page.request,
      'saveDraft',
      {
        id: randomUUID(),
        title: `Cuaderno de observación · ${suffix}`,
        kind: 'resource',
        revision: 0,
        blocks: [{ id: randomUUID(), type: 'text', text: readingText }],
      },
      0,
    );
    await page.goto(`/aula/editor/${reading.id}`);
    await expect(page.getByLabel('Título del recurso')).toHaveValue(reading.title);
    await publishFromEditor(page, subjects[1], false);
    const beforeReading = await snapshot(students[1].request);
    const publishedReading = beforeReading.readings.find((r) => r.subjectId === subjects[1])!;
    expect(publishedReading.title).toBe(reading.title);
    expect(
      beforeReading.state.activities.filter((a) => a.subjectId === subjects[1]).map((a) => a.id),
    ).toEqual([copiedActivity.id]);
    await students[1].goto(`/aula/materia/${subjects[1]}`);
    await dismissGuide(students[1]);
    await students[1].getByRole('button', { name: 'Leer recurso', exact: true }).click();
    const reader = students[1].getByRole('dialog', { name: 'Recurso de lectura', exact: true });
    await expect(reader.getByText(readingText, { exact: true })).toBeVisible();
    await expect(reader.getByRole('button', { name: /Responder|Empezar actividad/ })).toHaveCount(
      0,
    );
    await expectNoHorizontalOverflow(students[1]);
    await students[1].screenshot({
      path: testInfo.outputPath('lectura-estudiante.png'),
      fullPage: true,
    });
    const afterReading = await snapshot(students[1].request);
    expect(afterReading.state.attempts).toEqual(beforeReading.state.attempts);
    expect(afterReading.state.evaluations).toEqual(beforeReading.state.evaluations);
    evidence.reading = {
      resourceId: reading.id,
      publicationId: publishedReading.id,
      noAttemptOrGrade: true,
    };
    checks.push(
      'Lectura publicada desde el editor y consultada visualmente por E2, sin pregunta, intento ni nota nueva.',
    );

    await answerTrue(students[1], copiedActivity.id, copyPrompt);
    const copyAttempt = (await snapshot(page.request, copiedActivity.id)).state.attempts[0];
    expect(copyAttempt.studentId).toBe(accounts.users.studentOther.id);
    expect(copyAttempt.id).not.toBe(beforeAttempt.id);
    expect(copyAttempt.answers).toHaveLength(1);
    const copyGrade = await command<{ grade: number }>(
      page.request,
      'publishGrade',
      copiedActivity.id,
      accounts.users.studentOther.id,
    );
    expect(copyGrade.grade).toBe(30);
    const exhausted = await students[1].request.post(`${baseURL}/api/commands`, {
      headers,
      data: { action: 'startAttempt', args: [copiedActivity.id] },
    });
    expect(exhausted.status()).toBe(400);
    const afterQuiz = await snapshot(page.request, copiedActivity.id);
    expect(afterQuiz.state.attempts).toHaveLength(1);
    const finalOriginal = await snapshot(page.request, original.id);
    expect(finalOriginal.state.attempts).toEqual([beforeAttempt]);
    expect(finalOriginal.state.versions.find((v) => v.id === version.id)).toEqual(beforeVersion);
    expect(finalOriginal.state.evaluations.filter((e) => e.activityId === original.id)).toEqual(
      beforeEvaluations,
    );
    const finalOverview = await snapshot(page.request);
    expect(
      finalOverview.state.memberships
        .filter((m) => subjects.includes(m.subjectId))
        .map((m) => ({ subjectId: m.subjectId, studentId: m.studentId }))
        .sort((a, b) => a.subjectId.localeCompare(b.subjectId)),
    ).toEqual(
      [
        { subjectId: subjects[0], studentId: accounts.users.student.id },
        { subjectId: subjects[1], studentId: accounts.users.studentOther.id },
      ].sort((a, b) => a.subjectId.localeCompare(b.subjectId)),
    );
    evidence.copy = {
      ...(evidence.copy as object),
      attemptId: copyAttempt.id,
      grade: 30,
      attempts: 1,
    };
    checks.push(
      'Quiz B usa su configuración: una respuesta, nota 30/30 y segundo intento rechazado. A conserva 20/20 y su historia original.',
    );
    await page.goto(`/aula/editor/${copyId}`);
    await expect(page.getByLabel('Título del recurso')).toHaveValue(copyTitle);
    await expect(page.getByRole('button', { name: `1. ${copyPrompt}`, exact: true })).toBeVisible();
    await expect(page.locator('.bn-editor[contenteditable="true"]')).toBeVisible();
    await expect(page.getByText('1 pregunta', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('copia-docente.png'), fullPage: true });
    evidence.status = 'passed';
  } catch (error) {
    evidence.status = 'failed';
    evidence.failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    const cleanup = [];
    for (const id of subjects) {
      try {
        await command(page.request, 'archiveSubject', id);
        cleanup.push({ subjectId: id, archived: true });
      } catch {
        cleanup.push({ subjectId: id, archived: false });
      }
    }
    evidence.cleanup = cleanup;
    const signouts = await Promise.all(
      [page.request, ...studentContexts.map((c) => c.request)].map(async (request) => {
        const result = await request.post(`${baseURL}/api/auth`, {
          headers,
          data: { action: 'signout' },
        });
        return result.ok();
      }),
    );
    evidence.localSessionsClosed = signouts;
    for (const context of studentContexts) await context.close();
    evidence.finishedAt = new Date().toISOString();
    const resultPath = testInfo.outputPath('reutilizacion-evidence.json');
    fs.writeFileSync(resultPath, JSON.stringify(evidence, null, 2));
    await testInfo.attach('reutilizacion-integrada', {
      path: resultPath,
      contentType: 'application/json',
    });
    expect(cleanup.every((entry) => entry.archived)).toBe(true);
    expect(signouts.every(Boolean)).toBe(true);
  }
});
