import { expect, type Page } from '@playwright/test';

export async function dismissGuide(page: Page): Promise<void> {
  const exitingModals = page.locator('.dialog[data-exiting], .dialog-overlay[data-exiting]');
  await expect(exitingModals).toHaveCount(0);
  const guide = page.getByRole('dialog', { includeHidden: true }).filter({
    has: page.getByRole('button', { name: 'Ahora no', exact: true, includeHidden: true }),
  });
  if (await guide.isVisible()) {
    await guide.getByRole('button', { name: 'Ahora no', exact: true }).click();
    // Wait for removal, not just invisibility: an exiting dialog still affects an axe scan.
    await expect(guide).toHaveCount(0);
  }
  await expect(exitingModals).toHaveCount(0);
}

export async function enterDemo(page: Page, profile: 'docente' | 'estudiante'): Promise<void> {
  await page.goto(`/demo?perfil=${profile}`);
  await expect(
    page.getByRole('heading', {
      name: profile === 'docente' ? 'Hola, Elena.' : 'Hola, Camila.',
      exact: true,
    }),
  ).toBeVisible();
  await dismissGuide(page);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1);
}

export async function expectLoadedImages(page: Page): Promise<void> {
  const images = page.locator('img');
  await expect
    .poll(async () =>
      images.evaluateAll((elements) =>
        elements
          .filter(
            (image) =>
              !(image as HTMLImageElement).complete ||
              (image as HTMLImageElement).naturalWidth === 0,
          )
          .map((image) => image.getAttribute('src')),
      ),
    )
    .toEqual([]);
}

export async function clickNav(page: Page, name: string): Promise<void> {
  const link = page
    .getByRole('navigation', { name: 'Navegación de la plataforma' })
    .getByRole('link', { name, exact: true });
  // The sidebar is an aside landmark, so use the document link when navigation has no explicit label.
  const actual = (await link.count())
    ? link
    : page.getByRole('link', { name, exact: true }).first();
  if (!(await actual.isVisible()))
    await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await actual.click();
}
