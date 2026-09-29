import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rpcFailureCategory, transportFailureCategory } from './load-failure-category.mjs';

test('solo conserva categorías RPC enumeradas', () => {
  for (const category of ['transport', 'transport_timeout', 'database_timeout',
    'database_cancelled', 'transaction_contention', 'service_unavailable',
    'internal', 'validation', 'forbidden', 'unauthorized']) {
    assert.equal(rpcFailureCategory(new Headers({ 'X-Aulify-Rpc-Failure': category })), category);
  }
  for (const value of ['SQL secreto JWT example', 'transport timeout', 'Transport', 'PGRST003', '']) {
    assert.equal(rpcFailureCategory(new Headers({ 'X-Aulify-Rpc-Failure': value })), 'unclassified');
  }
  assert.equal(rpcFailureCategory(new Headers()), 'unclassified');
});

test('no guarda nombres o mensajes arbitrarios de errores del generador', () => {
  assert.equal(transportFailureCategory({ name: 'TimeoutError', message: 'SQL secreto' }), 'client_timeout');
  assert.equal(transportFailureCategory({ name: 'AbortError' }), 'client_aborted');
  assert.equal(transportFailureCategory({ name: 'JWT secreto', message: 'SQL secreto' }), 'client_transport');
  assert.equal(transportFailureCategory(null), 'client_transport');
});
