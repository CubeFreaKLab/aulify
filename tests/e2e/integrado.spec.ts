import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { dismissGuide, expectNoHorizontalOverflow } from './helpers';

const enabled = process.env.AULIFY_REMOTE_E2E === '1';
test.use({ trace: 'off', video: 'off' });
type Account = { email: string; password: string };
function accounts() {
  return JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8'))
    .users as Record<string, Account>;
}
function fixtures() {
  return JSON.parse(fs.readFileSync('.local-private/remote-test-fixtures.json', 'utf8'));
}
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3002';
const headers = { Origin: new URL(baseURL).origin, 'Sec-Fetch-Site': 'same-origin' };
async function command(request: APIRequestContext, action: string, ...args: unknown[]) {
  const response = await request.post(`${baseURL}/api/commands`, {
    headers,
    data: { action, args },
  });
  if (!response.ok()) throw new Error(`Preparación ${action}: HTTP ${response.status()}.`);
  return (await response.json()).result;
}
async function login(page: Page, account: Account) {
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(account.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page).toHaveURL(/\/aula$/);
  await expect(page.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
  await dismissGuide(page);
}

test.describe('Integración con cuentas ficticias y servicios reales', () => {
  test.skip(!enabled, 'Requiere conexión privada al proyecto de pruebas y cuentas preparadas.');
  test('responde, reintenta sin duplicar, avanza sin otra consulta y retoma el intento', async ({
    page,
    playwright,
  }) => {
    const account = accounts(),
      fixture = fixtures();
    const teacher = await playwright.request.newContext();
    let releaseSnapshot: (() => void) | undefined;
    try {
      const auth = await teacher.post(`${baseURL}/api/auth`, {
        headers,
        data: { action: 'access', ...account.teacher },
      });
      if (!auth.ok()) throw new Error(`Acceso ficticio: HTTP ${auth.status()}.`);
      const id = () => crypto.randomUUID();
      const correct = id();
      const questions = [
        {
          id: id(),
          type: 'single',
          prompt: '¿Qué aporta energía a las plantas?',
          points: 2,
          options: [
            { id: correct, text: 'Luz solar' },
            { id: id(), text: 'Plástico' },
          ],
          correctOptionId: correct,
          explanation: 'La fotosíntesis aprovecha la luz.',
        },
        {
          id: id(),
          type: 'open',
          prompt: 'Explica una observación de tu planta.',
          points: 2,
          manual: true,
          manualGuide: 'Guía privada: relación entre luz y crecimiento.',
        },
        {
          id: id(),
          type: 'true-false',
          prompt: 'Las plantas utilizan luz.',
          points: 2,
          correct: true,
        },
      ];
      const resource = {
        id: id(),
        title: 'Participación verificada',
        kind: 'quiz',
        revision: 1,
        blocks: [{ id: id(), type: 'quiz', questions }],
      };
      await command(teacher, 'saveDraft', resource, 0);
      const version = await command(teacher, 'publishResource', resource.id);
      const settings = {
        purpose: 'practice',
        pace: 'individual',
        maxGrade: 100,
        weight: 1,
        countsTowardAverage: true,
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
        allowDouble: true,
        bonusAffectsGrade: false,
        reportVisibility: false,
      };
      const activity = await command(
        teacher,
        'createActivity',
        version.id,
        fixture.subjectId,
        settings,
      );
      await login(page, account.student);
      await page.goto(`/aula/materia/${fixture.subjectId}`);
      const scopedResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/workspace?activity=${activity.id}`) && response.ok(),
      );
      await page.locator(`a[href="/aula/actividad/${activity.id}"]`).click();
      const scoped = await (await scopedResponse).json();
      expect(scoped.state.activities.map((item: { id: string }) => item.id)).toEqual([activity.id]);
      expect(scoped.state.subjects.map((item: { id: string }) => item.id)).toEqual([
        fixture.subjectId,
      ]);
      expect(scoped.state.resources).toEqual([]);
      expect(scoped.state.tasks).toEqual([]);
      expect(scoped.studentResults).toEqual({});
      await page.getByRole('button', { name: 'Empezar actividad', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: questions[0].prompt, exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(1800);
      const stalled = new Promise<void>((resolve) => {
        releaseSnapshot = resolve;
      });
      let capturedOldSnapshot!: () => void;
      const oldSnapshotReady = new Promise<void>((resolve) => {
        capturedOldSnapshot = resolve;
      });
      await page.route(
        '**/api/workspace*',
        async (route) => {
          const old = await route.fetch();
          capturedOldSnapshot();
          await stalled;
          await route.fulfill({ response: old });
        },
        { times: 1 },
      );
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await oldSnapshotReady;
      const keys: string[] = [];
      let loseFirstAcknowledgement = true;
      await page.route('**/api/commands', async (route) => {
        const body = route.request().postDataJSON();
        if (body.action !== 'submitAnswer') return route.continue();
        keys.push(body.args[3]);
        const response = await route.fetch();
        if (loseFirstAcknowledgement && response.ok()) {
          loseFirstAcknowledgement = false;
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Confirmación interrumpida. Reintenta tu respuesta.' }),
          });
        }
        return route.fulfill({ response });
      });
      await page.getByRole('radio', { name: /Luz solar/ }).check();
      await page.getByRole('button', { name: 'Puntos ×2', exact: true }).click();
      await page.getByRole('button', { name: 'Responder', exact: true }).click();
      await expect(
        page.getByRole('alert').filter({ hasText: 'Confirmación interrumpida' }),
      ).toBeVisible();
      const acknowledged = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/commands') &&
          response.request().postDataJSON()?.action === 'submitAnswer' &&
          response.ok(),
      );
      await page.getByRole('button', { name: 'Responder', exact: true }).click();
      await acknowledged;
      await expect(
        page.getByRole('heading', { name: questions[1].prompt, exact: true }),
      ).toBeVisible({ timeout: 1500 });
      expect(keys).toHaveLength(2);
      expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
      expect(keys[1]).toBe(keys[0]);
      await expect(page.getByRole('button', { name: 'Doble utilizado' })).toBeDisabled();
      releaseSnapshot?.();
      await page.waitForTimeout(500);
      await expect(
        page.getByRole('heading', { name: questions[1].prompt, exact: true }),
      ).toBeVisible();
      await expect(page.locator('.quiz-feedback')).toHaveCount(0);
      await page.reload();
      await page.getByRole('button', { name: 'Retomar mi participación' }).click();
      await expect(
        page.getByRole('heading', { name: questions[1].prompt, exact: true }),
      ).toBeVisible();
      await page
        .getByLabel('Tu respuesta', { exact: true })
        .fill('La planta cercana a la ventana creció más.');
      await page.getByRole('button', { name: 'Responder', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: questions[2].prompt, exact: true }),
      ).toBeVisible();
      await page.getByRole('radio', { name: /Verdadero/ }).check();
      await page.getByRole('button', { name: 'Responder', exact: true }).click();
      await expect(page.getByRole('heading', { name: '¡Participación completada!' })).toBeVisible();
      const own = await (await page.request.get('/api/workspace')).json();
      const attempt = own.state.attempts.find(
        (item: { activityId: string }) => item.activityId === activity.id,
      );
      expect(attempt.answers).toHaveLength(3);
      expect(attempt.status).toBe('closed');
      expect(attempt.answers[0].idempotencyKey).toBe(keys[0]);
      expect(
        attempt.answers.every((answer: { reviews: unknown[] }) => answer.reviews.length === 0),
      ).toBe(true);
      const serialized = JSON.stringify(own.studentActivities[activity.id]);
      expect(serialized).not.toContain('correctOptionId');
      expect(serialized).not.toContain('Guía privada');
      const review = await (await teacher.get(`${baseURL}/api/workspace`)).json();
      const teacherAttempt = review.state.attempts.find(
        (item: { id: string }) => item.id === attempt.id,
      );
      expect(teacherAttempt.answers[0].reviews).toHaveLength(1);
      expect(teacherAttempt.answers[1].reviews).toHaveLength(0);
      await expectNoHorizontalOverflow(page);
      const wholeWorkspace = page.waitForResponse(
        (response) => response.url().endsWith('/api/workspace') && response.ok(),
      );
      await page.getByRole('link', { name: 'Ver mis resultados' }).click();
      await wholeWorkspace;
      await expect(page).toHaveURL(/\/aula\/resultados$/);
      await expect(page.getByLabel('Materia', { exact: true })).toBeVisible();
    } finally {
      releaseSnapshot?.();
      await teacher.dispose();
    }
  });
  test('una caída de sincronización reduce reintentos y se recupera sin recargar', async ({
    page,
  }) => {
    await login(page, accounts().teacher);
    const fixture = fixtures();
    const synced = page.waitForResponse(
      (response) => response.url().includes('/api/sync?') && response.status() === 200,
    );
    await page.goto(`/aula/actividad/${fixture.activityId}`);
    await synced;
    // Separa la carga inicial del intervalo de indisponibilidad observado.
    await page.waitForTimeout(1800);
    let syncRequests = 0,
      snapshots = 0;
    const message = 'El servicio de prueba está ocupado. Se reintentará.';
    await page.route('**/api/sync?*', async (route) => {
      syncRequests++;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: message }),
      });
    });
    const countSnapshot = (request: { url(): string }) => {
      if (new URL(request.url()).pathname === '/api/workspace') snapshots++;
    };
    page.on('request', countSnapshot);
    await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
    await page.waitForTimeout(10000);
    expect(syncRequests).toBeGreaterThanOrEqual(3);
    expect(syncRequests).toBeLessThanOrEqual(5);
    expect(snapshots).toBe(0);
    await page.unroute('**/api/sync?*');
    await expect(page.getByRole('alert').filter({ hasText: message })).toHaveCount(0, {
      timeout: 20000,
    });
    expect(snapshots).toBeGreaterThan(0);
    // El servidor puede pedir una pausa mayor que el retroceso exponencial local.
    let limitedRequests = 0;
    await page.route('**/api/sync?*', async (route) => {
      limitedRequests++;
      await route.fulfill({
        status: 503,
        headers: { 'Retry-After': '5' },
        contentType: 'application/json',
        body: JSON.stringify({ error: message }),
      });
    });
    await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
    await page.waitForTimeout(3000);
    expect(limitedRequests).toBe(1);
    await expect.poll(() => limitedRequests, { timeout: 6000 }).toBeGreaterThanOrEqual(2);
    await page.unroute('**/api/sync?*');
    await expect(page.getByRole('alert').filter({ hasText: message })).toHaveCount(0, {
      timeout: 10000,
    });
    page.off('request', countSnapshot);
  });
  test('rechaza cookies con identidad alterada y conserva la sesión original', async ({
    page,
    playwright,
  }) => {
    const account = accounts();
    await login(page, account.teacher);
    const state = await page.request.storageState();
    const authCookies = state.cookies
      .filter((cookie) => /sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(authCookies.length).toBeGreaterThan(0);
    const encoded = authCookies.map((cookie) => cookie.value).join('');
    expect(encoded.startsWith('base64-')).toBe(true);
    const session = JSON.parse(Buffer.from(encoded.slice(7), 'base64url').toString('utf8'));
    const parts = session.access_token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    claims.sub = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    parts[1] = Buffer.from(JSON.stringify(claims)).toString('base64url');
    session.access_token = parts.join('.');
    const changed = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
    let offset = 0;
    for (let index = 0; index < authCookies.length; index++) {
      const cookie = authCookies[index];
      const size = cookie.value.length;
      cookie.value =
        index === authCookies.length - 1
          ? changed.slice(offset)
          : changed.slice(offset, offset + size);
      offset += size;
    }
    const forged = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3002',
      storageState: state,
    });
    try {
      const response = await forged.get('/api/workspace');
      expect(response.status()).toBe(401);
      expect(await response.json()).not.toHaveProperty('state');
      expect((await page.request.get('/api/workspace')).status()).toBe(200);
    } finally {
      await forged.dispose();
    }
  });
  test('el docente recorre su aula y cerrar sesión protege el cambio de cuenta', async ({
    page,
    playwright,
  }) => {
    const account = accounts(),
      fixture = fixtures();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page, account.teacher);
    for (const route of [
      'materias',
      `materia/${fixture.subjectId}`,
      'biblioteca',
      'revision',
      'resultados',
      'preferencias',
    ]) {
      await page.goto(`/aula/${route}`);
      await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expect(page.getByRole('heading', { name: /no pudimos abrir/i })).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page).toHaveURL(/\/acceso$/);
    await login(page, account.studentOther);
    // Ambos estudiantes de la preparación pertenecen a la materia; el docente ajeno no.
    const outsider = await playwright.request.newContext();
    try {
      const auth = await outsider.post(`${baseURL}/api/auth`, {
        headers,
        data: { action: 'access', ...account.teacherOther },
      });
      if (!auth.ok()) throw new Error(`Acceso ficticio: HTTP ${auth.status()}.`);
      expect(
        (await outsider.get(`${baseURL}/api/workspace?activity=${fixture.activityId}`)).status(),
      ).toBe(403);
    } finally {
      await outsider.dispose();
    }
    expect((await page.request.get('/api/workspace?activity=invalid')).status()).toBe(400);
    const response = await page.request.get('/api/workspace');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.state.resources).toEqual([]);
    expect(data.state.users.find((user: { id: string }) => user.id === data.userId).role).toBe(
      'student',
    );
    await page.goto(`/aula/editor/${fixture.resourceId}`);
    await expect(
      page.getByRole('heading', { name: 'Este espacio no está disponible' }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('publica una lectura desde el editor y el estudiante consulta su versión', async ({
    page,
    browser,
  }) => {
    const account = accounts(),
      fixture = fixtures();
    const title = `Lectura verificada ${Date.now()}`;
    await login(page, account.teacher);
    await page.goto('/aula/biblioteca');
    await page.getByRole('button', { name: 'Crear recurso', exact: true }).click();
    await expect(page).toHaveURL(/\/aula\/editor\//);
    await page.getByLabel('Título del recurso', { exact: true }).fill(title);
    await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Materia', { exact: true }).selectOption(fixture.subjectId);
    await expect(dialog.getByText('Se compartirá como lectura.', { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: 'Publicar en la materia', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/aula/materia/${fixture.subjectId}$`));
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const context = await browser.newContext();
    const student = await context.newPage();
    await login(student, account.student);
    await student.goto(`/aula/materia/${fixture.subjectId}`);
    await student
      .locator('.list-item')
      .filter({ has: student.getByRole('heading', { name: title, exact: true }) })
      .getByRole('button', { name: 'Leer recurso' })
      .click();
    await expect(
      student.getByRole('dialog').getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      student.getByRole('dialog').getByText('Escribe una explicación para tu clase.'),
    ).toBeVisible();
    await expectNoHorizontalOverflow(student);
    await context.close();
  });

  test('entrega un archivo real y solo su autor y docente pueden descargarlo', async ({
    page,
    browser,
  }) => {
    const account = accounts(),
      fixture = fixtures();
    const title = `Observación de una planta ${Date.now()}`;
    await login(page, account.teacher);
    await page.goto('/aula/tareas');
    await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
    await page.getByLabel('Materia', { exact: true }).first().selectOption(fixture.subjectId);
    await page.getByLabel('Título', { exact: true }).fill(title);
    await page
      .getByLabel('Consigna', { exact: true })
      .fill('Adjunta una imagen de tu observación y escribe una explicación breve.');
    await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const context = await browser.newContext();
    const student = await context.newPage();
    await login(student, account.student);
    await student.goto('/aula/tareas');
    const article = student
      .locator('article')
      .filter({ has: student.getByRole('heading', { name: title, exact: true }) });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=',
      'base64',
    );
    await article
      .getByLabel('Adjunta tu trabajo', { exact: true })
      .setInputFiles({ name: 'observacion.png', mimeType: 'image/png', buffer: png });
    await article.getByRole('button', { name: 'Entregar trabajo', exact: true }).click();
    await expect(article.getByText('Entrega pendiente de revisión', { exact: true })).toBeVisible();
    const link = article.getByRole('link', { name: 'observacion.png', exact: true });
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/api\/files\//);
    const own = await student.request.get(href!, { maxRedirects: 0 });
    expect(own.status()).toBe(307);
    const bytes = await student.request.get(own.headers().location);
    expect(await bytes.body()).toEqual(png);
    const allowed = await page.request.get(href!, { maxRedirects: 0 });
    expect(allowed.status()).toBe(307);
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await login(page, account.teacherOther);
    const denied = await page.request.get(href!, { maxRedirects: 0 });
    expect(denied.status()).toBe(404);
    await context.close();
  });
});
