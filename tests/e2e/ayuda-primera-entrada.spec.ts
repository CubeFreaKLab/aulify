import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import { HELP_STEPS, HELP_VERSION } from '../../src/domain/help';
import type { DemoState } from '../../src/domain';
import { expectNoHorizontalOverflow } from './helpers';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001';
const headers = { Origin: new URL(baseURL).origin, 'Sec-Fetch-Site': 'same-origin' };
type Account = { id: string; email: string; password: string; role: 'teacher' | 'student' };
type Workspace = { userId: string; state: DemoState };

async function snapshot(request: APIRequestContext): Promise<Workspace> {
  const response = await request.get(`${baseURL}/api/workspace`);
  expect(response.status()).toBe(200);
  return response.json();
}

function domain(state: DemoState) {
  return { ...state, revision: 0, helpPreferences: [] };
}

test('AC-31/AP-34 remoto: primera visita de ambos perfiles confirmados y persistencia entre sesiones', async ({
  browser,
}, testInfo) => {
  test.skip(
    process.env.AULIFY_FIRST_VISIT_E2E !== '1' || testInfo.project.name !== 'chromium-escritorio',
    'Requiere dos cuentas ficticias confirmadas sin preferencias previas; no se reinicia su historial.',
  );
  test.setTimeout(150000);
  const accounts: Account[] = JSON.parse(
    fs.readFileSync('.local-private/first-visit-accounts.json', 'utf8'),
  ).users;
  const outcomes = [];
  for (const role of ['teacher', 'student'] as const) {
    const account = accounts.find((item) => item.role === role);
    if (!account) throw new Error(`Falta la cuenta ficticia ${role}`);
    const contexts: BrowserContext[] = [];
    const login = async (context: BrowserContext) => {
      const response = await context.request.post(`${baseURL}/api/auth`, {
        headers,
        data: { action: 'access', email: account.email, password: account.password },
      });
      expect(response.status()).toBe(200);
    };
    try {
      const context = await browser.newContext({
        baseURL,
        viewport: role === 'teacher' ? { width: 1440, height: 900 } : { width: 390, height: 844 },
        isMobile: role === 'student',
        hasTouch: role === 'student',
        reducedMotion: 'reduce',
        locale: 'es-BO',
      });
      contexts.push(context);
      await login(context);
      const before = await snapshot(context.request);
      expect(before.userId).toBe(account.id);
      expect(before.state.users.find((user) => user.id === account.id)?.role).toBe(role);
      expect(before.state.helpPreferences).toEqual([]);
      expect(
        before.state.attempts.some(
          (attempt) => attempt.studentId === account.id && attempt.status === 'in-progress',
        ),
      ).toBe(false);
      const page = await context.newPage();
      await page.goto('/aula');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Conocer Aulify', exact: true }).click();
      for (let index = 0; index < HELP_STEPS[role].length; index++) {
        await expect(
          dialog.getByRole('heading', { name: HELP_STEPS[role][index][0], exact: true }),
        ).toBeFocused();
        await expectNoHorizontalOverflow(page);
        const next = dialog.getByRole('button', {
          name: index === 4 ? 'Terminar guía' : 'Siguiente',
          exact: true,
        });
        await expect(next).toBeInViewport();
        await next.click();
      }
      await expect(dialog).toHaveCount(0);
      const after = await snapshot(context.request);
      expect(after.state.helpPreferences).toEqual([
        { userId: account.id, status: 'completed', version: HELP_VERSION },
      ]);
      expect(domain(after.state)).toEqual(domain(before.state));
      await context.request.post(`${baseURL}/api/auth`, { headers, data: { action: 'signout' } });
      expect((await context.request.get(`${baseURL}/api/workspace`)).status()).toBe(401);
      const independent = await browser.newContext({ baseURL, locale: 'es-BO' });
      contexts.push(independent);
      await login(independent);
      const recovered = await snapshot(independent.request);
      expect(recovered.state.helpPreferences).toEqual(after.state.helpPreferences);
      const nextVisit = await independent.newPage();
      await nextVisit.goto('/aula');
      await expect(nextVisit.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
      await expect(nextVisit.getByRole('dialog')).toHaveCount(0);
      outcomes.push({ role, steps: 5, firstVisit: true, recovered: true, domainUnchanged: true });
    } finally {
      for (const context of contexts) {
        await context.request
          .post(`${baseURL}/api/auth`, { headers, data: { action: 'signout' } })
          .catch(() => undefined);
        await context.close();
      }
    }
  }
  await testInfo.attach('primera-visita-resultado', {
    body: JSON.stringify({ guideVersion: HELP_VERSION, outcomes, newAccounts: 0, emailsSent: 0 }),
    contentType: 'application/json',
  });
});
