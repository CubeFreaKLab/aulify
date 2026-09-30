import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { parallel } from './load-workers.mjs';
const base = 'http://127.0.0.1:3001';
const accounts = JSON.parse(await fs.readFile('.local-private/load-accounts.json', 'utf8'));
const sessions = JSON.parse(await fs.readFile('.local-private/load-http-sessions.json', 'utf8'));
const buildId = (await fs.readFile('.next/BUILD_ID', 'utf8')).trim();
const report = {
  startedAt: new Date().toISOString(),
  scope:
    'Regresión de apertura de resultados: lectura HTTP, 200 cuentas existentes, concurrencia 8; sin escrituras ni Q-06/Q-09.',
  buildId,
  checks: [],
  samples: [],
  failures: [],
  bytes: 0,
};
assert.equal(accounts.projectRef, 'bnqyyumfmyexsqszglab');
assert.ok((await (await fetch(base)).text()).includes(buildId));
const users = accounts.users.filter((x) => x.role === 'student');
assert.equal(users.length, 200);
await parallel(users, 8, async (user) => {
  const start = performance.now();
  try {
    const r = await fetch(base + '/api/workspace', {
      headers: {
        Cookie: Object.entries(sessions[user.id].cookies)
          .map(([k, v]) => k + '=' + v)
          .join('; '),
      },
      signal: AbortSignal.timeout(15000),
    });
    const txt = await r.text();
    report.bytes += Buffer.byteLength(txt);
    if (!r.ok)
      throw new Error('HTTP ' + r.status + ' ' + (r.headers.get('X-Aulify-Rpc-Failure') || ''));
    const body = JSON.parse(txt);
    assert.equal(body.userId, user.id);
    assert.deepEqual(body.studentActivities, {});
    assert.ok(body.state.activities.length > 0);
    for (const a of body.state.activities) assert.equal(body.activityQuestionCounts[a.id], 10);
    assert.ok(
      Object.values(body.studentResults)
        .flat()
        .some((x) => x.status === 'published' && x.grade === 100),
    );
    const durationMs = performance.now() - start;
    report.samples.push({ durationMs, serverTiming: r.headers.get('Server-Timing') });
  } catch (error) {
    report.failures.push({ type: error.name, message: error.message });
  }
});
const times = report.samples.map((x) => x.durationMs).sort((a, b) => a - b);
report.summary = {
  success: times.length,
  failed: report.failures.length,
  p50: times[Math.ceil(times.length * 0.5) - 1],
  p95: times[Math.ceil(times.length * 0.95) - 1],
  max: times.at(-1),
};
report.finishedAt = new Date().toISOString();
report.passed = times.length === 200 && report.failures.length === 0;
await fs.writeFile(
  'docs/verificacion/datos-resumen-aula-http.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    summary: report.summary,
    failures: report.failures.slice(0, 3),
    bytes: report.bytes,
  }),
);
if (!report.passed) process.exitCode = 1;
