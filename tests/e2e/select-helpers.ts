import { expect, type Locator } from '@playwright/test';

/** Interact with the visible listbox, so tests exercise pointer selection and focus. */
export async function chooseOption(control: Locator, choice: string | { label: string }) {
  const trigger = control.filter({ visible: true });
  await trigger.click();
  const list = control.page().getByRole('listbox');
  await expect(list).toBeVisible();
  const option =
    typeof choice === 'string'
      ? list
          .locator('[role="option"]')
          .and(control.page().locator(`[data-value=${JSON.stringify(choice)}]`))
      : list.getByRole('option', { name: choice.label, exact: true });
  await option.click();
  await expect(list).toHaveCount(0);
}
