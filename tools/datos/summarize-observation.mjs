import fs from 'node:fs/promises';

const [httpPath, sqlPath, clocksPath] = process.argv.slice(2);
if (!httpPath || !sqlPath || !clocksPath) throw new Error('Uso: node tools/datos/summarize-observation.mjs HTTP.json SQL.json RELOJES.json');
const http = JSON.parse(await fs.readFile(httpPath, 'utf8'));
const sql = JSON.parse(await fs.readFile(sqlPath, 'utf8'));
const clocks = JSON.parse(await fs.readFile(clocksPath, 'utf8'));
const lower = Math.max(...clocks.samples.map(x => x.offsetLowerBoundMs));
const upper = Math.min(...clocks.samples.map(x => x.offsetUpperBoundMs));
if (lower > upper) throw new Error('Las muestras de reloj no permiten un intervalo común');
const start = Date.parse(http.measurementStartedAt), end = Date.parse(http.measurementEndedAt);
const definiteOverlap = sql.samples.filter(s => Date.parse(s.at) >= start + upper && Date.parse(s.at) <= end + lower);
const possibleOverlap = sql.samples.filter(s => Date.parse(s.at) >= start + lower && Date.parse(s.at) <= end + upper);
const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1] : null;
const groups = {};
for (const s of definiteOverlap) {
  for (const g of s.data.sessions) {
    const key = [g.rpc, g.state, g.wait_type, g.wait_event].join('/');
    const item = groups[key] ||= { observedSamples: 0, sessionSamples: 0, maxSimultaneousSessions: 0, blockedSessionSamples: 0, maxBlocked: 0, longestActiveMs: null };
    item.observedSamples++; item.sessionSamples += g.sessions; item.maxSimultaneousSessions = Math.max(item.maxSimultaneousSessions, g.sessions);
    item.blockedSessionSamples += g.blocked; item.maxBlocked = Math.max(item.maxBlocked, g.blocked);
    if (g.longest_active_ms !== null) item.longestActiveMs = Math.max(item.longestActiveMs || 0, g.longest_active_ms);
  }
}
const peakCounterCommands = {};
const freshCounterLocks = sql.observer_version >= 2;
for (const key of ['active', 'blocked', 'transactionid_wait', 'tuple_wait', 'active_without_wait']) peakCounterCommands[key] = definiteOverlap.length && freshCounterLocks ? Math.max(0, ...definiteOverlap.map(s => s.data.commands_with_counter_write_lock[key])) : null;
const counterWriters = {}, relationLocks = {};
if (freshCounterLocks) for (const sample of definiteOverlap) {
  for (const writer of sample.data.writers_with_counter_write_lock || []) {
    const row = counterWriters[writer.rpc] ||= { observedSamples: 0, peakActive: 0, peakBlocked: 0, peakTransactionidWait: 0, peakTupleWait: 0 };
    row.observedSamples++; row.peakActive = Math.max(row.peakActive, writer.active); row.peakBlocked = Math.max(row.peakBlocked, writer.blocked);
    row.peakTransactionidWait = Math.max(row.peakTransactionidWait, writer.transactionid_wait); row.peakTupleWait = Math.max(row.peakTupleWait, writer.tuple_wait);
  }
  for (const lock of sample.data.counter_relation_locks) {
    const key = [lock.locktype, lock.mode, lock.granted].join('/'), row = relationLocks[key] ||= { observedSamples: 0, peakLocks: 0 };
    row.observedSamples++; row.peakLocks = Math.max(row.peakLocks, lock.locks);
  }
}
const stages = {};
for (const stage of ['sync', 'snapshot', 'answer']) {
  const rows = http.records.filter(r => r.measured && r.stage === stage);
  stages[stage] = { requests: rows.length, failures: rows.filter(r => r.status < 200 || r.status >= 300).length, p95Ms: percentile(rows.map(r => r.ms), 0.95) };
}
const summary = {
  source: { httpPath, sqlPath, clocksPath },
  scope: 'Diagnóstico puntual; las muestras de sesiones no son conteos de solicitudes únicas. active_without_wait no mide CPU.',
  calibration: { offsetLowerBoundMs: lower, offsetUpperBoundMs: upper, caveat: 'Calibración posterior, supone desfase estable durante estas ventanas cercanas.' },
  httpWindow: { start: http.measurementStartedAt, end: http.measurementEndedAt },
  sqlWindow: { start: sql.samples[0].at, end: sql.samples.at(-1).at },
  overlap: { definiteSamples: definiteOverlap.length, possibleSamples: possibleOverlap.length, totalSamples: sql.samples.length },
  validity: { activity: true, counterLocks: freshCounterLocks, limitation: freshCounterLocks ? null : 'Observador v1 reutiliza pg_locks: sus bloqueos de relación no sirven para inferencias. Actividad sí varía.' },
  burst: http.burst, integrity: http.integrity, stages, peakCounterCommands, counterWriters, relationLocks, groups,
};
const path = httpPath.replace(/\.json$/, '-resumen.json');
await fs.writeFile(path, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ path, ...summary }));
