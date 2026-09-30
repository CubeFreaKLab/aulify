import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import { HELP_STEPS, HELP_VERSION } from '../../src/domain/help';
import type { DemoState } from '../../src/domain';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const enabled = process.env.AULIFY_REMOTE_E2E === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002';
const headers = { Origin: new URL(baseURL).origin, 'Sec-Fetch-Site': 'same-origin' };

type Workspace = { userId: string; state: DemoState };
async function snapshot(request: APIRequestContext): Promise<Workspace> {
  const response = await request.get(`${baseURL}/api/workspace`);
  if (!response.ok()) throw new Error(`Lectura de prueba: HTTP ${response.status()}`);
  return response.json();
}
function content(state: DemoState) {
  return { ...state, revision: 0, helpPreferences: [] };
}

test('AP-34 remoto: preferencia de la misma cuenta en sesiones independientes de escritorio y móvil', async ({
  browser,
}, testInfo) => {
  test.skip(
    !enabled || testInfo.project.name !== 'chromium-escritorio',
    'Ensayo privado único con cuentas ficticias; crea sus dos contextos.',
  );
  test.setTimeout(120000);
  const account = JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8'))
    .users.teacherOther;
  const contexts: BrowserContext[] = [];
  const login = async (context: BrowserContext) => {
    const response = await context.request.post(`${baseURL}/api/auth`, {
      headers,
      data: { action: 'access', email: account.email, password: account.password },
    });
    if (!response.ok()) throw new Error(`Acceso ficticio: HTTP ${response.status()}`);
  };
  const first = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    locale: 'es-BO',
  });
  contexts.push(first);
  try {
    await login(first);
    const initial = await snapshot(first.request);
    expect(initial.state.users.find((user) => user.id === initial.userId)?.role).toBe('teacher');
    const prepared = await first.request.post(`${baseURL}/api/commands`, {
      headers,
      data: { action: 'setHelpPreference', args: ['offered', HELP_VERSION] },
    });
    expect(prepared.status()).toBe(200);
    const page = await first.newPage();
    await page.goto('/aula');
    await expect(page.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ahora no', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Conocer Aulify', exact: true })).toHaveCount(0);
    const omitted = await snapshot(first.request);
    expect(
      omitted.state.helpPreferences.find((item) => item.version === HELP_VERSION)?.status,
    ).toBe('skipped');
    expect(content(omitted.state)).toEqual(content(initial.state));
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page).toHaveURL(/\/acceso$/);

    const second = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
      locale: 'es-BO',
    });
    contexts.push(second);
    await login(second);
    const mobile = await second.newPage();
    await mobile.goto('/aula');
    await expect(mobile.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
    await expect(mobile.getByRole('dialog')).toHaveCount(0);
    await expect(mobile.getByRole('button', { name: 'Conocer Aulify', exact: true })).toHaveCount(
      0,
    );
    await mobile.goto('/aula/ayuda');
    await mobile.getByRole('button', { name: 'Repetir la guía', exact: true }).click();
    const guide = mobile.getByRole('dialog');
    for (let index = 0; index < HELP_STEPS.teacher.length; index++) {
      await expect(
        guide.getByRole('heading', { name: HELP_STEPS.teacher[index][0], exact: true }),
      ).toBeVisible();
      await guide
        .getByRole('button', { name: index === 4 ? 'Terminar guía' : 'Siguiente', exact: true })
        .click();
    }
    await expect(guide).toHaveCount(0);
    const completed = await snapshot(second.request);
    expect(
      completed.state.helpPreferences.find((item) => item.version === HELP_VERSION)?.status,
    ).toBe('completed');
    expect(content(completed.state)).toEqual(content(initial.state));
    await login(first);
    const recovered = await snapshot(first.request);
    expect(recovered.userId).toBe(completed.userId);
    expect(recovered.state.helpPreferences).toEqual(completed.state.helpPreferences);
    expect(recovered.state.helpPreferences.every((item) => item.userId === recovered.userId)).toBe(
      true,
    );
    await testInfo.attach('ayuda-cuenta-resultado', {
      body: JSON.stringify({
        preferenceVersion: HELP_VERSION,
        firstSession: 'skipped',
        independentMobileSession: 'completed',
        recoveredSession: 'completed',
        sameAccount: true,
        otherDomainDataUnchanged: true,
        contexts: 2,
        newAccounts: 0,
      }),
      contentType: 'application/json',
    });
  } finally {
    for (const context of contexts) {
      await context.request
        .post(`${baseURL}/api/auth`, { headers, data: { action: 'signout' } })
        .catch(() => undefined);
      await context.close();
    }
  }
});
