import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import type { DemoState, Resource } from '../../src/domain/types';
import { dismissGuide } from './helpers';

test.use({ trace: 'off', video: 'off', screenshot: 'off', reducedMotion: 'reduce' });
const enabled = process.env.AULIFY_REMOTE_E2E === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002';
const headers = { Origin: baseURL, 'Sec-Fetch-Site': 'same-origin' };

async function command(request: APIRequestContext, action: string, ...args: unknown[]) {
  const response = await request.post(`${baseURL}/api/commands`, {
    headers,
    data: { action, args },
  });
  expect(response.status(), `Operación ficticia ${action}`).toBe(200);
  return (await response.json()).result;
}

test('dos pestañas detectan el conflicto y conservan una copia sin sobrescribir el original', async ({
  page,
  context,
}, testInfo) => {
  test.skip(!enabled, 'Requiere cuentas ficticias y servicios reales.');
  expect(new URL(baseURL).hostname).toBe('127.0.0.1');
  const accounts = JSON.parse(fs.readFileSync('.local-private/remote-test-accounts.json', 'utf8'));
  expect(accounts.projectRef).toBe('bnqyyumfmyexsqszglab');
  const account = accounts.users.teacher;
  const auth = await page.request.post(`${baseURL}/api/auth`, {
    headers,
    data: { action: 'access', email: account.email, password: account.password },
  });
  expect(auth.status(), 'Acceso ficticio sin grabar credenciales').toBe(200);
  const original: Resource = {
    id: randomUUID(),
    ownerId: account.id,
    title: 'Borrador de dos pestañas',
    kind: 'resource',
    revision: 1,
    updatedAt: new Date().toISOString(),
    blocks: [{ id: randomUUID(), type: 'text', text: 'Contenido ficticio que debe conservarse.' }],
  };
  await command(page.request, 'saveDraft', original, 0);
  await page.goto(`/aula/editor/${original.id}`);
  await dismissGuide(page);
  await expect(page.locator('.bn-editor')).toBeVisible();
  const second = await context.newPage();
  await second.goto(`/aula/editor/${original.id}`);
  await dismissGuide(second);
  await expect(second.locator('.bn-editor')).toBeVisible();
  await expect(second.getByLabel('Título del recurso')).toHaveValue(original.title);

  let queued = false;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await second.route('**/api/commands', async (route) => {
    const payload = route.request().postDataJSON();
    if (payload.action === 'saveDraft' && payload.args?.[0]?.id === original.id) {
      queued = true;
      await gate;
    }
    await route.continue();
  });
  try {
    await second.getByLabel('Título del recurso').fill('Cambio de la segunda pestaña');
    await expect
      .poll(() => queued, { message: 'Guardar una edición pendiente desde la misma revisión' })
      .toBe(true);
    const firstSaved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/commands') &&
        response.request().postDataJSON()?.action === 'saveDraft' &&
        response.ok(),
    );
    await page.getByLabel('Título del recurso').fill('Cambio confirmado de la primera pestaña');
    await firstSaved;
    release?.();
    await expect(
      second.getByRole('alert').filter({ hasText: 'El borrador no se guardó.' }),
    ).toBeVisible();
    await expect(second.getByLabel('Título del recurso')).toHaveValue(
      'Cambio de la segunda pestaña',
    );
    fs.mkdirSync('.local-private/qa', { recursive: true });
    const screenshot = `.local-private/qa/editor-conflicto-${testInfo.project.name}.png`;
    await second.screenshot({ path: screenshot });
    await second.getByRole('button', { name: 'Conservar una copia', exact: true }).click();
    await expect(second).toHaveURL(/\/aula\/editor\//);
    await expect(second.getByLabel('Título del recurso')).toHaveValue(
      'Cambio de la segunda pestaña (copia)',
    );
    expect(second.url().split('/').at(-1)).not.toBe(original.id);
    const snapshotResponse = await page.request.get(`${baseURL}/api/workspace`);
    expect(snapshotResponse.status()).toBe(200);
    const state = (await snapshotResponse.json()).state as DemoState;
    const storedOriginal = state.resources.find((resource) => resource.id === original.id);
    const storedCopy = state.resources.find(
      (resource) => resource.id === second.url().split('/').at(-1),
    );
    expect(storedOriginal?.title).toBe('Cambio confirmado de la primera pestaña');
    expect(storedCopy?.title).toBe('Cambio de la segunda pestaña (copia)');
    expect(JSON.stringify(storedOriginal?.blocks)).toContain(
      'Contenido ficticio que debe conservarse.',
    );
    expect(JSON.stringify(storedCopy?.blocks)).toContain(
      'Contenido ficticio que debe conservarse.',
    );
    fs.writeFileSync(
      `docs/verificacion/editor-conflicto-${testInfo.project.name}.json`,
      JSON.stringify(
        {
          executedAt: new Date().toISOString(),
          case: 'AC-08',
          result: 'passed',
          environment: 'Navegador Chromium, aplicación compilada local y Supabase real',
          scriptSha256: createHash('sha256')
            .update(fs.readFileSync('tests/e2e/editor-conflicto-integrado.spec.ts'))
            .digest('hex'),
          checks: [
            'Edición en dos pestañas con la misma revisión',
            'Primera edición confirmada',
            'Segunda edición rechazada con aviso visible y texto conservado',
            'Copia independiente conservada',
            'Original y contenido intactos',
          ],
          limitations: [
            'Se retuvo una solicitud para fijar el orden; respuestas reales del servidor, sin simulación.',
            'Escritorio automatizado; no representa lector de pantalla ni evaluación con personas.',
          ],
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    release?.();
    await second.close();
  }
});
