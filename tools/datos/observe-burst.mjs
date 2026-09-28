import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { retryAfterMs } from './load-waits.mjs';

const base = 'http://127.0.0.1:3002';
const accounts = JSON.parse(await fs.readFile('.local-private/load-accounts.json', 'utf8'));
const fixtures = JSON.parse(await fs.readFile('.local-private/load-fixtures.json', 'utf8'));
const previous = JSON.parse(await fs.readFile('.local-private/protocol-confirmed.json', 'utf8'));
const cookies = JSON.parse(await fs.readFile('.local-private/load-http-sessions.json', 'utf8'));
const questionIndex = Number(process.env.AULIFY_OBSERVE_QUESTION_INDEX || 2);
if (!Number.isInteger(questionIndex) || questionIndex < 1 || questionIndex > 9) throw new Error('Índice de pregunta inválido');
if (accounts.projectRef !== 'bnqyyumfmyexsqszglab' || accounts.users.length !== 204 || previous.acks.length !== 200 || previous.activities.length !== 4) throw new Error('Escenario inesperado');
const runId = crypto.randomUUID();
const report = { runId, startedAt: new Date().toISOString(), buildId: (await fs.readFile('.next/BUILD_ID', 'utf8')).trim(), scope: 'Diagnóstico coordinado de bloqueos: 204 lectores y 200 respuestas; no es Q-06.', questionNumber: questionIndex + 1, records: [], status: 'preparing' };
if (report.buildId !== '76aWxJ8Ymu77wqTlNGlZJ') throw new Error('Compilado no autorizado');
const sessions = accounts.users.map(a => ({ ...a, jar: new Map(Object.entries(cookies[a.id]?.cookies || {})), activityId: previous.activities[a.group], revision: null, running: null, retryMs: 1000, retryAt: 0 }));
const teachers = sessions.filter(s => s.role === 'teacher'), students = sessions.filter(s => s.role === 'student');
let observing = false, cutoff = false, bytes = 0, timers = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const parallel = async (values, count, callback) => { let index = 0; await Promise.all(Array.from({ length: count }, async () => { while (index < values.length) { const next = index++; await callback(values[next]); } })); };
const request = async (s, path, body, stage) => {
  const started = performance.now(), measured = observing;
  try {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Cookie: [...s.jar].map(([k, v]) => `${k}=${v}`).join('; '), Origin: base, 'Sec-Fetch-Site': 'same-origin', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    for (const header of response.headers.getSetCookie()) { const pair = header.split(';', 1)[0], i = pair.indexOf('='); if (pair.slice(i + 1)) s.jar.set(pair.slice(0, i), pair.slice(i + 1)); else s.jar.delete(pair.slice(0, i)); }
    const text = await response.text(); bytes += Buffer.byteLength(text);
    report.records.push({ stage, measured, status: response.status, ms: performance.now() - started, bytes: Buffer.byteLength(text) });
    if (bytes * 2 + 1024 * report.records.length > 1e9) cutoff = true;
    return response.ok ? { data: JSON.parse(text) } : { error: response.status, retryAfter: retryAfterMs(response.headers.get('Retry-After')) };
  } catch (error) { report.records.push({ stage, measured, status: 0, error: error.name, ms: performance.now() - started }); return { error: error.name }; }
};
const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1] : null;
try {
  for (const teacher of teachers) {
    const r = await request(teacher, `/api/workspace?activity=${teacher.activityId}`, undefined, 'prepare');
    if (r.error) throw new Error(`Preparación docente HTTP ${r.error}`);
    for (const student of students.filter(s => s.group === teacher.group)) {
      const attempt = r.data.state.attempts.find(a => a.studentId === student.id);
      if (!attempt || attempt.answers.length !== questionIndex || attempt.status !== 'in-progress') throw new Error('El intento no conserva exactamente las respuestas anteriores esperadas');
      student.attemptId = attempt.id;
    }
  }
  await parallel(sessions, 20, async s => { const r = await request(s, `/api/sync?activity=${s.activityId}`, undefined, 'prepare'); if (r.error) throw new Error(`Preparación sync ${r.error}`); s.revision = r.data.revision; });
  const ready = { runId, readyAt: new Date().toISOString(), sessions: sessions.length, buildId: report.buildId };
  await fs.writeFile('.local-private/observe-counter-ready.json', JSON.stringify(ready));
  console.log('READY: consulta SQL preparada; escribir la señal después de pulsar Run.');
  const waitingSince = Date.now(); let authorized = false;
  while (Date.now() - waitingSince < 600000) {
    try { authorized = JSON.parse(await fs.readFile('.local-private/observe-counter-gate.json', 'utf8')).runId === runId; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (authorized) break;
    await delay(100);
  }
  if (!authorized) throw new Error('No llegó señal de coordinación; no se ejecutó ráfaga');
  if ((await fs.readFile('.next/BUILD_ID', 'utf8')).trim() !== report.buildId) throw new Error('Compilado cambió durante preparación');
  report.measurementStartedAt = new Date().toISOString(); observing = true; const began = performance.now();
  console.log(`OBSERVACIÓN INICIADA ${report.measurementStartedAt}`);
  const poll = s => {
    if (s.running || cutoff || performance.now() >= began + 12000 || Date.now() < s.retryAt) return;
    s.running = (async () => {
      let r = await request(s, `/api/sync?activity=${s.activityId}`, undefined, 'sync'); const revision = r.data?.revision;
      if (!r.error && revision !== s.revision) { r = await request(s, `/api/workspace?activity=${s.activityId}`, undefined, 'snapshot'); if (!r.error) s.revision = revision; }
      if (r.error) { s.retryAt = Date.now() + Math.max(s.retryMs, r.retryAfter || 0); s.retryMs = Math.min(8000, s.retryMs * 2); } else { s.retryAt = 0; s.retryMs = 1000; }
    })().finally(() => s.running = null);
  };
  sessions.forEach((s, i) => timers.push(setTimeout(() => { poll(s); timers.push(setInterval(() => poll(s), 1000)); }, i * 1000 / 204)));
  await delay(Math.max(0, began + 2000 - performance.now()));
  const acks = [], dispatches = [];
  await Promise.all(students.map(async (s, index) => {
    await delay(Math.max(0, began + 2000 + index * 1900 / 200 - performance.now()));
    if (cutoff) return;
    const q = fixtures.groups.find(g => g.group === s.group).questions[questionIndex], key = crypto.randomUUID();
    dispatches.push(performance.now()); const start = performance.now();
    const result = await request(s, '/api/commands', { action: 'submitAnswer', args: [s.attemptId, q.id, { type: 'single', optionId: q.correctOptionId }, key, false] }, 'answer');
    if (result.data?.result?.attempt?.answers?.some(a => a.idempotencyKey === key)) acks.push({ attemptId: s.attemptId, questionId: q.id, key, ms: performance.now() - start });
  }));
  report.burst = { target: 200, dispatched: dispatches.length, windowMs: Math.max(...dispatches) - Math.min(...dispatches), confirmed: acks.length, confirmationP95Ms: percentile(acks.map(a => a.ms), 0.95) };
  await delay(Math.max(0, began + 12000 - performance.now())); timers.forEach(clearTimeout); await Promise.allSettled(sessions.map(s => s.running)); observing = false; report.measurementEndedAt = new Date().toISOString();
  const persisted = new Map();
  for (const teacher of teachers) { const r = await request(teacher, `/api/workspace?activity=${teacher.activityId}`, undefined, 'audit'); if (r.error) throw new Error('Auditoría incompleta'); for (const t of r.data.state.attempts) for (const a of t.answers) persisted.set(`${t.id}:${a.questionId}`, a.idempotencyKey); }
  report.integrity = { confirmed: acks.length, missingOrChangedConfirmed: acks.filter(a => persisted.get(`${a.attemptId}:${a.questionId}`) !== a.key).length };
  report.status = cutoff ? 'cutoff' : 'completed';
} catch (error) { report.status = 'failed'; report.failure = error.message; process.exitCode = 1; }
finally {
  timers.forEach(clearTimeout);
  for (const s of sessions) cookies[s.id] = { cookies: Object.fromEntries(s.jar), savedAt: new Date().toISOString() };
  await fs.writeFile('.local-private/load-http-sessions.json', JSON.stringify(cookies));
  report.completedAt = new Date().toISOString(); report.observedBodyBytes = bytes; report.conservativeEstimatedBytes = 2 * bytes + 1024 * report.records.length;
  const path = `docs/verificacion/datos-observacion-rafaga-${report.startedAt.replace(/[^0-9]/g, '').slice(0, 14)}.json`;
  await fs.writeFile(path, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ path, status: report.status, burst: report.burst, integrity: report.integrity, failure: report.failure }));
}
