import fs from 'node:fs/promises';
import { retryAfterMs } from './load-waits.mjs';
import { loadCriteria } from './load-criteria.mjs';
import { parallel } from './load-workers.mjs';
import {observeServerTiming,summarizeServerTiming} from './server-timing-aggregate.mjs';
import {rpcFailureCategory,transportFailureCategory} from './load-failure-category.mjs';
import { loadTargetFromEnvironment } from './load-target.mjs';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';

const base = process.env.AULIFY_LOAD_URL;
const expectedBuild = process.env.AULIFY_EXPECTED_BUILD_ID;
const diagnosticOnly = process.argv.includes('--diagnostic-individual');
if (diagnosticOnly && process.argv.includes('--sessions-only')) throw new Error('Seleccionar un solo modo de ejecución.');
const loadTarget = await loadTargetFromEnvironment(base);
const budgetBytes = Number(process.env.AULIFY_LOAD_BUDGET_BYTES || 1_000_000_000);
if (!Number.isSafeInteger(budgetBytes) || budgetBytes < 1 || budgetBytes > 2_500_000_000) throw new Error('Presupuesto fuera del límite preventivo.');
const verifyBuild = () => loadTarget.verifyBuild();
const initialBuildCheck = await verifyBuild();
const accounts = JSON.parse(await fs.readFile('.local-private/load-accounts.json', 'utf8'));
const fixtures = JSON.parse(await fs.readFile('.local-private/load-fixtures.json', 'utf8'));
if (accounts.projectRef !== 'bnqyyumfmyexsqszglab' || fixtures.projectRef !== accounts.projectRef || accounts.users.length !== 204 || fixtures.groups.length !== 4 || fixtures.groups.some(g => g.students.length !== 50 || g.questions.length !== 10)) throw new Error('Preparación incompleta o proyecto incorrecto.');
const localEnv = Object.fromEntries((await fs.readFile('.env.local','utf8')).split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
if (localEnv.NEXT_PUBLIC_SUPABASE_URL !== `https://${accounts.projectRef}.supabase.co`) throw new Error('El proyecto configurado no es el autorizado.');
const privatePath = '.local-private/load-http-sessions.json';
const reportPath = `docs/verificacion/datos-carga-${new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14)}.json`;
const runId = crypto.randomUUID();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { runId, startedAt: new Date().toISOString(), status: 'preparing', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), compiledCommit: process.env.AULIFY_COMPILED_COMMIT || undefined, buildId: expectedBuild, target: loadTarget.metadata, environment: { application: loadTarget.local ? 'Next.js production local HTTP' : 'Next.js Vercel Preview HTTPS', base, database: 'Supabase Free, PostgreSQL 17, sa-east-1', generator: { node: process.version, os: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() }, activeSessions: 204, teachers: 4, students: 200, studentsPerClass: 50, questionsPerActivity: 10, pollingMs: 1000, polling: 'GET /api/sync cada segundo, suspendido durante respuesta propia; snapshot solo para cambios no proyectados por un ACK con base conocida y marca completa; reintento 1/2/4/8 s', warmupSeconds: 300, measurementSeconds: 900, logicalBodyBudgetBytes: 1_000_000_000 }, phases: [], authentication: { rateLimitWaits: 0, preparedSessions: 0 }, limitations: ['El generador simula el protocolo HTTP de la aplicación; no ejecuta 204 navegadores ni mide dibujo de pantalla.', loadTarget.local ? 'La aplicación está en una computadora local, no en el alojamiento público.' : 'Vista previa protegida de Vercel; no es producción ni una liberación pública.', 'Los bytes JSON descomprimidos y una estimación conservadora no sustituyen el contador facturable de Supabase, que tiene retraso.', 'La preparación y el inicio de sesión quedan fuera de los quince minutos de medición. No se envían correos ni se habilitan pagos.'] };
report.environment.confirmation = 'ACK después de persistir, con Attempt autorizado aplicado al estado del cliente. La auditoría posterior contrasta cada clave; no se espera un snapshot redundante para avanzar.';
report.environment.logicalBodyBudgetBytes = budgetBytes;
report.protocol = diagnosticOnly ? 'diagnostic-individual-warmup-and-next-preparation' : 'full-q06';
if (diagnosticOnly) {
  report.environment.measurementSeconds = 0;
  report.limitations.push('Diagnóstico limitado: cinco minutos individuales y preparación de otra actividad. No ejecuta las mediciones de quince minutos ni el modo guiado; no puede aprobar Q-06.');
}
report.buildChecks = [initialBuildCheck];
report.scriptSha256 = crypto.createHash('sha256').update(await fs.readFile('tools/datos/load-run.mjs')).digest('hex');
report.expectedMigration = {path:'supabase/migrations/20260930024809_aulify_visibility_effective_closure.sql',sha256:crypto.createHash('sha256').update(await fs.readFile('supabase/migrations/20260930024809_aulify_visibility_effective_closure.sql')).digest('hex')};
report.environment.preparation = 'Cookies ficticias existentes; lectura acotada por actividad tras una lectura docente por grupo. No se crean cuentas ni se usa contraseña como alternativa.';
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
function record(target, tag, status, ms, bytes, timingHeader) {
  totalRequests++; bodyBytes += bytes;
  if (!target) {
    const operation = (report.setupOperations ||= {})[tag] ||= {count:0,failed:0,statuses:{},latencies:[]};
    operation.count++;operation.statuses[status]=(operation.statuses[status]||0)+1;
    operation.latencies.push(ms);
    if(status===200)observeServerTiming(operation,timingHeader,ms);
    if(status<200||status>=300)operation.failed++;
    return;
  }
  const operation = target.operations[tag] ||= { count: 0, failed: 0, latencies: [], statuses: {} };
  operation.count++; operation.latencies.push(ms); operation.statuses[status] = (operation.statuses[status] || 0) + 1;
  if(status===200)observeServerTiming(operation,timingHeader,ms);
  target.requestCount++; if (status < 200 || status >= 300) { operation.failed++; target.failedRequests++; }
  target.bodyBytes += bytes;
  recent.push({ at: Date.now(), failed: status < 200 || status >= 300 });
}
async function request(s, route, { method = 'GET', body, tag = route, metric = true } = {}) {
  if (aborted && metric) throw new Error('LOAD_ABORTED');
  const start = performance.now(), target = metric ? phase : null;
  try {
    const response = await loadTarget.request(route, { method, headers: { Cookie: [...s.jar].map(([k, v]) => `${k}=${v}`).join('; '), Origin: base, 'Sec-Fetch-Site': 'same-origin', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000) });
    setCookies(s, response); const text = await response.text();
    record(target, tag, response.status, performance.now() - start, Buffer.byteLength(text),response.headers.get('Server-Timing'));
    if (!response.ok) { const error = new Error(`HTTP_${response.status}`); error.recorded = true; error.status = response.status; error.category=rpcFailureCategory(response.headers); error.tag=tag; error.retryAfterMs = retryAfterMs(response.headers.get('Retry-After')); throw error; }
    return { value: JSON.parse(text), elapsed: performance.now() - start };
  } catch (error) { if (!error.recorded) {record(target, tag, 0, performance.now() - start, 0);error.category=transportFailureCategory(error);error.tag=tag;} throw error; }
}
const command = async (s, action, ...args) => (await request(s, '/api/commands', { method: 'POST', body: { action, args }, tag: action })).value.result;
function needsTokenRefresh(s){try{let v=[...s.jar].filter(([k])=>k.includes('auth-token')).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v).join('');v=decodeURIComponent(v);if(v.startsWith('base64-'))v=Buffer.from(v.slice(7),'base64url').toString();return(JSON.parse(v).expires_at??0)*1000<Date.now()+90000;}catch{return true;}}
async function prepareSessions() {
  let previousRenewal=0;
  const activityByGroup = new Map();
  for (const [index, s] of sessions.entries()) {
    if (!s.jar.size) throw new Error('Falta una sesión ficticia existente; no se crea ni sustituye automáticamente.');
    if (needsTokenRefresh(s)) { await delay(Math.max(0,2500-(Date.now()-previousRenewal))); previousRenewal=Date.now(); }
    let ready = false;
    for (let retry = 0; retry < 3; retry++) {
      try {
        const route = activityByGroup.has(s.group) ? `/api/workspace?activity=${activityByGroup.get(s.group)}` : '/api/workspace';
        const {value} = await request(s, route, {metric:false});
        if (s.role === 'teacher') {
          const activity = value.state.activities.filter(a=>a.settings.pace==='individual').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
          if (activity) activityByGroup.set(s.group, activity.id);
        }
        ready=true; break;
      } catch(error) {
        if (![429,503].includes(error.status) && !['TimeoutError','TypeError'].includes(error.name)) throw error;
        report.authentication.rateLimitWaits++;
        await delay(Math.max(30000,error.retryAfterMs||0));
      }
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
  s.refresh = request(s, tag==='publishedResults' ? '/api/workspace' : `/api/workspace?activity=${s.activityId}`, { tag }).then(result => { const applied=s.mutationEpoch===epoch; if(applied)observe(s, result.value, target); return {applied,value:s.latest ?? result.value}; }).finally(() => { s.refresh = null; });
  return s.refresh;
}
function startPolling() {
  const timers = [];
  const poll = s => {
    if (s.running || s.pendingAnswer || aborted || s.authorizationLost || Date.now() < s.retryAt) { if (phase) phase.skippedPollTicks++; return; }
    s.running = (async () => {
      try {
        const epoch=s.mutationEpoch;
        const result = (await request(s, `/api/sync?activity=${s.activityId}`, { tag: 'sync' })).value;
        if(epoch!==s.mutationEpoch)return;
        if (s.lastRevision !== result.revision) { const snapshot=await refresh(s); if(snapshot.applied)s.lastRevision = result.revision; }
        s.retryAt=0;s.retryMs=1000;
      } catch (error) {
        // La recuperación del cliente vuelve a descargar la proyección,
        // aunque la huella no haya cambiado durante el fallo temporal.
        s.lastRevision=null;
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
const summarizeOperations = operations => Object.fromEntries(Object.entries(operations).map(([k,v])=>[k,{
 count:v.count,failed:v.failed,p50Ms:percentile(v.latencies,0.5),p95Ms:percentile(v.latencies,0.95),
 maxMs:Math.round(v.latencies.reduce((maximum,value)=>Math.max(maximum,value),0)),statuses:v.statuses,
 serverTiming:summarizeServerTiming(v,percentile),
}]));
function summarize(current) {
  current.successfulAcknowledgementSamples = current.responseAckMs.length;
  current.observedConfirmationSamples = current.confirmationMs.length;
  current.observedPropagationSamples = current.propagationMs.length;
  current.confirmationP95Ms = percentile(current.confirmationMs, 0.95);
  current.responseAckP95Ms = percentile(current.responseAckMs, 0.95);
  current.propagationP95Ms = percentile(current.propagationMs, 0.95);
  current.failureRate = current.requestCount ? current.failedRequests / current.requestCount : null;
  current.operations = summarizeOperations(current.operations);
  current.responseAckByQuestion = Object.fromEntries(Object.entries(current.responseAckByQuestion||{}).map(([index,values])=>[index,{samples:values.length,p50Ms:percentile(values,0.5),p95Ms:percentile(values,0.95)}]));
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
      s.pendingAnswer=true;
      let result;
      try{result=await command(s, 'submitAnswer', s.attemptId, question.id, { type: 'single', optionId: question.correctOptionId }, key, false);}finally{s.pendingAnswer=false;}
      if (!result.attempt.answers.some(a => a.questionId === question.id && a.idempotencyKey === key)) throw new Error('CONFIRMATION_MISSING');
      if (!current.confirmed.has(`${s.attemptId}:${question.id}`)) {
        const elapsed=performance.now()-started;
        current.responseAckMs.push(elapsed);
        ((current.responseAckByQuestion ||= {})[index+1] ||= []).push(elapsed);
      }
      current.confirmed.set(`${s.attemptId}:${question.id}`, key);
      // El comando responde después del COMMIT y aporta el intento autorizado.
      // Aplicarlo reproduce el avance inmediato del cliente; las lecturas antiguas no lo revierten.
      s.mutationEpoch++;
      if(result.syncProjectionComplete&&result.syncBaseRevision===s.lastRevision&&/^[a-f0-9]{32}$/.test(result.syncRevision??''))s.lastRevision=result.syncRevision;
      if(s.latest){
        s.latest.state.attempts=s.latest.state.attempts.filter(a=>a.id!==s.attemptId).concat(result.attempt);
        if(s.latest.studentActivities?.[s.activityId])s.latest.studentActivities[s.activityId].attempt=result.attempt;
      }
      current.confirmationMs.push(performance.now() - started);
      return;
    } catch(error) { if (aborted) return; if (retry === 2 || error.status===401 || error.status===403 || error.status===400) { if(current.confirmed.has(`${s.attemptId}:${question.id}`))current.unobservedConfirmations++;else current.unconfirmedAnswers++; return; } await delay(Math.max(300,error.retryAfterMs||0)); }
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
  report.buildChecks.push(await verifyBuild());
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
  try { if (!aborted && !phaseError) {
    const resultStart = performance.now();
    await parallel(students, 6, async s => { const teacher = teachers.find(t => t.group === s.group); await command(teacher, 'publishGrade', s.activityId, s.id); });
    current.publishAllElapsedMs = Math.round(performance.now() - resultStart);
    const resultLatencies = [];
    try {
      await parallel(students, 8, async s => { const started = performance.now(); const {value:data} = await refresh(s, 'publishedResults'); if (!data.studentResults[fixtures.groups.find(g => g.group === s.group).subjectId]?.some(r => r.activityId === s.activityId && r.grade === 100)) current.unobservedResults = (current.unobservedResults || 0) + 1; resultLatencies.push(performance.now() - started); });
    } finally {
      current.observedResultSamples = resultLatencies.length;
      current.resultsReadP95Ms = percentile(resultLatencies, 0.95);
    }
  }} catch(error) {
    phaseError ||= error;
    current.resultAuditStatus = `No completada: ${error.name}`;
  }
  summarize(current);
  current.criteria = loadCriteria(current);
  await saveCookies(); await persist();
  console.log(`FIN ${current.name}: confirmación p95=${current.confirmationP95Ms}ms; propagación p95=${current.propagationP95Ms}ms; errores=${current.failedRequests}/${current.requestCount}.`);
  if (phaseError) throw phaseError;
}
const monitor = setInterval(async () => {
  while (recent.length && recent[0].at < Date.now() - 60_000) recent.shift();
  const fraction = recent.length ? recent.filter(r => r.failed).length / recent.length : 0;
  if (bodyBytes * 2 + totalRequests * 1024 > budgetBytes) abortReason = `Corte preventivo: transferencia adicional estimada superior a ${budgetBytes} bytes.`;
  if (phase && recent.length >= 100 && fraction > 0.1 && new Date().getTime() - new Date(phase.startedAt).getTime() >= 60_000) abortReason = 'Corte preventivo: más de 10 % de fallos técnicos en la última ventana de un minuto.';
  if (abortReason) aborted = true;
  if (phase) console.log(`Avance ${phase.name}: ${Math.round((Date.now() - new Date(phase.startedAt).getTime()) / 1000)}s; ${phase.requestCount} solicitudes; ${phase.failedRequests} fallos; estimación ${Math.round((bodyBytes * 2 + totalRequests * 1024) / 1e6)}MB.`);
  await persist();
}, 60_000);
try {
  console.log(`CARGA: ${reportPath}; build ${expectedBuild}; presupuesto ${budgetBytes} bytes.`);
  await prepareSessions();
  if (process.argv.includes('--sessions-only')) { report.status = 'sessions-prepared'; await persist(); }
  else if (diagnosticOnly) {
    report.status = 'running-diagnostic';
    await runPhase('individual', 'warmup', 300);
    report.initialSetupOperations = summarizeOperations(report.setupOperations || {});
    report.setupOperations = {};
    report.nextPreparation = {startedAt:new Date().toISOString(),status:'running'};
    await makeActivities('individual', 'diagnostic-next-preparation');
    report.nextPreparation.completedAt = new Date().toISOString();
    report.nextPreparation.status = 'completed';
    report.status = 'diagnostic-completed-not-q06';
  }
  else {
    report.status = 'running';
    for (const mode of ['individual', 'guided']) {
      await runPhase(mode, 'warmup', 300);
      const warmup=report.phases.at(-1);
      if(warmup.confirmationP95Ms>4500){abortReason='Corte preventivo tras calentamiento completo: p95 de confirmación superior al triple del umbral de 1500 ms; no se inicia medición con saturación persistente.';aborted=true;throw new Error('WARMUP_SATURATION');}
      await runPhase(mode, 'measurement', 900);
    }
    const environment = loadTarget.local ? 'local-environment' : 'vercel-preview';
    report.status = report.phases.filter(p => p.stage === 'measurement').every(p => Object.values(p.criteria).every(Boolean)) ? `q06-passed-in-${environment}` : `q06-failed-in-${environment}`;
  }
} catch (error) {
  if (report.nextPreparation?.status === 'running') report.nextPreparation.status = 'failed';
  report.status = aborted ? 'stopped-at-safety-limit' : 'failed';
  report.failure = { type: error.name, reason: abortReason || error.message.replace(/https?:\/\/\S+/g, '[URL]'), operation:error.tag, category:error.category };
  console.error(`CARGA ${report.status}: ${report.failure.reason}`);
} finally {
  clearInterval(monitor); loopDelay.disable();
  report.completedAt = new Date().toISOString();
  report.setupOperations = summarizeOperations(report.setupOperations||{});
  report.generatorEventLoop = { p95Ms: Number((loopDelay.percentile(95) / 1e6).toFixed(2)), maxMs: Number((loopDelay.max / 1e6).toFixed(2)) };
  await saveCookies(); await persist();
  if (report.status.includes('failed') || report.status.startsWith('stopped')) process.exitCode = 1;
}
