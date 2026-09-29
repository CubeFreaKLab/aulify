import { expect, test } from '@playwright/test';
import { createDemoState } from '../../src/domain';
import { allowedHrefs, documentWithHref, literalCode } from '../fixtures/editor-link-cases';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

test('AP-33: HTTPS y código educativo literal se conservan al editar, guardar y leer', async ({
  page,
}, testInfo) => {
  const state = createDemoState();
  const document = documentWithHref(allowedHrefs[0]);
  state.resources[0].editorDocument = [...document[0].children!, document[1]];
  const externalRequests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(testInfo.project.use.baseURL!).origin) {
      externalRequests.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript((initial) => {
    if (!localStorage.getItem('aulify.demo.v1'))
      localStorage.setItem('aulify.demo.v1', JSON.stringify(initial));
  }, state);
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  const editor = page.getByLabel('Contenido del recurso');
  await expect(editor.getByRole('link', { name: 'Material HTTPS de ejemplo' })).toHaveAttribute(
    'href',
    allowedHrefs[0],
  );
  await expect(editor).toContainText('<script>globalThis.__aulify_ap33_literal="opened"</script>');
  await page.getByLabel('Título del recurso').fill('AP-33 · Código y enlace permitidos');
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expect(editor.getByRole('link', { name: 'Material HTTPS de ejemplo' })).toHaveAttribute(
    'href',
    allowedHrefs[0],
  );
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  const reader = page.locator('.rich-reader');
  await expect(reader.getByRole('link', { name: 'Material HTTPS de ejemplo' })).toHaveAttribute(
    'href',
    allowedHrefs[0],
  );
  await expect(reader.locator('pre')).toHaveText(literalCode);
  await expect(reader).toContainText('Texto literal: javascript:, data:, vbscript: y <script>.');
  await expect(reader.locator('script')).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      marker: '__aulify_ap33_marker' in globalThis,
      literal: '__aulify_ap33_literal' in globalThis,
    })),
  ).toEqual({ marker: false, literal: false });
  expect(externalRequests).toEqual([]);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('ap33-literales-seguros.png'),
    fullPage: true,
  });
});
