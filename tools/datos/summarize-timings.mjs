import fs from 'node:fs/promises';

const source = process.argv[2];
if (!source) throw new Error('Indicar el registro del diagnóstico.');
const raw = JSON.parse(await fs.readFile(source, 'utf8'));
const percentile95 = (values) => values.length
  ? values.toSorted((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] : null;
const summary = {
  source, buildId: raw.buildId, commit: raw.commit,
  window: { start: raw.measurementStartedAt, end: raw.measurementEndedAt },
  milliseconds: {},
  limitations: [
    'Tiempos de solicitudes correctas con las tres etapas instrumentadas.',
    'RPC incluye transporte y servicio; no representa exclusivamente SQL.',
    'Fuera del handler se calcula por solicitud, no por resta entre percentiles.',
    'Los percentiles de etapas pueden pertenecer a solicitudes distintas y no se suman.',
  ],
};
for (const stage of ['sync', 'snapshot', 'answer']) {
  const requests = raw.records.filter((r) => r.measurement && r.stage === stage);
  const measured = requests.filter((r) => r.status === 200 &&
    ['prepare', 'rpc', 'encode'].every((key) => Number.isFinite(r.serverTiming?.[key])));
  const stages = Object.fromEntries(['prepare', 'rpc', 'encode'].map((key) =>
    [key, percentile95(measured.map((r) => r.serverTiming[key]))]));
  summary.milliseconds[stage] = {
    requests: requests.length, measured: measured.length,
    p95Http: percentile95(measured.map((r) => r.ms)), p95Stages: stages,
    p95OutsideHandler: percentile95(measured.map((r) =>
      r.ms - r.serverTiming.prepare - r.serverTiming.rpc - r.serverTiming.encode)),
    slowest: measured.toSorted((a, b) => b.ms - a.ms).slice(0, 3)
      .map((r) => ({ startedAt: r.startedAt, httpMs: r.ms, serverTiming: r.serverTiming })),
  };
}
const output = process.argv[3];
if (output) await fs.writeFile(output, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
