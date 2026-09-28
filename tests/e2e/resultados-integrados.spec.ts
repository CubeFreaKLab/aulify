import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { dismissGuide, expectNoHorizontalOverflow } from './helpers';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test.setTimeout(180_000);
const enabled = process.env.AULIFY_REMOTE_E2E === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3002';
const headers = { Origin: new URL(baseURL).origin, 'Sec-Fetch-Site': 'same-origin' };
type Account = { id: string; email: string; password: string };

async function login(request: APIRequestContext, account: Account) {
  const response = await request.post(`${baseURL}/api/auth`, {
    headers,
    data: { action: 'access', email: account.email, password: account.password },
  });
  if (!response.ok()) throw new Error(`Acceso ficticio: HTTP ${response.status()}.`);
}

async function command(request: APIRequestContext, action: string, ...args: unknown[]) {
  const response = await request.post(`${baseURL}/api/commands`, {
    headers,
    data: { action, args },
  });
  if (!response.ok()) throw new Error(`Preparación ${action}: HTTP ${response.status()}.`);
  return (await response.json()).result;
}

test.describe('Resultados integrados con datos ficticios', () => {
  test.skip(!enabled, 'Requiere cuentas ficticias y conexión privada al proyecto de pruebas.');

  test('cada actividad aparece una vez y cambiar materia conserva únicamente sus filas', async ({
    page,
    playwright,
  }, testInfo) => {
    const accounts = JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8'))
      .users as Record<string, Account>;
    const teacher = await playwright.request.newContext();
    const subjects: { id: string; title: string; activities: { title: string; kind: string }[] }[] =
      [];
    const duplicateKeyErrors: string[] = [];
    page.on('console', (message) => {
      if (/same key|unique.*key/i.test(message.text())) duplicateKeyErrors.push(message.text());
    });
    try {
      await login(teacher, accounts.teacher);
      await login(page.request, accounts.student);
      const marker = crypto.randomUUID().slice(0, 8);
      const resource = {
        id: crypto.randomUUID(),
        title: `Preguntas para filtros ${marker}`,
        kind: 'quiz',
        revision: 1,
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'quiz',
            questions: [
              {
                id: crypto.randomUUID(),
                type: 'true-false',
                prompt: 'Las plantas utilizan luz.',
                points: 1,
                correct: true,
              },
            ],
          },
        ],
      };
      await command(teacher, 'saveDraft', resource, 0);
      const version = await command(teacher, 'publishResource', resource.id);
      const opensAt = new Date(Date.now() - 60_000).toISOString();
      const closesAt = new Date(Date.now() + 3_600_000).toISOString();
      for (const group of ['A', 'B']) {
        const title = `Resultados ${marker} ${group}`;
        const subject = await command(teacher, 'createSubject', {
          name: title,
          course: `3.º ${group}`,
          year: 2026,
          description: 'Datos ficticios para verificar el filtrado de calificaciones.',
        });
        const fixture = {
          id: subject.id as string,
          title,
          activities: [] as { title: string; kind: string }[],
        };
        subjects.push(fixture);
        const ownerResponse = await teacher.get(`${baseURL}/api/workspace`);
        expect(ownerResponse.status()).toBe(200);
        const code = (await ownerResponse.json()).state.subjects.find(
          (item: { id: string }) => item.id === subject.id,
        ).code;
        const membership = await command(page.request, 'requestMembership', code);
        await command(teacher, 'decideMembership', membership.id, 'approved');
        const quizTitle = `Quiz ${marker} ${group}`;
        await command(
          teacher,
          'createActivity',
          version.id,
          subject.id,
          {
            purpose: 'practice',
            pace: 'individual',
            maxGrade: 100,
            weight: 1,
            countsTowardAverage: true,
            maxAttempts: 1,
            opensAt,
            closesAt,
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
          quizTitle,
        );
        fixture.activities.push({ title: quizTitle, kind: 'Quiz' });
        const taskTitle = `Tarea ${marker} ${group}`;
        await command(teacher, 'createTask', {
          subjectId: subject.id,
          title: taskTitle,
          instructions: 'Entrega ficticia para verificar resultados.',
          opensAt,
          closesAt,
          maxGrade: 20,
          weight: 1,
          countsTowardAverage: true,
          allowLate: false,
        });
        fixture.activities.push({ title: taskTitle, kind: 'Tarea' });
        for (const published of [true, false]) {
          const manualTitle = `Manual ${published ? 'publicada' : 'pendiente'} ${marker} ${group}`;
          const manual = await command(teacher, 'createManualActivity', {
            subjectId: subject.id,
            title: manualTitle,
            description: 'Participación ficticia.',
            occursAt: new Date().toISOString(),
            maxGrade: 20,
            weight: 1,
            countsTowardAverage: true,
          });
          if (published)
            await command(
              teacher,
              'gradeManual',
              manual.id,
              accounts.student.id,
              16,
              'Participación clara.',
              null,
              true,
            );
          fixture.activities.push({ title: manualTitle, kind: 'Actividad manual' });
        }
      }

      await page.goto('/aula/resultados');
      await expect(page.getByRole('heading', { name: 'Cada paso cuenta.' })).toBeVisible();
      await dismissGuide(page);
      const table = page.getByRole('region', {
        name: 'Tabla de calificaciones, desplazable horizontalmente',
      });
      const rows = table.locator('tbody > tr');
      for (const subject of [subjects[0], subjects[1], subjects[0], subjects[1]]) {
        await page.getByLabel('Materia', { exact: true }).selectOption(subject.id);
        await expect(rows).toHaveCount(4);
        for (const activity of subject.activities) {
          const row = rows.filter({ has: page.getByText(activity.title, { exact: true }) });
          await expect(row).toHaveCount(1);
          await expect(
            row.getByRole('cell').nth(0).getByText(activity.kind, { exact: true }),
          ).toBeVisible();
          await expect(row.getByRole('cell').nth(1)).toContainText(subject.title);
          if (activity.title.includes('pendiente')) {
            await expect(row.getByRole('cell').nth(2)).toHaveText('Por revisar');
            await expect(row.getByRole('cell').nth(3)).toHaveText('—');
          }
        }
        const other = subjects.find((item) => item.id !== subject.id)!;
        await expect(table.getByText(other.title, { exact: true })).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
      }
      await page.getByLabel('Materia', { exact: true }).selectOption('all');
      for (const subject of subjects)
        for (const activity of subject.activities)
          await expect(
            rows.filter({ has: page.getByText(activity.title, { exact: true }) }),
          ).toHaveCount(1);
      expect(duplicateKeyErrors).toEqual([]);
      await page.getByLabel('Materia', { exact: true }).selectOption(subjects[0].id);
      await page.screenshot({
        path: testInfo.outputPath('resultados-filtrados.png'),
        fullPage: true,
      });
    } finally {
      for (const subject of subjects) await command(teacher, 'archiveSubject', subject.id);
      await teacher.dispose();
    }
  });

  test('AP-26: distribuye 0, 20, 80 y 100, separa pendiente y filtra fechas sin mezclar materias', async ({
    page,
    playwright,
  }, testInfo) => {
    const accounts = JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8'))
      .users as Record<string, Account>;
    const pool = JSON.parse(fs.readFileSync('.local-private/load-accounts.json', 'utf8'))
      .users as (Account & { group: number; position: number })[];
    const students = pool
      .filter((account) => account.group === 3 && account.position >= 46 && account.position <= 50)
      .sort((a, b) => a.position - b.position);
    if (students.length !== 5)
      throw new Error('AP-26 requiere cinco cuentas ficticias preparadas del grupo de prueba.');
    const contexts: APIRequestContext[] = [];
    const subjects: string[] = [];
    const marker = crypto.randomUUID().slice(0, 8);
    try {
      await login(page.request, accounts.teacher);
      for (const student of students) {
        const context = await playwright.request.newContext();
        contexts.push(context);
        await login(context, student);
      }
      const main = await command(page.request, 'createSubject', {
        name: `Seguimiento ${marker}`,
        course: `Curso A ${marker}`,
        year: 2026,
      });
      subjects.push(main.id);
      const other = await command(page.request, 'createSubject', {
        name: `Otra materia ${marker}`,
        course: `Curso B ${marker}`,
        year: 2025,
      });
      subjects.push(other.id);
      const ownerResponse = await page.request.get(`${baseURL}/api/workspace`);
      expect(ownerResponse.status()).toBe(200);
      const owner = await ownerResponse.json();
      for (const [index, context] of contexts.entries()) {
        for (const subject of index === 0 ? [main, other] : [main]) {
          const code = owner.state.subjects.find(
            (item: { id: string }) => item.id === subject.id,
          ).code;
          const request = await command(context, 'requestMembership', code);
          await command(page.request, 'decideMembership', request.id, 'approved');
        }
      }
      const createManual = (subjectId: string, title: string, occursAt: string) =>
        command(page.request, 'createManualActivity', {
          subjectId,
          title,
          occursAt,
          description: 'Datos ficticios para comprobar intervalos y filtros.',
          maxGrade: 100,
          weight: 1,
          countsTowardAverage: true,
        });
      const alphaTitle = `Fronteras ${marker}`;
      const betaTitle = `Segundo día ${marker}`;
      const alpha = await createManual(main.id, alphaTitle, '2026-09-25');
      const beta = await createManual(main.id, betaTitle, '2026-09-26');
      const auxiliary = await createManual(other.id, `Aislada ${marker}`, '2026-09-25');
      for (const [index, grade] of [0, 20, 80, 100].entries())
        await command(
          page.request,
          'gradeManual',
          alpha.id,
          students[index].id,
          grade,
          'Calificación de prueba.',
          null,
          true,
        );
      for (const student of students)
        await command(
          page.request,
          'gradeManual',
          beta.id,
          student.id,
          40,
          'Calificación del segundo día.',
          null,
          true,
        );
      await command(
        page.request,
        'gradeManual',
        auxiliary.id,
        students[0].id,
        10,
        'Resultado de otra materia.',
        null,
        true,
      );

      await page.goto('/aula/resultados');
      await expect(page.getByRole('heading', { name: 'El progreso, con contexto.' })).toBeVisible();
      await dismissGuide(page);
      await page.getByLabel('Curso', { exact: true }).selectOption(`Curso A ${marker}`);
      const results = page
        .getByRole('region', { name: 'Tabla de calificaciones, desplazable horizontalmente' })
        .locator('tbody > tr');
      const distribution = page.getByRole('region', {
        name: 'Tabla de distribución, desplazable horizontalmente',
      });
      const averageRows = page
        .getByRole('region', { name: 'Tabla de promedios, desplazable horizontalmente' })
        .locator('tbody > tr');
      const histogram = page.locator('.results-distribution-chart');
      async function expectDistribution(counts: number[]) {
        const tableCounts = await distribution.locator('tbody td').allTextContents();
        expect(tableCounts.map(Number)).toEqual(counts);
        expect((await histogram.locator('strong').allTextContents()).map(Number)).toEqual(counts);
        const widths = await histogram
          .locator('i')
          .evaluateAll((bars) => bars.map((bar) => (bar as HTMLElement).style.width));
        const largest = Math.max(1, ...counts);
        expect(widths).toEqual(counts.map((count) => `${(count / largest) * 100}%`));
      }
      async function expectAverageAgreement(expected: string[]) {
        const tableValues = (await averageRows.locator('td:last-child').allTextContents()).map(
          (value) => (value.trim() === 'Sin notas publicadas' ? '—' : value.trim()),
        );
        const graphValues = (
          await page.locator('.results-average-chart strong').allTextContents()
        ).map((value) => value.trim());
        expect(graphValues).toEqual(tableValues);
        expect(tableValues.sort()).toEqual([...expected].sort());
      }
      await expect(results).toHaveCount(10);
      await page.getByLabel('Actividad para distribución').selectOption(alpha.id);
      await expectDistribution([1, 1, 0, 0, 2]);
      await expect(distribution.locator('tfoot td')).toHaveText('4');
      await expect(
        page
          .locator('.results-distribution-statuses > div')
          .filter({ has: page.getByText('Por corregir', { exact: true }) })
          .locator('dd'),
      ).toHaveText('1');
      const pending = results
        .filter({ has: page.getByText(alphaTitle, { exact: true }) })
        .filter({ has: page.getByText('Por revisar', { exact: true }) });
      await expect(pending).toHaveCount(1);
      await expect(pending.getByRole('cell').nth(4)).toHaveText('—');

      await page.getByLabel('Desde la fecha', { exact: true }).fill('2026-09-25');
      await page.getByLabel('Hasta la fecha', { exact: true }).fill('2026-09-25');
      await expect(results).toHaveCount(5);
      await expect(page.getByRole('heading', { name: /Promedio del intervalo/ })).toBeVisible();
      await expectDistribution([1, 1, 0, 0, 2]);
      await expectAverageAgreement(['0', '20', '80', '100', '—']);
      expect(
        (await results.locator('td:nth-child(5)').allTextContents())
          .map((value) => value.replace(/\s/g, ''))
          .sort(),
      ).toEqual(['0/100', '20/100', '80/100', '100/100', '—'].sort());
      await expectNoHorizontalOverflow(page);
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(accessibility.violations.map((violation) => violation.id)).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath('distribucion-fronteras.png'),
        fullPage: true,
      });

      await page.getByLabel('Hasta la fecha', { exact: true }).fill('2026-09-26');
      await expect(results).toHaveCount(10);
      await expectAverageAgreement(['20', '30', '60', '70', '40']);
      await page.getByLabel('Desde la fecha', { exact: true }).fill('2026-09-26');
      await expect(results).toHaveCount(5);
      await expect(page.getByLabel('Actividad para distribución')).toHaveValue(beta.id);
      await expectDistribution([0, 0, 5, 0, 0]);
      await expectAverageAgreement(['40', '40', '40', '40', '40']);

      await page.getByLabel('Desde la fecha', { exact: true }).fill('');
      await page.getByLabel('Hasta la fecha', { exact: true }).fill('');
      await page.getByLabel('Curso', { exact: true }).selectOption('all');
      await page.getByLabel('Materia', { exact: true }).selectOption(other.id);
      await expect(results).toHaveCount(1);
      await expectAverageAgreement(['10']);
      await page.getByLabel('Año', { exact: true }).selectOption('2026');
      await expect(
        page.getByRole('heading', { name: 'Todavía no hay resultados en este grupo' }),
      ).toBeVisible();
      await page.getByLabel('Año', { exact: true }).selectOption('2025');
      await expect(results).toHaveCount(1);
      await expectAverageAgreement(['10']);
      await page.getByLabel('Desde la fecha', { exact: true }).fill('2026-09-26');
      await expect(
        page.getByRole('heading', { name: 'Todavía no hay resultados en este grupo' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Restablecer filtros' }).click();
      await page.getByLabel('Curso', { exact: true }).selectOption(`Curso A ${marker}`);
      await expect(results).toHaveCount(10);
      await expectAverageAgreement(['20', '30', '60', '70', '40']);

      await login(page.request, students[0]);
      await page.goto('/aula/resultados');
      await expect(page.getByRole('heading', { name: 'Cada paso cuenta.' })).toBeVisible();
      await dismissGuide(page);
      await expect(page.getByRole('heading', { name: 'Distribución por actividad' })).toHaveCount(
        0,
      );
      await page.getByLabel('Desde la fecha', { exact: true }).fill('2026-09-25');
      await page.getByLabel('Hasta la fecha', { exact: true }).fill('2026-09-25');
      await expect(results).toHaveCount(2);
      await expectAverageAgreement(['0', '10']);
    } finally {
      await login(page.request, accounts.teacher);
      for (const subjectId of subjects) await command(page.request, 'archiveSubject', subjectId);
      for (const context of contexts) await context.dispose();
    }
  });
});
