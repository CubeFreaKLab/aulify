import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { Activity, Attempt, DemoState, StudentActivity } from '../../src/domain/types';
import { dismissGuide, expectNoHorizontalOverflow } from './helpers';

test.use({ trace: 'off', video: 'off', screenshot: 'off', reducedMotion: 'reduce' });
test.setTimeout(210_000);
const enabled = process.env.AULIFY_REMOTE_E2E === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001';
const headers = { Origin: new URL(baseURL).origin, 'Sec-Fetch-Site': 'same-origin' };
type Account = { id: string; email: string; password: string; role?: string };
type Snapshot = { state: DemoState; studentActivities: Record<string, StudentActivity> };

async function login(request: APIRequestContext, account: Account) {
  const response = await request.post(`${baseURL}/api/auth`, {
    headers,
    data: { action: 'access', email: account.email, password: account.password },
  });
  expect(response.status(), 'Acceso de la cuenta ficticia').toBe(200);
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
async function rejects(
  request: APIRequestContext,
  action: string,
  message: RegExp,
  ...args: unknown[]
) {
  const response = await request.post(`${baseURL}/api/commands`, {
    headers,
    data: { action, args },
  });
  expect(response.status(), action).toBe(400);
  expect((await response.json()).error).toMatch(message);
}
async function snapshot(request: APIRequestContext, activity?: string): Promise<Snapshot> {
  const response = await request.get(
    `${baseURL}/api/workspace${activity ? `?activity=${activity}` : ''}`,
  );
  expect(response.status()).toBe(200);
  return response.json();
}
async function openActivity(page: Page, id: string) {
  await page.goto(`/aula/actividad/${id}`);
  await dismissGuide(page);
}

test('sala guiada conserva intentos y plazos al desconectar al docente y cierra con revisión pendiente', async ({
  page,
  browser,
  playwright,
}, testInfo) => {
  test.skip(!enabled, 'Necesita cuentas ficticias locales y el proyecto remoto de pruebas.');
  expect(new URL(baseURL).hostname).toBe('127.0.0.1');
  const accounts = JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8'));
  const load = JSON.parse(fs.readFileSync('.local-private/load-accounts.json', 'utf8'));
  expect(accounts.projectRef).toBe('bnqyyumfmyexsqszglab');
  expect(load.projectRef).toBe(accounts.projectRef);
  const late = (load.users as Account[]).find((a) => a.role === 'student');
  expect(late).toBeTruthy();
  const students: Account[] = [accounts.users.student, accounts.users.studentOther];
  expect(new Set([...students.map((a) => a.id), late!.id]).size).toBe(3);
  const contexts: BrowserContext[] = [];
  const lateRequest = await playwright.request.newContext();
  const checks: string[] = [];
  const evidence: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    project: testInfo.project.name,
    baseURL,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    buildId: fs.readFileSync('.next/BUILD_ID', 'utf8').trim(),
    sourceSha256: createHash('sha256').update(fs.readFileSync(testInfo.file)).digest('hex'),
    storeSourceSha256: createHash('sha256')
      .update(fs.readFileSync('src/demo/store.ts'))
      .digest('hex'),
    checks,
    status: 'running',
    scope:
      'Chromium local compilado y Supabase real; cuentas ficticias existentes; red docente interrumpida mediante BrowserContext.setOffline.',
  };
  let subjectId: string | undefined;
  let activityId: string | undefined;
  try {
    await login(page.request, accounts.users.teacher);
    const studentPages: Page[] = [];
    for (const student of students) {
      const context = await browser.newContext({
        baseURL,
        locale: 'es-BO',
        timezoneId: 'America/La_Paz',
        viewport: testInfo.project.use.viewport,
        reducedMotion: 'reduce',
      });
      contexts.push(context);
      await login(context.request, student);
      studentPages.push(await context.newPage());
    }
    await login(lateRequest, late!);
    const subject = await command<{ id: string }>(page.request, 'createSubject', {
      name: `Clase guiada · ${testInfo.project.name} · ${randomUUID().slice(0, 6)}`,
      course: 'Prueba ficticia',
      year: 2026,
      description: 'Continuidad guiada y omisión, sin datos de personas reales.',
    });
    subjectId = subject.id;
    evidence.subjectId = subjectId;
    const code = (await snapshot(page.request)).state.subjects.find(
      (s) => s.id === subjectId,
    )!.code;
    for (const request of [...contexts.map((c) => c.request), lateRequest]) {
      const membership = await command<{ id: string }>(request, 'requestMembership', code);
      await command(page.request, 'decideMembership', membership.id, 'approved');
    }
    const q1 = {
      id: randomUUID(),
      type: 'true-false',
      prompt: 'Las plantas necesitan agua.',
      points: 2,
      correct: true,
    };
    const q2 = {
      id: randomUUID(),
      type: 'open',
      prompt: 'Explica una observación de tu planta.',
      points: 3,
      manual: true,
      manualGuide: 'Valorar observación y explicación.',
    };
    const draft = {
      id: randomUUID(),
      title: 'Observamos nuestras plantas',
      kind: 'quiz',
      revision: 1,
      blocks: [{ id: randomUUID(), type: 'quiz', questions: [q1, q2] }],
    };
    await command(page.request, 'saveDraft', draft, 0);
    const version = await command<{ id: string }>(page.request, 'publishResource', draft.id);
    const activity = await command<Activity>(
      page.request,
      'createActivity',
      version.id,
      subjectId,
      {
        purpose: 'practice',
        pace: 'guided',
        maxGrade: 20,
        weight: 1,
        countsTowardAverage: false,
        maxAttempts: 1,
        opensAt: new Date(Date.now() - 60000).toISOString(),
        closesAt: new Date(Date.now() + 3600000).toISOString(),
        timeLimitMinutes: null,
        timeZone: 'America/La_Paz',
        feedback: 'hidden',
        manualCorrection: false,
        shuffleQuestions: false,
        shuffleOptions: false,
        streaks: false,
        sound: false,
        ranking: false,
        teams: false,
        allowHint: false,
        allowDouble: false,
        bonusAffectsGrade: false,
        reportVisibility: false,
      },
    );
    activityId = activity.id;
    evidence.activityId = activityId;
    evidence.questionIds = [q1.id, q2.id];
    for (const studentPage of studentPages) {
      await openActivity(studentPage, activity.id);
      await studentPage.getByRole('button', { name: 'Unirme a la sala', exact: true }).click();
      await expect(
        studentPage.getByRole('button', { name: 'Ya estás en la sala', exact: true }),
      ).toBeVisible();
      const waiting = await snapshot(studentPage.request, activity.id);
      expect(waiting.state.attempts).toHaveLength(0);
      expect(waiting.studentActivities[activity.id].attemptsRemaining).toBe(1);
    }
    checks.push('E1 y E2 entran por interfaz: sala sin intentos consumidos.');
    await openActivity(page, activity.id);
    await page.getByRole('button', { name: 'Comenzar sesión', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cerrar pregunta', exact: true })).toBeVisible();
    await command(page.request, 'startGuidedSession', activity.id);
    const started = await snapshot(page.request, activity.id);
    expect(started.state.attempts.map((a) => [a.studentId, a.number]).sort()).toEqual(
      students.map((a) => [a.id, 1]).sort(),
    );
    const attempts = students.map((s) => started.state.attempts.find((a) => a.studentId === s.id)!);
    evidence.attemptIds = attempts.map((a) => a.id);
    evidence.deadlines = attempts.map((a) => a.deadline);
    checks.push('Inicio visual y repetición HTTP crean exactamente un intento por inscrito.');
    for (const studentPage of studentPages) {
      await studentPage.getByRole('button', { name: 'Entrar a la actividad', exact: true }).click();
      await expect(
        studentPage.getByRole('heading', { name: q1.prompt, exact: true }),
      ).toBeVisible();
    }
    const disconnectedAt = Date.now();
    await page.context().setOffline(true);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(
      await page.evaluate(async () => {
        try {
          await fetch('/api/workspace');
          return 'connected';
        } catch {
          return 'offline';
        }
      }),
    ).toBe('offline');
    const [e1, e2] = studentPages;
    await e1.getByRole('radio', { name: /Verdadero/ }).check();
    await e1.getByRole('button', { name: 'Responder', exact: true }).click();
    await expect(
      e1.getByRole('heading', { name: 'Tu clase sigue pensando.', exact: true }),
    ).toBeVisible();
    await rejects(
      e1.request,
      'submitAnswer',
      /pregunta ya cerró/i,
      attempts[0].id,
      q2.id,
      { type: 'open', text: 'Aún no debe enviarse.' },
      randomUUID(),
      false,
    );
    await rejects(lateRequest, 'joinGuidedRoom', /sala ya está cerrada/i, activity.id);
    await rejects(lateRequest, 'startAttempt', /Espera a que el docente/i, activity.id);
    const offlineSamples = [];
    for (let index = 0; index < 3; index++) {
      if (index) await new Promise((resolve) => setTimeout(resolve, 6000));
      const during = await snapshot(e1.request, activity.id);
      const current = during.state.activities.find((a) => a.id === activity.id)!;
      expect(current.guided).toMatchObject({
        status: 'running',
        questionIndex: 0,
        questionOpen: true,
      });
      expect(during.state.attempts[0].deadline).toBe(attempts[0].deadline);
      await expect(
        e1.getByRole('heading', { name: 'Tu clase sigue pensando.', exact: true }),
      ).toBeVisible();
      await expect(e2.getByRole('heading', { name: q1.prompt, exact: true })).toBeVisible();
      offlineSamples.push({
        at: new Date().toISOString(),
        questionIndex: 0,
        deadline: during.state.attempts[0].deadline,
      });
    }
    evidence.offline = {
      from: new Date(disconnectedAt).toISOString(),
      durationMs: Date.now() - disconnectedAt,
      samples: offlineSamples,
      fetchRejected: true,
      lateJoinRejected: true,
    };
    checks.push(
      'Docente sin red: E1 confirma, espera; E2 conserva pregunta; tres observaciones sin avance ni cambio de plazo.',
    );
    checks.push('Tercer estudiante aprobado no entra tarde ni obtiene intento.');
    await e1.screenshot({ path: testInfo.outputPath('estudiante-espera.png'), fullPage: true });
    await page.context().setOffline(false);
    await page.reload();
    await expect(page.getByRole('heading', { name: q1.prompt, exact: true })).toBeVisible();
    const resumed = await snapshot(page.request, activity.id);
    expect(resumed.state.attempts.map((a) => [a.id, a.deadline]).sort()).toEqual(
      attempts.map((a) => [a.id, a.deadline]).sort(),
    );
    expect(resumed.state.activities[0].guided).toEqual(started.state.activities[0].guided);
    checks.push(
      'Reconexión y recarga docente conservan pregunta, intentos y plazos de ambos estudiantes.',
    );
    const pendingClose = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/commands') &&
        response.request().postDataJSON()?.action === 'closeGuidedQuestion',
    );
    await page.getByRole('button', { name: 'Cerrar pregunta', exact: true }).click();
    const pendingResponse = await pendingClose;
    expect(pendingResponse.status()).toBe(400);
    const pendingMessage = 'Quedan respuestas pendientes. Confirma su cierre para continuar.';
    expect((await pendingResponse.json()).error).toBe(pendingMessage);
    const pendingNotice = page.getByRole('alert').filter({ hasText: pendingMessage });
    await expect(pendingNotice).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Cerrar con pendientes', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Abrir siguiente pregunta', exact: true }),
    ).toBeVisible();
    await expect(pendingNotice).toHaveCount(0);
    await rejects(
      e2.request,
      'submitAnswer',
      /pregunta ya cerró/i,
      attempts[1].id,
      q1.id,
      { type: 'true-false', value: true },
      randomUUID(),
      false,
    );
    checks.push(
      'Cierre exige confirmación por E2; una vez confirmado no admite su respuesta atrasada.',
    );
    await page.getByRole('button', { name: 'Abrir siguiente pregunta', exact: true }).click();
    for (const studentPage of studentPages) {
      await expect(
        studentPage.getByRole('heading', { name: q2.prompt, exact: true }),
      ).toBeVisible();
      await studentPage
        .getByLabel('Tu respuesta', { exact: true })
        .fill('Mi planta creció al recibir agua y luz.');
      await studentPage.getByRole('button', { name: 'Responder', exact: true }).click();
      await expect(
        studentPage.getByRole('heading', { name: 'Tu clase sigue pensando.', exact: true }),
      ).toBeVisible();
    }
    await page.getByRole('button', { name: 'Cerrar pregunta', exact: true }).click();
    await expect(page.getByText('Finalizada', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'La sesión terminó.', exact: true }),
    ).toBeVisible();
    for (const [index, studentPage] of studentPages.entries()) {
      await expect(
        studentPage.getByRole('heading', { name: '¡Participación completada!', exact: true }),
      ).toBeVisible();
      const result = await command<Attempt>(page.request, 'readAttempt', attempts[index].id);
      expect(result).toMatchObject({ status: 'closed', closeReason: 'guided-complete' });
      expect(result.answers.find((a) => a.questionId === q2.id)?.reviews).toEqual([]);
      await rejects(
        page.request,
        'publishGrade',
        /pendientes de corrección/i,
        activity.id,
        students[index].id,
      );
      await expectNoHorizontalOverflow(studentPage);
    }
    checks.push(
      'Última pregunta cierra ambos intentos normalmente y conserva escritura sin corregir; publicación incompleta rechazada.',
    );
    const ranking = await command<{ individual: { studentId: string; points: number }[] }>(
      page.request,
      'ranking',
      activity.id,
    );
    expect(
      students.map((s) => ranking.individual.find((r) => r.studentId === s.id)!.points),
    ).toEqual([2, 0]);
    evidence.pendingScores = [2, 0];
    checks.push('Antes de corregir: E1 conserva dos puntos; omisión de E2 vale cero.');
    await page.screenshot({ path: testInfo.outputPath('docente-finalizada.png'), fullPage: true });
    for (let index = 0; index < 2; index++) {
      await command(
        page.request,
        'reviewAnswer',
        attempts[index].id,
        q2.id,
        3,
        'Respuesta ficticia pertinente.',
      );
      const result = await command<{ grade: number }>(
        page.request,
        'publishGrade',
        activity.id,
        students[index].id,
      );
      expect(result.grade).toBe(index === 0 ? 20 : 12);
    }
    evidence.publishedGrades = [20, 12];
    checks.push(
      'Corrección y publicación posterior: 20/20 para E1, 12/20 para E2, conservando la omisión.',
    );
    await expectNoHorizontalOverflow(page);
    evidence.status = 'passed';
  } catch (error) {
    evidence.status = 'failed';
    evidence.failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await page.context().setOffline(false);
    if (subjectId) {
      await command(page.request, 'archiveSubject', subjectId);
      evidence.archivedFixture = true;
    }
    for (const request of [page.request, ...contexts.map((c) => c.request), lateRequest]) {
      const response = await request.post(`${baseURL}/api/auth`, {
        headers,
        data: { action: 'signout' },
      });
      expect(response.ok()).toBe(true);
    }
    for (const context of contexts) await context.close();
    await lateRequest.dispose();
    evidence.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      testInfo.outputPath('guiada-evidence.json'),
      JSON.stringify(evidence, null, 2),
    );
    await testInfo.attach('guiada-continuidad', {
      path: testInfo.outputPath('guiada-evidence.json'),
      contentType: 'application/json',
    });
  }
});
