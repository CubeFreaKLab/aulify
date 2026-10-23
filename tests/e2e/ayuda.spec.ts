import { expect, test, type Page } from '@playwright/test';
import { createDemoState, DEMO_IDS, startAttempt, type DemoState } from '../../src/domain';
import { HELP_VERSION } from '../../src/domain/help';
import AxeBuilder from '@axe-core/playwright';
import { expectNoHorizontalOverflow } from './helpers';
async function seed(page: Page, state: DemoState) {
  await page.addInitScript((initial) => {
    if (!localStorage.getItem('aulify.demo.v1'))
      localStorage.setItem('aulify.demo.v1', JSON.stringify(initial));
  }, state);
}
async function savedState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState);
}
function domainData(state: DemoState) {
  return { ...state, helpPreferences: [], revision: 0 };
}
for (const role of ['teacher', 'student'] as const) {
  test(`Guía contextual ${role}: controles reales, teclado, retroceso y datos intactos`, async ({
    page,
  }) => {
    const initial = createDemoState();
    await seed(page, initial);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/demo?perfil=${role === 'teacher' ? 'docente' : 'estudiante'}`);
    const dialog = page.locator('.page-guide-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(role === 'teacher' ? 'Guía docente' : 'Guía estudiante');
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    expect(violations).toEqual([]);
    const title = dialog.locator('h2');
    await expect(title).toBeFocused();
    const first = await title.innerText();
    await dialog.getByRole('button', { name: 'Siguiente', exact: true }).press('Enter');
    await expect(title).not.toHaveText(first);
    await dialog.getByRole('button', { name: 'Anterior', exact: true }).press('Enter');
    await expect(title).toHaveText(first);
    let count = 0;
    while (await dialog.count()) {
      const previous = await title.innerText();
      await expectNoHorizontalOverflow(page);
      const next = dialog.getByRole('button', { name: /^(Siguiente|Terminar guía)$/ });
      await expect(next).toBeInViewport();
      const last = (await next.innerText()).includes('Terminar');
      await next.press('Enter');
      count++;
      if (last) await expect(dialog).toHaveCount(0);
      else await expect(title).not.toHaveText(previous);
      if (count > 10) throw new Error('La guía no termina');
    }
    expect(count).toBeGreaterThanOrEqual(4);
    await expect
      .poll(
        async () =>
          (await savedState(page)).helpPreferences.find(
            (p) =>
              p.userId === (role === 'teacher' ? DEMO_IDS.teacher : DEMO_IDS.student) &&
              p.version === HELP_VERSION,
          )?.status,
      )
      .toBe('completed');
    expect(domainData(await savedState(page))).toEqual(domainData(initial));
    const repeat = page.getByRole('button', { name: 'Guía de esta página', exact: true });
    await repeat.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(repeat).toBeFocused();
  });
}
test('Guías por página: omitir, siguiente página, desactivar automáticas y repetir', async ({
  page,
}) => {
  await seed(page, createDemoState());
  await page.goto('/demo?perfil=docente');
  const dialog = page.locator('.page-guide-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar guía' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Elena.' })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.goto('/demo/materias');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Tus grupos, en un lugar');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Cerrar guía' }).click();
  await page.goto('/demo/biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Guía de esta página' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Crea un borrador');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
test('AP-34/AC-34: ayuda estática durante intento temporizado, sin superposición ni pausa', async ({
  page,
}) => {
  const now = new Date().toISOString();
  let state = createDemoState(now);
  state.activities[0].settings.timeLimitMinutes = 2;
  state.activities[0].settings.closesAt = new Date(Date.now() + 3600000).toISOString();
  state = startAttempt(state, DEMO_IDS.activity, DEMO_IDS.student, {
    actorId: DEMO_IDS.student,
    now,
    id: 'ayuda-intento',
  }).state;
  await seed(page, state);
  await page.goto('/demo?perfil=estudiante');
  await expect(page.getByRole('heading', { name: 'Hola, Camila.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/demo/ayuda');
  await expect(page.getByRole('button', { name: 'Repetir la guía' })).toHaveCount(0);
  await page.locator('summary').filter({ hasText: 'Ayuda durante la actividad' }).click();
  await expect(page.getByText('La ayuda no pausa', { exact: false })).toBeVisible();
  await page.goto(`/demo/actividad/${DEMO_IDS.activity}`);
  await page.getByRole('button', { name: 'Retomar mi participación', exact: true }).click();
  const timer = page.locator('.quiz-heading').getByText(/^\d+:\d{2}$/);
  await expect(timer).toBeVisible();
  const before = await timer.textContent();
  const help = page.locator('summary').filter({ hasText: 'Ayuda durante la actividad' });
  await help.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('La ayuda no pausa', { exact: false })).toBeVisible();
  await expect.poll(() => timer.textContent()).not.toBe(before);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(domainData(await savedState(page))).toEqual(domainData(state));
  await expectNoHorizontalOverflow(page);
});
