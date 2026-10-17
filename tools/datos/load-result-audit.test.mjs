import assert from 'node:assert/strict';
import test from 'node:test';
import { auditPublishedResults } from './load-result-audit.mjs';
import { loadCriteria } from './load-criteria.mjs';

test('Conserva el fallo de lectura sin perder las otras 199 comprobaciones', async () => {
  let called = 0;
  const result = await auditPublishedResults(Array.from({length:200},(_,i)=>i), async i => {
    called++;
    if (i === 0) throw Object.assign(new Error('HTTP_503'), {status:503, category:'transport_timeout'});
    return true;
  });
  assert.equal(called, 200);
  assert.equal(result.latencies.length, 199);
  assert.equal(result.unobservedResults, 1);
  assert.deepEqual(result.failures, [{status:503, category:'transport_timeout', count:1}]);
  assert.equal(loadCriteria({observedResultSamples:result.latencies.length,unobservedResults:result.unobservedResults}).publishedResults, false);
});

test('Una nota ausente sigue sin aprobar; los errores de autorización detienen la auditoría', async () => {
  const result = await auditPublishedResults([1,2], async i => i === 1);
  assert.equal(result.unobservedResults, 1);
  await assert.rejects(auditPublishedResults([1,2], async () => {
    throw Object.assign(new Error('HTTP_403'), {status:403});
  }), /HTTP_403/);
});
