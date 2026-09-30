import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Sólo lectura: este observador nunca invoca mantenimiento ni elimina archivos.
const fixture = JSON.parse(await fs.readFile('.local-private/retention-scheduled-fixture.json', 'utf8'));
const db = JSON.parse(await fs.readFile('docs/verificacion/conservacion-programada-resultado.json', 'utf8'));
const path = 'docs/verificacion/conservacion-programada.json';
const report = JSON.parse(await fs.readFile(path, 'utf8'));
const ci = JSON.parse(await fs.readFile('docs/verificacion/ci-integracion.json', 'utf8'));
const run = ci.find(entry => entry.id === 36673912107);
assert.equal(fixture.project, 'bnqyyumfmyexsqszglab');
assert.equal(report.runId, fixture.runId);
assert.equal(db.job.id, report.eligibility.job_id);
assert.equal(run.event, 'schedule');
assert.equal(run.conclusion, 'success');
assert.equal(db.job.status, 'done');
assert.equal(db.subjectExists || db.fileMetadataExists || db.storageObjectExists, false);
const completed = Date.parse(db.job.completed_at);
const eligible = Date.parse(report.eligibility.eligible_at);
assert.ok(completed >= eligible && completed <= Date.parse(report.eligibility.target_by));
assert.ok(completed >= Date.parse(run.createdAt) && completed <= Date.parse(run.updatedAt));
const env = Object.fromEntries((await fs.readFile('.env.local', 'utf8')).split(/\r?\n/)
  .filter(line => line.trim() && !line.startsWith('#')).map(line => {
    const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')];
  }));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, `https://${fixture.project}.supabase.co`);
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const bucket = client.storage.from(fixture.file.bucket);
const parent = fixture.file.path.slice(0, fixture.file.path.lastIndexOf('/'));
const filename = fixture.file.path.slice(fixture.file.path.lastIndexOf('/') + 1);
const listing = await bucket.list(parent, { search: filename, limit: 100 });
if (listing.error) throw new Error(`Storage listing failed: ${listing.error.statusCode}`);
assert.equal(listing.data.some(item => item.name === filename), false);
const download = await bucket.download(fixture.file.path);
assert.equal(download.data, null);
assert.ok(download.error && /not found|does not exist/i.test(download.error.message));
const logs = await Promise.all(run.jobs.map(async job => {
  const bytes = await fs.readFile(`.local-private/ci-${run.id}-${job.id}.log`);
  const text = bytes.toString('utf8');
  assert.ok(text.includes('"deletedFileRecords":1'));
  return { jobId: job.id, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
report.status = 'scheduled-observation-passed';
report.completedAt = db.job.completed_at;
report.observedAt = new Date().toISOString();
report.eligibilityToCompletionSeconds = (completed - eligible) / 1000;
report.databaseEvidence = 'conservacion-programada-resultado.json';
report.scheduledRun = { id: run.id, event: run.event, sha: run.sha, url: run.url, createdAt: run.createdAt, updatedAt: run.updatedAt, logEvidence: logs };
report.storageEvidence = { listedObject: false, downloadFound: false, downloadErrorStatus: download.error.statusCode, downloadError: download.error.message };
report.script = { path: 'tools/datos/retention-scheduled-observe.mjs', sha256: createHash('sha256').update(await fs.readFile('tools/datos/retention-scheduled-observe.mjs')).digest('hex') };
report.checks = ['Ejecución automática con evento schedule y resultado success', 'Trabajo terminado dentro de la ventana de esa ejecución', 'Eliminación dentro de las 24 horas desde la elegibilidad', 'Materia y metadato ausentes', 'Objeto ausente en metadatos de Storage y listado autorizado', 'Descarga autorizada responde objeto no encontrado', 'Registro del mantenimiento confirma un archivo completado'].map(detail => ({ detail, result: 'passed' }));
report.nextStep = 'Observación programada completada para este fixture; queda la carrera remota de AP-31.';
run.evidenceSource = 'GitHub REST API: run, jobs and downloaded job logs';
run.logEvidence = logs;
run.observedMaintenanceResult = { deletedFileRecords: 1, completedAt: '2026-09-30T05:33:29.223Z' };
await fs.writeFile(path, JSON.stringify(report, null, 2) + '\n');
await fs.writeFile('docs/verificacion/ci-integracion.json', JSON.stringify(ci, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, elapsedSeconds: report.eligibilityToCompletionSeconds }));
