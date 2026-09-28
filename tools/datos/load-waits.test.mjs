import test from 'node:test';
import assert from 'node:assert/strict';
import { retryAfterMs } from './load-waits.mjs';

test('espera de servicio prevalece sobre backoff de ocho segundos', () => {
  assert.equal(Math.max(8000, retryAfterMs('30')), 30000);
});
test('respeta fecha HTTP futura sin renovaciones prematuras', () => {
  const now = Date.parse('2026-09-28T13:00:00Z');
  assert.equal(retryAfterMs('Mon, 28 Sep 2026 13:02:00 GMT', now), 120000);
});
test('fecha pasada o cabecera ausente deja actuar al backoff', () => {
  const now = Date.parse('2026-09-28T13:00:00Z');
  assert.equal(retryAfterMs('Mon, 28 Sep 2026 12:59:00 GMT', now), 0);
  assert.equal(retryAfterMs(null, now), 0);
  assert.equal(retryAfterMs('incorrecto', now), 0);
});
