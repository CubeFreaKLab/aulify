import { expect, test } from '@playwright/test';
import { enterDemo } from './helpers';
import type { DemoState } from '../../src/domain';

test('Publicar: apertura estática; teclado y arrastre parcial en la confirmación', async ({
  page,
}, info) => {
  await enterDemo(page, 'docente');
  await page.goto('/demo/editor/resource-ecosystems');
  await expect(page.locator('.bn-editor')).toBeVisible();
  const count = () =>
    page.evaluate(
      () => (JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState).activities.length,
    );
  const before = await count();
  const publish = page.getByRole('button', { name: 'Publicar', exact: true });
  await publish.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Comparte una nueva experiencia' });
  await expect(dialog).toBeVisible();
  expect(await count()).toBe(before);
  await dialog.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await count()).toBe(before);
  await publish.click();
  await expect(dialog).toBeVisible();
  if (!info.project.name.includes('movil')) {
    const confirm = dialog.getByRole('button', { name: 'Publicar en la materia', exact: true });
    await confirm.hover();
    const box = (await confirm.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    expect(await count()).toBe(before);
    await expect(dialog).toBeVisible();
  }
  await dialog.getByRole('button', { name: 'Publicar en la materia', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/demo\/materia\/subject-biology$/);
  expect(await count()).toBe(before + 1);
});
