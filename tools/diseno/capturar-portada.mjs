import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.CAPTURE_URL || 'http://127.0.0.1:3000';
const output = process.env.CAPTURE_OUTPUT || 'docs/diseno/capturas/refinamiento';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const captures = [];
for (const [name, width, height, colorScheme, reducedMotion] of [
  ['escritorio', 1440, 900, 'light', 'no-preference'],
  ['movil', 390, 844, 'light', 'no-preference'],
  ['compacto-reducido', 360, 640, 'light', 'reduce'],
  ['oscuro', 1440, 900, 'dark', 'no-preference'],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme,
    reducedMotion,
  });
  await context.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.requestPointerLock = () => Promise.resolve();
  });
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
  if (
    await page.evaluate(() =>
      [...document.images].some((image) => !image.complete || !image.naturalWidth),
    )
  ) {
    throw new Error('Hay imágenes sin cargar. Se detiene la captura.');
  }
  for (const [state, scroll, fullPage] of [
    ['apertura', 0, false],
    ['completa', 0, true],
    ['intermedia', 390, false],
    ['salida', 660, false],
  ]) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), scroll);
    await page.waitForTimeout(150);
    const filename = `${name}-${state}.png`;
    await page.screenshot({ path: path.join(output, filename), fullPage });
    const bytes = await readFile(path.join(output, filename));
    captures.push({
      filename,
      viewport: { width, height },
      colorScheme,
      reducedMotion,
      scrollY: scroll,
      fullPage,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  await context.close();
}
await writeFile(
  path.join(output, 'manifest.json'),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      url: baseURL,
      environment: process.env.CAPTURE_ENV || 'development',
      browser: browser.version(),
      captures,
    },
    null,
    2,
  ),
);
await browser.close();
console.log(`${captures.length} capturas en ${output}`);
