import { afterEach, expect, it, vi } from 'vitest';
import { isDemoEnabled } from '../../src/lib/demo-availability';

afterEach(() => vi.unstubAllEnvs());
it('producción no habilita la muestra aunque una variable residual pida activarla', () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('AULIFY_DEMO_ENABLED', 'true');
  expect(isDemoEnabled()).toBe(false);
});
it('Preview permite la muestra y puede comprobar el modo sin demo', () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('AULIFY_DEMO_ENABLED', 'true');
  expect(isDemoEnabled()).toBe(true);
  vi.stubEnv('AULIFY_DEMO_ENABLED', 'false');
  expect(isDemoEnabled()).toBe(false);
});
