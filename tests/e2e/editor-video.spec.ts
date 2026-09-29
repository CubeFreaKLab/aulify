import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { enterDemo, expectNoHorizontalOverflow } from './helpers';

test('video conserva título y enlace; se carga solo al pedirlo y mantiene alternativa externa', async ({
  page,
}) => {
  const mediaRequests: string[] = [];
  await page.route('https://www.youtube-nocookie.com/**', async (route) => {
    mediaRequests.push(route.request().url());
    await route.fulfill({
      contentType: 'text/html',
      body: '<html lang="es"><title>Reproductor de prueba</title><body>Contenido simulado del proveedor</body></html>',
    });
  });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  await expect(page.locator('.bn-editor')).toBeVisible();
  await page.getByLabel('Insertar bloque', { exact: true }).selectOption('video');
  await page
    .getByLabel('Enlace al video (HTTPS)', { exact: true })
    .fill('https://youtu.be/M7lc1UVf-VE');
  await page.getByLabel('Título del video', { exact: true }).fill('Cómo observar un ecosistema');
  await page.getByRole('button', { name: 'Mostrar video', exact: true }).click();
  const editorVideo = page.locator('.video-block-editor');
  await expect(editorVideo.getByRole('button', { name: /Cargar video/ })).toBeVisible();
  expect(mediaRequests).toEqual([]);
  await expect(editorVideo.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('Borrador guardado', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.bn-editor')).toBeVisible();
  await expect(
    editorVideo.getByRole('button', { name: /Cómo observar un ecosistema/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  const video = page.locator('.rich-reader .resource-video');
  await expect(video).toBeVisible();
  await expect(video.locator('iframe')).toHaveCount(0);
  expect(mediaRequests).toEqual([]);
  await video.getByRole('button', { name: /Cargar video/ }).click();
  await expect(video.locator('iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?playsinline=1',
  );
  await expect(video.locator('iframe')).toHaveAttribute('title', 'Cómo observar un ecosistema');
  await expect(video.getByRole('link')).toHaveAttribute('href', 'https://youtu.be/M7lc1UVf-VE');
  await expect.poll(() => mediaRequests.length).toBe(1);
  await expectNoHorizontalOverflow(page);
  const scan = await new AxeBuilder({ page })
    .include('.rich-reader')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(scan.violations).toEqual([]);
});
