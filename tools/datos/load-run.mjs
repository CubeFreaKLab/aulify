import fs from 'node:fs/promises';
import { retryAfterMs } from './load-waits.mjs';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';

const base = process.env.AULIFY_LOAD_URL || 'http://127.0.0.1:3002';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('La prueba se limita al servidor local autorizado.');
const accounts = JSON.parse(await fs.readFile('.local-private/load-accounts.json', 'utf8'));
const fixtures = JSON.parse(await fs.readFile('.local-private/load-fixtures.json', 'utf8'));
if (accounts.projectRef !== 'bnqyyumfmyexsqszglab' || fixtures.projectRef !== accounts.projectRef || accounts.users.length !== 204 || fixtures.groups.length !== 4 || fixtures.groups.some(g => g.students.length !== 50 || g.questions.length !== 10)) throw new Error('Preparación incompleta o proyecto incorrecto.');
const privatePath = '.local-private/load-http-sessions.json';
const reportPath = 'docs/verificacion/datos-carga.json';
const runId = crypto.randomUUID();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { runId, startedAt: new Date().toISOString(), status: 'preparing', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), compiledCommit: process.env.AULIFY_COMPILED_COMMIT || undefined, buildId: (await fs.readFile('.next/BUILD_ID','utf8')).trim(), environment: { application: 'Next.js production local HTTP', base, database: 'Supabase Free, PostgreSQL 17, sa-east-1', generator: { node: process.version, os: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() }, activeSessions: 204, teachers: 4, students: 200, studentsPerClass: 50, questionsPerActivity: 10, pollingMs: 1000, polling: 'GET /api/sync; GET /api/workspace?activity=UUID solo cuando cambia la huella; reintento 1/2/4/8 s ante fallo sin snapshot adicional', warmupSeconds: 300, measurementSeconds: 900, logicalBodyBudgetBytes: 1_000_000_000 }, phases: [], authentication: { rateLimitWaits: 0, preparedSessions: 0 }, limitations: ['El generador simula el protocolo HTTP de la aplicación; no ejecuta 204 navegadores ni mide dibujo de pantalla.', 'La aplicación está en una computadora local, no en el alojamiento público.', 'Los bytes JSON descomprimidos y una estimación conservadora no sustituyen el contador facturable de Supabase, que tiene retraso.', 'La preparación y el inicio de sesión quedan fuera de los quince minutos de medición. No se envían correos ni se habilitan pagos.'] };
report.environment.confirmation = 'ACK después de persistir, con Attempt autorizado aplicado al estado del cliente. La auditoría posterior contrasta cada clave; no se espera un snapshot redundante para avanzar.';
report.environment.retryPolicy = { initialMs: 1000, maximumBackoffMs: 8000, respectsRetryAfter: true };
report.sourceDiffSha256 = crypto.createHash('sha256').update(execFileSync('git',['diff','HEAD','--','src','package.json','package-lock.json','next.config.ts','tsconfig.json'],{encoding:'utf8'})).digest('hex');
report.previousReport = 'datos-carga-20260928-0811.md';
report.environment.fixtureHistory = 'Las cuentas conservan el calentamiento fallido previo; el primer grupo conserva además las actividades cerradas de las pruebas de concurrencia guiada. No se borró ese historial para reducir el costo de lectura.';
let cached = {};
try { cached = JSON.parse(await fs.readFile(privatePath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const sessions = accounts.users.map(a => ({ ...a, jar: new Map(Object.entries(cached[a.id]?.cookies || {})), lastRevision: null, activityId: null, attemptId: null, latest: null, refresh: null, running: null, wanted: null, retryAt: 0, retryMs: 1000, authorizationLost: false, mutationEpoch: 0 }));
const teachers = sessions.filter(s => s.role === 'teacher'), students = sessions.filter(s => s.role === 'student');
let phase = null, abortReason = '', bodyBytes = 0, totalRequests = 0, aborted = false;
const recent = [], loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();
const persist = async () => {
  for (const p of report.phases) if (p.confirmed instanceof Map) await fs.writeFile(`.local-private/load-confirmed-${runId}-${p.name}.json`, JSON.stringify({runId,phase:p.name,savedAt:new Date().toISOString(),keys:[...p.confirmed]}));
  return fs.writeFile(reportPath, JSON.stringify({ ...report, observedApplicationBodyBytes: bodyBytes, totalRequests, conservativeEstimatedBytes: bodyBytes * 2 + totalRequests * 1024, interruptedReason: abortReason || undefined }, null, 2) + '\n');
};
const saveCookies = async () => fs.writeFile(privatePath, JSON.stringify(Object.fromEntries(sessions.map(s => [s.id, { cookies: Object.fromEntries(s.jar), savedAt: new Date().toISOString() }]))) + '\n');
function setCookies(s, response) { for (const header of response.headers.getSetCookie()) { const pair = header.split(';', 1)[0], i = pair.indexOf('='); if (pair.slice(i + 1)) s.jar.set(pair.slice(0, i), pair.slice(i + 1)); else s.jar.delete(pair.slice(0, i)); } }
function record(target, tag, status, ms, bytes) {
  totalRequests++; bodyBytes += bytes;
  if (!target) return;
  const operation = target.operations[tag] ||= { count: 0, failed: 0, latencies: [], statuses: {} };
  operation.count++; operation.latencies.push(ms); operation.statuses[status] = (operation.statuses[status] || 0) + 1;
  target.requestCount++; if (status < 200 || status >= 300) { operation.failed++; target.failedRequests++; }
  target.bodyBytes += bytes;
  recent.push({ at: Date.now(), failed: status < 200 || status >= 300 });
}
async function request(s, route, { method = 'GET', body, tag = route, metric = true } = {}) {
  if (aborted && metric) throw new Error('LOAD_ABORTED');
  const start = performance.now(), target = metric ? phase : null;
  try {
    const response = await fetch(base + route, { method, headers: { Cookie: [...s.jar].map(([k, v]) => `${k}=${v}`).join('; '), Origin: base, 'Sec-Fetch-Site': 'same-origin', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000) });
    setCookies(s, response); const text = await response.text();
    record(target, tag, response.status, performance.now() - start, Buffer.byteLength(text));
    if (!response.ok) { const error = new Error(`HTTP_${response.status}`); error.recorded = true; error.status = response.status; error.retryAfterMs = retryAfterMs(response.headers.get('Retry-After')); throw error; }
    return { value: JSON.parse(text), elapsed: performance.now() - start };
  } catch (error) { if (!error.recorded) record(target, tag, 0, performance.now() - start, 0); throw error; }
}
const command = async (s, action, ...args) => (await request(s, '/api/commands', { method: 'POST', body: { action, args }, tag: action })).value.result;
async function parallel(items, limit, callback) { let index = 0; await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (index < items.length) { const i = index++; await callback(items[i], i); } })); }
function needsTokenRefresh(s){try{let v=[...s.jar].filter(([k])=>k.includes('auth-token')).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v).join('');v=decodeURIComponent(v);if(v.startsWith('base64-'))v=Buffer.from(v.slice(7),'base64url').toString();return(JSON.parse(v).expires_at??0)*1000<Date.now()+90000;}catch{return true;}}
async function prepareSessions() {
  let previousRenewal=0;
  for (const [index, s] of sessions.entries()) {
    let ready = false;
    if (s.jar.size) { if(needsTokenRefresh(s)){await delay(Math.max(0,2500-(Date.now()-previousRenewal)));previousRenewal=Date.now();} try { await request(s, '/api/workspace', { metric: false }); ready = true; } catch(error) {if(error.status===503||error.status===429){console.log('Auth temporalmente no disponible durante preparación; espera de 60 segundos.');report.authentication.rateLimitWaits++;await delay(Math.max(60000,error.retryAfterMs||0));await request(s, '/api/workspace', {metric:false});ready=true;}else s.jar.clear();} }
    if (!ready) {
      for (let retry = 0; retry < 10; retry++) {
        try { await request(s, '/api/auth', { method: 'POST', metric: false, body: { action: 'access', email: s.email, password: s.password } }); ready = true; break; }
        catch (error) { if (error.status !== 429) throw new Error(`No se pudo preparar sesión ficticia ${index + 1}.`); report.authentication.rateLimitWaits++; console.log('Auth solicita esperar: pausa de 60 segundos.'); await delay(Math.max(60_000,error.retryAfterMs||0)); }
      }
      await delay(2500);
    }
    if (!ready) throw new Error('Auth mantuvo el límite de frecuencia. No se inició la carga.');
    report.authentication.preparedSessions++;
    await saveCookies();
    if ((index + 1) % 25 === 0 || index === 203) console.log(`Sesiones HTTP preparadas: ${index + 1}/204`);
  }
}
function observe(s, value, target) {
  s.latest = value;
  if (!s.wanted || !target || s.wanted.phase !== target.name) return;
  const activity = value.studentActivities?.[s.activityId]?.activity;
  if (activity?.guided?.questionIndex === s.wanted.index && activity.guided.questionOpen) {
    target.propagationMs.push(performance.now() - s.wanted.started);
    s.wanted = null;
  }
}
async function refresh(s, tag = 'snapshot') {
  if (s.refresh) return s.refresh;
  const target = phase, epoch = s.mutationEpoch;
  s.refresh = request(s, tag==='publishedResults' ? '/api/workspace' : `/api/workspace?activity=${s.activityId}`, { tag }).then(result => { if(s.mutationEpoch===epoch)observe(s, result.value, target); return s.latest ?? result.value; }).finally(() => { s.refresh = null; });
  return s.refresh;
}
function startPolling() {
  const timers = [];
  const poll = s => {
    if (s.running || aborted || s.authorizationLost || Date.now() < s.retryAt) { if (phase) phase.skippedPollTicks++; return; }
    s.running = (async () => {
      try {
        const result = (await request(s, `/api/sync?activity=${s.activityId}`, { tag: 'sync' })).value;
        if (s.lastRevision !== result.revision) { await refresh(s); s.lastRevision = result.revision; }
        s.retryAt=0;s.retryMs=1000;
      } catch (error) {
        if (error.status===401 || error.status===403) {
          s.latest=null;s.lastRevision=null;s.authorizationLost=true;
          if(error.status===403&&!aborted)try{await refresh(s);}catch{/* La única comprobación adicional también queda medida. */}
        }
        s.retryAt=Date.now()+Math.max(s.retryMs,error.retryAfterMs||0);s.retryMs=Math.min(8000,s.retryMs*2);
      }
    })().finally(() => { s.running = null; });
  };
  sessions.forEach((s, i) => {
    timers.push(setTimeout(() => { poll(s); timers.push(setInterval(() => poll(s), 1000)); }, i * 1000 / 204));
  });
  return async () => { timers.forEach(clearTimeout); await Promise.allSettled(sessions.map(s => s.running || Promise.resolve())); };
}
async function until(target) { while (Date.now() < target) { if (aborted) throw new Error('LOAD_ABORTED'); await delay(Math.min(1000, target - Date.now())); } }
const percentile = (values, p) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)].toFixed(2)); };
function summarize(current) {
  current.successfulAcknowledgementSamples = current.responseAckMs.length;
  current.observedConfirmationSamples = current.confirmationMs.length;
  current.observedPropagationSamples = current.propagationMs.length;
  current.confirmationP95Ms = percentile(current.confirmationMs, 0.95);
  current.responseAckP95Ms = percentile(current.responseAckMs, 0.95);
  current.propagationP95Ms = percentile(current.propagationMs, 0.95);
  current.failureRate = current.requestCount ? current.failedRequests / current.requestCount : null;
  current.operations = Object.fromEntries(Object.entries(current.operations).map(([k, v]) => [k, { count: v.count, failed: v.failed, p50Ms: percentile(v.latencies, 0.5), p95Ms: percentile(v.latencies, 0.95), maxMs: Math.round(v.latencies.reduce((maximum,value)=>Math.max(maximum,value),0)), statuses: v.statuses }]));
  delete current.confirmationMs; delete current.responseAckMs; delete current.propagationMs;
}
async function makeActivities(mode, stage) {
  const settings = { purpose: 'practice', pace: mode, maxGrade: 100, weight: 1, countsTowardAverage: true, maxAttempts: 1, opensAt: new Date(Date.now() - 60_000).toISOString(), closesAt: new Date(Date.now() + 4 * 3_600_000).toISOString(), timeLimitMinutes: null, timeZone: 'America/La_Paz', feedback: 'immediate', manualCorrection: false, shuffleQuestions: false, shuffleOptions: false, streaks: false, sound: false, ranking: false, teams: false, allowHint: false, allowDouble: false, bonusAffectsGrade: false, reportVisibility: false };
  for (const teacher of teachers) {
    const group = fixtures.groups.find(g => g.group === teacher.group);
    const activity = await command(teacher, 'createActivity', group.versionId, group.subjectId, settings, `Carga ${mode} · ${stage} · ${runId.slice(0, 8)}`);
    for (const s of sessions.filter(s => s.group === teacher.group)) { s.activityId = activity.id; s.lastRevision = null; s.latest = null; s.wanted = null; s.retryAt=0; s.retryMs=1000;s.authorizationLost=false; }
  }
  await parallel(students, 6, async s => {
    if (mode === 'guided') await command(s, 'joinGuidedRoom', s.activityId);
    else s.attemptId = (await command(s, 'startAttempt', s.activityId)).id;
  });
}
async function answer(s, index, current) {
  const group = fixtures.groups.find(g => g.group === s.group), question = group.questions[index];
  const key = crypto.randomUUID();
  if (current.mode === 'guided') {
    const waitStart = Date.now();
    while (!(s.latest?.studentActivities?.[s.activityId]?.activity.guided?.questionIndex === index && s.latest.studentActivities[s.activityId].activity.guided.questionOpen)) {
      if (aborted || Date.now() - waitStart > 20_000) { current.unsentAnswers++; return; }
      await delay(100);
    }
    s.attemptId = s.latest.studentActivities[s.activityId].attempt?.id;
    if (!s.attemptId) { current.unsentAnswers++; return; }
  }
  const started = performance.now();
  for (let retry = 0; retry < 3; retry++) {
    try {
      const result = await command(s, 'submitAnswer', s.attemptId, question.id, { type: 'single', optionId: question.correctOptionId }, key, false);
      if (!result.attempt.answers.some(a => a.questionId === question.id && a.idempotencyKey === key)) throw new Error('CONFIRMATION_MISSING');
      if (!current.confirmed.has(`${s.attemptId}:${question.id}`)) current.responseAckMs.push(performance.now() - started);
      current.confirmed.set(`${s.attemptId}:${question.id}`, key);
      // El comando responde después del COMMIT y aporta el intento autorizado.
      // Aplicarlo reproduce el avance inmediato del cliente; las lecturas antiguas no lo revierten.
      s.mutationEpoch++;
      if(s.latest){
        s.latest.state.attempts=s.latest.state.attempts.filter(a=>a.id!==s.attemptId).concat(result.attempt);
        if(s.latest.studentActivities?.[s.activityId])s.latest.studentActivities[s.activityId].attempt=result.attempt;
      }
      current.confirmationMs.push(performance.now() - started);
      return;
    } catch { if (aborted) return; if (retry === 2) { if(current.confirmed.has(`${s.attemptId}:${question.id}`))current.unobservedConfirmations++;else current.unconfirmedAnswers++; return; } await delay(300); }
  }
}
async function auditIntegrity(current) {
  const persisted = new Map(); let duplicates = 0;
  for (const teacher of teachers) {
    const view = (await request(teacher, `/api/workspace?activity=${teacher.activityId}`, { tag: 'integrityAudit', metric: false })).value;
    for (const attempt of view.state.attempts.filter(a => a.activityId === teacher.activityId)) {
      for (const response of attempt.answers) { const k = `${attempt.id}:${response.questionId}`; if (persisted.has(k)) duplicates++; persisted.set(k, response.idempotencyKey); }
    }
  }
  const missing = [...current.confirmed].filter(([key, value]) => persisted.get(key) !== value).length;
  current.integrity = { expectedAnswers: 2000, persistedAnswers: persisted.size, confirmedAnswers: current.confirmed.size, missingOrChangedConfirmed: missing, duplicateQuestions: duplicates };
  current.confirmed = undefined;
}
async function runPhase(mode, stage, seconds) {
  phase = null;
  await makeActivities(mode, stage);
  const current = { name: `${mode}-${stage}`, mode, stage, targetSeconds: seconds, startedAt: new Date().toISOString(), requestCount: 0, failedRequests: 0, bodyBytes: 0, operations: {}, responseAckMs: [], confirmationMs: [], propagationMs: [], skippedPollTicks: 0, confirmed: new Map(), unsentAnswers: 0, unconfirmedAnswers: 0, unobservedConfirmations: 0, burst: null };
  report.phases.push(current); phase = current; recent.length = 0;
  const start = Date.now(), end = start + seconds * 1000, period = seconds * 100;
  const stopPolling = startPolling();
  let phaseError;
  console.log(`FASE ${current.name}: ${seconds} segundos, 204 sesiones activas.`);
  try {
    for (let index = 0; index < 10; index++) {
      await until(start + index * period);
      if (mode === 'guided') {
        if (index > 0) await Promise.all(teachers.map(t => command(t, 'closeGuidedQuestion', t.activityId, true)));
        await Promise.all(teachers.map(async t => {
          const begun = performance.now();
          for (const s of students.filter(s => s.group === t.group)) s.wanted = { index, started: begun, phase: current.name };
          await command(t, index === 0 ? 'startGuidedSession' : 'openNextGuidedQuestion', t.activityId);
        }));
      }
      const burst = stage === 'measurement' && index === 4;
      const dispatches = [], answerStart = start + index * period + (stage === 'warmup' ? 5000 : 10000);
      await Promise.all(students.map(async (s, i) => {
        await until(answerStart + (burst ? i * 1900 / 200 : i * 15000 / 200));
        dispatches.push(Date.now());
        await answer(s, index, current);
      }));
      if (burst) current.burst = { target: 200, dispatched: dispatches.length, windowMs: Math.max(...dispatches) - Math.min(...dispatches), targetWindowMs: 2000 };
    }
    await until(end - 3000);
    if (mode === 'guided') await Promise.all(teachers.map(t => command(t, 'closeGuidedQuestion', t.activityId, true)));
    await until(end);
  } catch (error) {
    phaseError = error;
    current.interrupted = true;
  } finally {
    await stopPolling();
    current.completedAt = new Date().toISOString(); current.elapsedSeconds = Number(((Date.now() - start) / 1000).toFixed(3));
    phase = null;
  }
  await persist();
  try { await auditIntegrity(current); } catch(error) { current.integrityAuditStatus=`No completada: ${error.name}`;phaseError ||= error; }
  if (!aborted && !phaseError) {
    const resultStart = performance.now();
    await parallel(students, 6, async s => { const teacher = teachers.find(t => t.group === s.group); await command(teacher, 'publishGrade', s.activityId, s.id); });
    current.publishAllElapsedMs = Math.round(performance.now() - resultStart);
    const resultLatencies = [];
    await parallel(students, 8, async s => { const started = performance.now(); const data = await refresh(s, 'publishedResults'); if (!data.studentResults[fixtures.groups.find(g => g.group === s.group).subjectId]?.some(r => r.activityId === s.activityId && r.grade === 100)) current.unobservedResults = (current.unobservedResults || 0) + 1; resultLatencies.push(performance.now() - started); });
    current.resultsReadP95Ms = percentile(resultLatencies, 0.95);
  }
  summarize(current);
  current.criteria = { durationCompleted: current.elapsedSeconds >= seconds && !current.interrupted, confirmationP95: current.confirmationP95Ms !== null && current.confirmationP95Ms <= 1500, propagationP95: mode !== 'guided' || current.propagationP95Ms !== null && current.propagationP95Ms <= 2000, validRequestFailureRate: current.failureRate !== null && current.failureRate < 0.01, integrity: current.integrity?.missingOrChangedConfirmed === 0 && current.integrity?.duplicateQuestions === 0 && current.integrity?.persistedAnswers === 2000, burst: stage !== 'measurement' || current.burst?.dispatched === 200 && current.burst.windowMs <= 2000 };
  await saveCookies(); await persist();
  console.log(`FIN ${current.name}: confirmación p95=${current.confirmationP95Ms}ms; propagación p95=${current.propagationP95Ms}ms; errores=${current.failedRequests}/${current.requestCount}.`);
  if (phaseError) throw phaseError;
}
const monitor = setInterval(async () => {
  while (recent.length && recent[0].at < Date.now() - 60_000) recent.shift();
  const fraction = recent.length ? recent.filter(r => r.failed).length / recent.length : 0;
  if (bodyBytes * 2 + totalRequests * 1024 > 1_000_000_000) abortReason = 'Corte preventivo: estimación de transferencia adicional superior a 1 GB.';
  if (phase && recent.length >= 100 && fraction > 0.1 && new Date().getTime() - new Date(phase.startedAt).getTime() >= 60_000) abortReason = 'Corte preventivo: más de 10 % de fallos técnicos en la última ventana de un minuto.';
  if (abortReason) aborted = true;
  if (phase) console.log(`Avance ${phase.name}: ${Math.round((Date.now() - new Date(phase.startedAt).getTime()) / 1000)}s; ${phase.requestCount} solicitudes; ${phase.failedRequests} fallos; estimación ${Math.round((bodyBytes * 2 + totalRequests * 1024) / 1e6)}MB.`);
  await persist();
}, 60_000);
try {
  await prepareSessions();
  if (process.argv.includes('--sessions-only')) { report.status = 'sessions-prepared'; await persist(); }
  else {
    report.status = 'running';
    for (const mode of ['individual', 'guided']) {
      await runPhase(mode, 'warmup', 300);
      const warmup=report.phases.at(-1);
      if(warmup.confirmationP95Ms>4500){abortReason='Corte preventivo tras calentamiento completo: p95 de confirmación superior al triple del umbral de 1500 ms; no se inicia medición con saturación persistente.';aborted=true;throw new Error('WARMUP_SATURATION');}
      await runPhase(mode, 'measurement', 900);
    }
    report.status = report.phases.filter(p => p.stage === 'measurement').every(p => Object.values(p.criteria).every(Boolean)) ? 'q06-passed-in-local-environment' : 'q06-failed-in-local-environment';
  }
} catch (error) {
  report.status = aborted ? 'stopped-at-safety-limit' : 'failed';
  report.failure = { type: error.name, reason: abortReason || error.message.replace(/https?:\/\/\S+/g, '[URL]') };
  console.error(`CARGA ${report.status}: ${report.failure.reason}`);
} finally {
  clearInterval(monitor); loopDelay.disable();
  report.completedAt = new Date().toISOString();
  report.generatorEventLoop = { p95Ms: Number((loopDelay.percentile(95) / 1e6).toFixed(2)), maxMs: Number((loopDelay.max / 1e6).toFixed(2)) };
  await saveCookies(); await persist();
  if (report.status.includes('failed') || report.status.startsWith('stopped')) process.exitCode = 1;
}
