import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { dismissGuide, expectNoHorizontalOverflow } from './helpers';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test.setTimeout(180_000);
const enabled = process.env.AULIFY_REMOTE_E2E === '1';
type Account = { id: string; email: string; password: string; name: string };
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3002';
const headers = { Origin: new URL(baseURL).origin, 'Sec-Fetch-Site': 'same-origin' };
const credentials = () =>
  JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8')).users as Record<
    string,
    Account
  >;

async function login(request: APIRequestContext, account: Account) {
  const response = await request.post(`${baseURL}/api/auth`, {
    headers,
    data: { action: 'access', email: account.email, password: account.password },
  });
  if (!response.ok())
    throw new Error(`No se pudo preparar la sesión ficticia (${response.status()}).`);
}
async function command(request: APIRequestContext, action: string, ...args: unknown[]) {
  const response = await request.post(`${baseURL}/api/commands`, {
    headers,
    data: { action, args },
  });
  if (!response.ok()) throw new Error(`Preparación ${action}: HTTP ${response.status()}.`);
  return (await response.json()).result;
}
async function snapshot(request: APIRequestContext) {
  const response = await request.get(`${baseURL}/api/workspace`);
  expect(response.status()).toBe(200);
  return response.json();
}
async function setup(page: Page, student: APIRequestContext, title: string) {
  const accounts = credentials();
  await login(page.request, accounts.teacher);
  await login(student, accounts.student);
  const subject = await command(page.request, 'createSubject', {
    name: title,
    course: '3.º A',
    year: 2026,
    description: 'Datos ficticios para verificar recorridos de gestión.',
  });
  const owner = await snapshot(page.request);
  const code = owner.state.subjects.find((s: { id: string }) => s.id === subject.id).code;
  const request = await command(student, 'requestMembership', code);
  await command(page.request, 'decideMembership', request.id, 'approved');
  return { accounts, subject };
}
async function audit(page: Page) {
  await expectNoHorizontalOverflow(page);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}
const details = (page: Page, name: string) =>
  page.locator('details').filter({ has: page.locator('summary').getByText(name, { exact: true }) });
async function openDetails(page: Page, name: string) {
  const section = details(page, name);
  if (!(await section.getAttribute('open'))) {
    const expanded = await section.evaluate((node) => (node as HTMLDetailsElement).open);
    if (!expanded) await section.locator(':scope > summary').click();
  }
  return section;
}

test.describe('Gestión integrada con datos ficticios', () => {
  test.skip(!enabled, 'Requiere el proyecto de pruebas y credenciales locales excluidas.');

  test('materia, nota manual, cero explícito y conservación', async ({
    page,
    playwright,
  }, testInfo) => {
    const student = await playwright.request.newContext();
    const title = `Gestión de clase · ${testInfo.project.name} · ${crypto.randomUUID().slice(0, 4)}`;
    try {
      const { accounts, subject } = await setup(page, student, title);
      await page.goto(`/aula/materia/${subject.id}`);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await dismissGuide(page);
      await page.getByRole('tab', { name: 'Configuración', exact: true }).click();
      await page.getByLabel('Curso o paralelo').fill('3.º B');
      await page
        .getByLabel('Descripción', { exact: true })
        .fill('Materia preparada para la verificación de gestión.');
      await page.getByRole('button', { name: 'Guardar detalles' }).click();
      await expect
        .poll(
          async () =>
            (await snapshot(page.request)).state.subjects.find(
              (s: { id: string }) => s.id === subject.id,
            ).course,
        )
        .toBe('3.º B');
      const oldCode = (await snapshot(page.request)).state.subjects.find(
        (s: { id: string }) => s.id === subject.id,
      ).code;
      const invitations = await openDetails(page, 'Invitar y gestionar integrantes');
      await invitations.getByRole('button', { name: 'Renovar código' }).click();
      const codeDialog = page.getByRole('dialog', { name: 'Renovar el código' });
      await codeDialog.getByLabel('Entiendo lo que cambiará.').check();
      await codeDialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
      await expect(codeDialog).toHaveCount(0);
      await expect
        .poll(
          async () =>
            (await snapshot(page.request)).state.subjects.find(
              (s: { id: string }) => s.id === subject.id,
            ).code,
        )
        .not.toBe(oldCode);
      await audit(page);
      await page.screenshot({
        path: testInfo.outputPath('materia-configuracion.png'),
        fullPage: true,
      });

      await page.getByRole('tab', { name: 'Recursos', exact: true }).click();
      await page.getByRole('button', { name: 'Crear actividad manual' }).click();
      const manualDialog = page.getByRole('dialog', { name: 'Nueva actividad manual' });
      await manualDialog.getByLabel('Título', { exact: true }).fill('Exposición sobre ecosistemas');
      await manualDialog.getByLabel('Nota máxima').fill('20');
      await manualDialog.getByRole('button', { name: 'Crear actividad', exact: true }).click();
      await expect(manualDialog).toHaveCount(0);
      await page.locator('summary').filter({ hasText: accounts.student.name }).click();
      await page.getByLabel('Nota sobre 20', { exact: true }).fill('17');
      await page
        .getByLabel('Comentario para el estudiante', { exact: true })
        .fill('Explicación clara de los conceptos.');
      await page.getByRole('button', { name: 'Guardar nota', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Publicar corrección guardada' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Publicar corrección guardada' }).click();
      await expect(page.locator('summary').filter({ hasText: '17 / 20 publicada' })).toBeVisible();
      await audit(page);
      const expired = await command(page.request, 'createTask', {
        subjectId: subject.id,
        title: 'Práctica sin entrega',
        instructions: 'Tarea ficticia para comprobar la decisión explícita.',
        opensAt: new Date(Date.now() - 3_600_000).toISOString(),
        closesAt: new Date(Date.now() - 60_000).toISOString(),
        maxGrade: 20,
        weight: 1,
        countsTowardAverage: true,
        allowLate: false,
      });
      await page.goto('/aula/tareas');
      await page.getByLabel('Materia', { exact: true }).selectOption(subject.id);
      const zero = await openDetails(page, 'Revisar a quienes no participaron');
      await zero.getByLabel('Estudiante sin participación').selectOption(accounts.student.id);
      await zero
        .getByLabel('Motivo de la nota de cero')
        .fill('No participó en la actividad de prueba y se registró la decisión.');
      await zero
        .getByLabel('Confirmo que corresponde publicar una nota de cero para este estudiante.')
        .check();
      await zero.getByRole('button', { name: 'Publicar cero con motivo' }).click();
      await expect
        .poll(
          async () =>
            (await snapshot(student)).state.evaluations.find(
              (e: { activityId: string }) => e.activityId === expired.id,
            )?.grade,
        )
        .toBe(0);

      await page.goto(`/aula/materia/${subject.id}`);
      await page.getByRole('tab', { name: 'Configuración' }).click();
      const archive = await openDetails(page, 'Archivo y conservación');
      await archive.getByRole('button', { name: 'Archivar materia' }).click();
      const archiveDialog = page.getByRole('dialog', { name: 'Archivar esta materia' });
      await archiveDialog.getByLabel('Entiendo lo que cambiará.').check();
      await archiveDialog.getByRole('button', { name: 'Confirmar' }).click();
      await expect(archiveDialog).toHaveCount(0);
      await expect
        .poll(async () =>
          (await snapshot(student)).state.subjects.some((s: { id: string }) => s.id === subject.id),
        )
        .toBe(false);
      const restore = await openDetails(page, 'Restaurar materia');
      await restore.getByRole('button', { name: 'Restaurar materia' }).click();
      await expect
        .poll(async () =>
          (await snapshot(student)).state.subjects.some((s: { id: string }) => s.id === subject.id),
        )
        .toBe(true);
      await openDetails(page, 'Invitar y gestionar integrantes');
      await page.getByRole('button', { name: 'Retirar inscripción' }).click();
      const withdraw = page.getByRole('dialog', { name: 'Retirar inscripción' });
      await withdraw.getByLabel('Motivo del retiro').fill('Prueba de retiro de inscripción.');
      await withdraw.getByLabel('Entiendo lo que cambiará.').check();
      await withdraw.getByRole('button', { name: 'Confirmar' }).click();
      await expect(withdraw).toHaveCount(0);
      await expect
        .poll(async () =>
          (await snapshot(student)).state.subjects.some((s: { id: string }) => s.id === subject.id),
        )
        .toBe(false);
    } finally {
      await student.dispose();
    }
  });

  test('equipos, ampliación, señal, cierre anticipado y resolución', async ({
    page,
    playwright,
  }, testInfo) => {
    const student = await playwright.request.newContext();
    const other = await playwright.request.newContext();
    try {
      const { accounts, subject } = await setup(
        page,
        student,
        `Sesión de repaso · ${testInfo.project.name} · ${crypto.randomUUID().slice(0, 4)}`,
      );
      await login(other, accounts.studentOther);
      const code = (await snapshot(page.request)).state.subjects.find(
        (s: { id: string }) => s.id === subject.id,
      ).code;
      const request = await command(other, 'requestMembership', code);
      await command(page.request, 'decideMembership', request.id, 'approved');
      const fixture = JSON.parse(
        fs.readFileSync('.local-private/remote-test-fixtures.json', 'utf8'),
      );
      const settings = {
        purpose: 'practice',
        pace: 'guided',
        maxGrade: 20,
        weight: 1,
        countsTowardAverage: true,
        maxAttempts: 1,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
        timeLimitMinutes: null,
        timeZone: 'America/La_Paz',
        feedback: 'immediate',
        manualCorrection: false,
        shuffleQuestions: false,
        shuffleOptions: false,
        streaks: false,
        sound: false,
        ranking: true,
        teams: true,
        allowHint: false,
        allowDouble: false,
        bonusAffectsGrade: false,
        reportVisibility: true,
      };
      const activity = await command(
        page.request,
        'createActivity',
        fixture.versionId,
        subject.id,
        settings,
        'Repaso guiado de fotosíntesis',
      );
      await page.goto(`/aula/actividad/${activity.id}`);
      await expect(page.getByRole('heading', { name: activity.title, exact: true })).toBeVisible();
      const teams = await openDetails(page, 'Equipos de esta actividad');
      await teams.getByRole('button', { name: 'Repartir automáticamente' }).click();
      await expect(teams.getByRole('button', { name: 'Ajustar equipos' })).toBeVisible();
      await teams.getByRole('button', { name: 'Ajustar equipos' }).click();
      const teamDialog = page.getByRole('dialog', { name: 'Ajustar equipos' });
      await teamDialog.getByLabel('Nombre del equipo 1').fill('Equipo Luz');
      await teamDialog.getByRole('button', { name: 'Guardar equipos' }).click();
      await expect(teamDialog).toHaveCount(0);
      await expect(teams.getByText('Equipo Luz', { exact: true })).toBeVisible();
      const extension = await openDetails(page, 'Ampliar un plazo');
      await extension
        .getByLabel('Motivo de la ampliación')
        .fill('Se amplía el plazo para completar el repaso.');
      await extension.getByRole('button', { name: 'Ampliar plazo' }).click();
      await expect
        .poll(async () =>
          new Date(
            (await snapshot(page.request)).state.activities.find(
              (a: { id: string }) => a.id === activity.id,
            ).settings.closesAt,
          ).getTime(),
        )
        .toBeGreaterThan(new Date(settings.closesAt).getTime());
      await command(student, 'joinGuidedRoom', activity.id);
      await page.getByRole('button', { name: 'Comenzar sesión', exact: true }).click();
      await expect(page.getByText('En marcha', { exact: true })).toBeVisible();
      const attempt = await command(student, 'startAttempt', activity.id);
      await command(
        student,
        'reportVisibility',
        attempt.id,
        crypto.randomUUID(),
        new Date().toISOString(),
        new Date().toISOString(),
      );
      await page.reload();
      const incidents = await openDetails(page, 'Señales para revisar (1)');
      await incidents.locator('summary').filter({ hasText: accounts.student.name }).click();
      await incidents.getByLabel('Resultado de la revisión').selectOption('reviewed_no_action');
      await incidents
        .getByLabel('Comentario de revisión')
        .fill('Se revisó la señal; no corresponde una observación.');
      await incidents.getByRole('button', { name: 'Guardar revisión' }).click();
      await expect(incidents.locator('summary').filter({ hasText: 'Revisada' })).toBeVisible();
      const finish = await openDetails(page, 'Finalizar la sesión antes de tiempo');
      await finish
        .getByLabel('Motivo del cierre anticipado')
        .fill('Cierre controlado para revisar la conservación de respuestas.');
      await finish.getByRole('checkbox').check();
      await finish.getByRole('button', { name: 'Finalizar sesión', exact: true }).click();
      await expect(page.getByText('Finalizada', { exact: true })).toBeVisible();
      await page.getByLabel('Decisión', { exact: true }).selectOption('exclude');
      await page
        .getByLabel('Motivo', { exact: true })
        .fill('Se excluye este intento de prueba sin modificar oportunidades.');
      await page.getByRole('button', { name: 'Guardar decisión' }).click();
      await expect
        .poll(
          async () =>
            (await snapshot(page.request)).state.attempts.find(
              (a: { id: string }) => a.id === attempt.id,
            ).resolution,
        )
        .toBe('exclude');
      const ranking = await openDetails(page, 'Clasificación');
      await ranking.getByRole('button', { name: 'Ver clasificación' }).click();
      await expect(
        ranking.getByRole('region', { name: 'Clasificación por equipos' }),
      ).toBeVisible();
      await audit(page);
      await page.screenshot({ path: testInfo.outputPath('gestion-sesion.png'), fullPage: true });
    } finally {
      await student.dispose();
      await other.dispose();
    }
  });

  test('reentrega autorizada aparece en la cuenta correcta y conserva versiones', async ({
    page,
    browser,
  }, testInfo) => {
    const studentContext = await browser.newContext({
      baseURL,
      locale: 'es-BO',
      timezoneId: 'America/La_Paz',
      viewport: testInfo.project.use.viewport,
    });
    const studentPage = await studentContext.newPage();
    try {
      const { accounts, subject } = await setup(
        page,
        studentContext.request,
        `Entregas de clase · ${testInfo.project.name} · ${crypto.randomUUID().slice(0, 4)}`,
      );
      const task = await command(page.request, 'createTask', {
        subjectId: subject.id,
        title: 'Mapa conceptual',
        instructions: 'Adjunta tu mapa como imagen.',
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 86_400_000).toISOString(),
        maxGrade: 20,
        weight: 1,
        countsTowardAverage: true,
        allowLate: false,
      });
      await studentPage.goto('/aula/tareas');
      await dismissGuide(studentPage);
      await studentPage.getByLabel('Materia', { exact: true }).selectOption(subject.id);
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=',
        'base64',
      );
      await studentPage
        .getByLabel('Adjunta tu trabajo')
        .setInputFiles({ name: 'mapa-ficticio.png', mimeType: 'image/png', buffer: png });
      await studentPage.getByRole('button', { name: 'Entregar trabajo' }).click();
      await expect(
        studentPage.getByText('Entrega pendiente de revisión', { exact: true }),
      ).toBeVisible();
      const submission = (await snapshot(page.request)).state.submissions.find(
        (s: { taskId: string }) => s.taskId === task.id,
      );
      await command(
        page.request,
        'reviewTask',
        submission.id,
        15,
        'Revisa las conexiones del mapa.',
      );
      await command(page.request, 'publishTaskGrade', submission.id);
      await studentPage.reload();
      await studentPage.getByLabel('Materia', { exact: true }).selectOption(subject.id);
      await expect(studentPage.getByText(/Esta entrega ya fue corregida/)).toBeVisible();
      await page.goto('/aula/tareas');
      await page.getByLabel('Materia', { exact: true }).selectOption(subject.id);
      const resubmit = await openDetails(page, 'Autorizar una reentrega');
      await resubmit.getByLabel('Estudiante', { exact: true }).selectOption(accounts.student.id);
      await resubmit
        .getByLabel('Motivo de la reentrega')
        .fill('Mejora las conexiones entre los conceptos.');
      await resubmit.getByRole('button', { name: 'Autorizar reentrega' }).click();
      await expect
        .poll(async () =>
          (await snapshot(studentContext.request)).resubmissionWindows.some(
            (w: { taskId: string }) => w.taskId === task.id,
          ),
        )
        .toBe(true);
      await studentPage.reload();
      await studentPage.getByLabel('Materia', { exact: true }).selectOption(subject.id);
      await studentPage
        .getByLabel('Archivos para reemplazar la entrega')
        .setInputFiles({ name: 'mapa-revisado.png', mimeType: 'image/png', buffer: png });
      await studentPage.getByRole('button', { name: 'Reemplazar entrega' }).click();
      await expect(
        studentPage.getByText('Ver 2 versiones de la entrega', { exact: true }),
      ).toBeVisible();
      const current = await snapshot(studentContext.request);
      expect(
        current.resubmissionWindows.some((w: { taskId: string }) => w.taskId === task.id),
      ).toBe(false);
      expect(
        current.state.submissions.filter((s: { taskId: string }) => s.taskId === task.id),
      ).toHaveLength(2);
      expect(
        current.state.evaluations.find((e: { activityId: string }) => e.activityId === task.id)
          .grade,
      ).toBe(15);
      await audit(studentPage);
      await studentPage.screenshot({
        path: testInfo.outputPath('reentrega-estudiante.png'),
        fullPage: true,
      });
    } finally {
      await studentContext.close();
    }
  });
});
