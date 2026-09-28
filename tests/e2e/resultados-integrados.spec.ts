import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
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
            await expect(row.getByRole('cell').nth(2)).toHaveText('Sin participar');
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
});
