import { performance } from 'node:perf_hooks';
import { parallel } from './load-workers.mjs';

export const temporaryLoadFailure = error =>
  [429, 500, 502, 503, 504].includes(error.status) ||
  ['TypeError', 'TimeoutError', 'AbortError'].includes(error.name);

// Una lectura temporalmente fallida cuenta como resultado ausente. No impedir
// obtener los demás datos del ensayo; los 200 resultados siguen siendo obligatorios.
export async function auditPublishedResults(students, readAndCheck) {
  const latencies = [], failures = new Map();
  let unobservedResults = 0;
  await parallel(students, 8, async student => {
    const started = performance.now();
    try {
      if (!await readAndCheck(student)) unobservedResults++;
      latencies.push(performance.now() - started);
    } catch (error) {
      if (!temporaryLoadFailure(error)) throw error;
      unobservedResults++;
      const key = `${error.status || 0}:${error.category || error.name}`;
      const previous = failures.get(key) || { status: error.status || 0, category: error.category || error.name, count: 0 };
      previous.count++;
      failures.set(key, previous);
    }
  });
  return { latencies, unobservedResults, failures: [...failures.values()] };
}
