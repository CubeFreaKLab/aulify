import { expect, test, type Page } from '@playwright/test';
import { createDemoState, DEMO_IDS, startAttempt, type DemoState } from '../../src/domain';
import { HELP_STEPS, HELP_VERSION } from '../../src/domain/help';
import AxeBuilder from '@axe-core/playwright';
import { expectNoHorizontalOverflow } from './helpers';

async function seed(page: Page, state: DemoState) {
  await page.addInitScript((initial) => {
    if (!localStorage.getItem('aulify.demo.v1'))
      localStorage.setItem('aulify.demo.v1', JSON.stringify(initial));
  }, state);
}

test('AP-34: una preferencia anterior permite invitación discreta a la nueva guía, sin diálogo automático', async ({
  page,
}) => {
  const state = createDemoState();
  state.helpPreferences = [{ userId: DEMO_IDS.teacher, status: 'completed', version: 1 }];
  await seed(page, state);
  await page.goto('/demo?perfil=docente');
  await expect(page.getByRole('heading', { name: 'Hola, Elena.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Hay una nueva versión de la guía de Aulify.')).toBeVisible();
  await expect
    .poll(
      async () =>
        (await savedState(page)).helpPreferences.find(
          (item) => item.userId === DEMO_IDS.teacher && item.version === HELP_VERSION,
        )?.status,
    )
    .toBe('offered');
  await page.getByRole('button', { name: 'Ahora no', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Elena.' })).toBeVisible();
  await expect(page.getByText('Hay una nueva versión de la guía de Aulify.')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

async function savedState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState);
}
function domainData(state: DemoState) {
  return { ...state, helpPreferences: [], revision: 0 };
}

for (const role of ['teacher', 'student'] as const) {
  test(`AC-31/33/34: cinco pasos de ${role} sin datos, teclado, retroceso y foco`, async ({
    page,
  }, testInfo) => {
    const state: DemoState = {
      schemaVersion: 1,
      revision: 0,
      users: createDemoState().users,
      subjects: [],
      memberships: [],
      resources: [],
      versions: [],
      activities: [],
      attempts: [],
      powerups: [],
      evaluations: [],
      tasks: [],
      submissions: [],
      manualActivities: [],
      helpPreferences: [],
    };
    await seed(page, state);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/demo?perfil=${role === 'teacher' ? 'docente' : 'estudiante'}`);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Ahora no', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Conocer Aulify', exact: true }).focus();
    await page.keyboard.press('Enter');
    for (let index = 0; index < HELP_STEPS[role].length; index++) {
      const heading = dialog.getByRole('heading', {
        name: HELP_STEPS[role][index][0],
        exact: true,
      });
      await expect(heading).toBeFocused();
      await expect(dialog.getByText(`Paso ${index + 1} de 5`, { exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (index === 1) {
        await dialog.getByRole('button', { name: 'Anterior', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(
          dialog.getByRole('heading', { name: HELP_STEPS[role][0][0], exact: true }),
        ).toBeFocused();
        await dialog.getByRole('button', { name: 'Siguiente', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(heading).toBeFocused();
      }
      const button = dialog.getByRole('button', {
        name: index === 4 ? 'Terminar guía' : 'Siguiente',
        exact: true,
      });
      await expect(button).toBeInViewport();
      if (index === 4) {
        const violations = (
          await new AxeBuilder({ page })
            .include('[role="dialog"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations;
        expect(violations).toEqual([]);
        await testInfo.attach('guia-accesibilidad', {
          body: JSON.stringify({ role, reducedMotion: true, violations }),
          contentType: 'application/json',
        });
      }
      await button.focus();
      await page.keyboard.press('Enter');
    }
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Hola,/ })).toBeFocused();
    await expect(
      page.getByRole('link', {
        name: role === 'teacher' ? 'Preparar mi clase' : 'Explorar la actividad',
        exact: true,
      }),
    ).toBeVisible();
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
    expect(domainData(await savedState(page))).toEqual(domainData(state));
    await page.goto('/demo/ayuda');
    const repeat = page.getByRole('button', { name: 'Repetir la guía', exact: true });
    await repeat.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(repeat).toBeFocused();
    expect(domainData(await savedState(page))).toEqual(domainData(state));
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });
}

test('AC-32: omitir persiste al volver y permite repetir desde Ayuda', async ({ page }) => {
  await seed(page, createDemoState());
  await page.goto('/demo?perfil=docente');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Ahora no', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Elena.' })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.goto('/demo/ayuda');
  await page.getByRole('button', { name: 'Repetir la guía', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: HELP_STEPS.teacher[0][0] })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.goto('/demo/biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
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
