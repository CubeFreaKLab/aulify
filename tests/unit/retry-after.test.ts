import { describe, expect, it } from 'vitest';
import { retryAfterDeadline } from '../../src/lib/retry-after';

describe('pausa indicada por el servidor', () => {
  const now = Date.parse('2026-09-28T12:00:00Z');
  it('interpreta segundos y fechas HTTP', () => {
    expect(retryAfterDeadline('30', now)).toBe(now + 30_000);
    expect(retryAfterDeadline('Mon, 28 Sep 2026 12:00:30 GMT', now)).toBe(now + 30_000);
  });
  it('no impone esperas por cabeceras vacías, inválidas o vencidas', () => {
    for (const value of [null, '', 'nada', 'Mon, 28 Sep 2026 11:00:00 GMT']) {
      expect(retryAfterDeadline(value, now)).toBe(0);
    }
  });
});
