import type { Page } from '@playwright/test';

export async function setDate(page: Page, label: string, value: string) {
  const field = page.getByRole('group', { name: label, exact: true });
  if (!value) {
    await field.getByRole('button', { name: /Abrir calendario/ }).click();
    await page.getByRole('button', { name: 'Borrar', exact: true }).click();
    return;
  }
  const [year, month, day] = value.split('-');
  for (const [segment, text] of [
    ['year', year],
    ['month', month],
    ['day', day],
  ]) {
    await field.locator(`[data-type="${segment}"]`).pressSequentially(text);
  }
}
