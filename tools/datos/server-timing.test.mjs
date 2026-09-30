import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serverTiming } from './server-timing.mjs';

test('conserva sólo duraciones numéricas de las tres etapas', () => {
  assert.deepEqual(serverTiming('prepare;dur=4.00, rpc;dur=521.27, encode;dur=0.45'), {
    prepare: 4, rpc: 521.27, encode: 0.45,
  });
  assert.equal(serverTiming(null), undefined);
  assert.equal(serverTiming('token;desc="privado", rpc;dur=NaN, prepare;dur=-1'), undefined);
  assert.deepEqual(serverTiming('rpc;dur=24, encode;dur=1;desc="privado"'), { rpc: 24 });
});
