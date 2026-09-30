import { expect, test } from '@playwright/test';
import type { DemoState } from '../../src/domain/types';
import { enterDemo } from './helpers';

type SoundEvent = {
  kind: 'answer-persisted' | 'mute-dispatched' | 'after-mute' | 'oscillator-start';
  time: number;
  button: string | null;
  pressed: string | null;
};
type SoundProbe = { armed: boolean; queued: boolean; events: SoundEvent[] };
declare global {
  interface Window {
    __aulifySoundProbe: SoundProbe;
  }
}

for (const muteBeforeContinuation of [false, true]) {
  test(`sonido al confirmar con preferencia ${muteBeforeContinuation ? 'silenciada antes de continuar' : 'activa'}`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.addInitScript(
      ({ mute }) => {
        window.__aulifySoundProbe = { armed: false, queued: false, events: [] };
        const record = (kind: SoundEvent['kind']) => {
          const button = [...document.querySelectorAll('button')].find((element) =>
            /^(Silenciar sonidos|Activar sonidos)$/.test(element.textContent?.trim() || ''),
          );
          window.__aulifySoundProbe.events.push({
            kind,
            time: performance.now(),
            button: button?.textContent?.trim() || null,
            pressed: button?.getAttribute('aria-pressed') || null,
          });
        };
        const createOscillator = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function () {
          const oscillator = createOscillator.call(this);
          const start = oscillator.start.bind(oscillator);
          oscillator.start = (when) => {
            record('oscillator-start');
            start(when);
          };
          return oscillator;
        };
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          setItem.call(this, key, value);
          const probe = window.__aulifySoundProbe;
          if (!mute || !probe.armed || probe.queued || key !== 'aulify.demo.v1') return;
          const state = JSON.parse(value) as DemoState;
          if (
            !state.attempts.some(
              (attempt) => attempt.studentId === 'student-camila' && attempt.answers.length === 1,
            )
          )
            return;
          probe.queued = true;
          record('answer-persisted');
          // Intercalación controlada: /demo guarda síncronamente. No simula latencia remota
          // ni una ventana de interacción humana durante ese almacenamiento.
          queueMicrotask(() => {
            const button = [...document.querySelectorAll('button')].find(
              (element) => element.textContent?.trim() === 'Silenciar sonidos',
            );
            if (!button) throw new Error('No se encontró el control de sonido durante el envío.');
            record('mute-dispatched');
            button.click();
            queueMicrotask(() => record('after-mute'));
          });
        };
      },
      { mute: muteBeforeContinuation },
    );

    await enterDemo(page, 'estudiante');
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
      state.activities.find((activity) => activity.id === 'activity-ecosystems')!.settings.sound =
        true;
      localStorage.setItem('aulify.demo.v1', JSON.stringify(state));
    });
    await page.goto('/demo/actividad/activity-ecosystems');
    await page.getByRole('button', { name: 'Empezar actividad', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Silenciar sonidos', exact: true }),
    ).toBeVisible();
    await page.getByRole('radio', { name: /El pasto/ }).check();
    await page.evaluate(() => {
      window.__aulifySoundProbe.armed = true;
    });
    await page.getByRole('button', { name: 'Responder', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '¡Bien conectado!', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: muteBeforeContinuation ? 'Activar sonidos' : 'Silenciar sonidos',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', String(!muteBeforeContinuation));

    const events = await page.evaluate(() => window.__aulifySoundProbe.events);
    expect(events.filter((event) => event.kind === 'oscillator-start')).toHaveLength(
      muteBeforeContinuation ? 0 : 1,
    );
    if (muteBeforeContinuation) {
      expect(events.map((event) => event.kind)).toEqual([
        'answer-persisted',
        'mute-dispatched',
        'after-mute',
      ]);
      expect(events.at(-1)).toMatchObject({ button: 'Activar sonidos', pressed: 'false' });
    }
    expect(
      await page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('aulify.demo.v1')!) as DemoState;
        return state.attempts.find((attempt) => attempt.studentId === 'student-camila')!.answers
          .length;
      }),
    ).toBe(1);
    await testInfo.attach('preferencia-sonido-observada', {
      body: JSON.stringify({ controlledMicrotask: muteBeforeContinuation, events }, null, 2),
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
  });
}
