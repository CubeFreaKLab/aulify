/** Ensayo aislado: este respaldo no se puede importar en Supabase alojado. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
process.on('unhandledRejection', error => { console.error(`FAIL: ${error.code || ''} ${error.message}`); process.exitCode = 1; });
const started = new Date().toISOString();
const migrations = (await fs.readdir('supabase/migrations')).filter(x => x.endsWith('.sql')).sort();
let db = new PGlite();
const checks = [];
function check(condition, label) {
  if (!condition) throw new Error(label);
  checks.push({ case: label, result: 'passed' });
}
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
for (const file of migrations) await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8'));
const teacher = crypto.randomUUID(), student = crypto.randomUUID(), other = crypto.randomUUID();
for (const [id, role, name] of [[teacher, 'teacher', 'Docente de prueba'], [student, 'student', 'Estudiante de prueba'], [other, 'teacher', 'Otro docente']]) {
  await db.query('insert into auth.users values($1,$2,now(),$3)', [id, `${id}@example.test`, { role, name }]);
}
async function as(user) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}
async function command(action, ...args) {
  return (await db.query('select public.aulify_command($1,$2) result', [action, { args }])).rows[0].result;
}
async function snapshot() { return (await db.query('select public.aulify_snapshot() result')).rows[0].result; }
await as(teacher);
const subject = await command('createSubject', { name: 'Biología de recuperación', course: '3.º A', year: 2026, description: 'Escenario ficticio aislado' });
const code = (await snapshot()).state.subjects[0].code;
await as(student);
const membership = await command('requestMembership', code);
await as(teacher);
await command('decideMembership', membership.id, 'approved');
const manual = await command('createManualActivity', { subjectId: subject.id, title: 'Exposición de prueba', description: 'Actividad ficticia', occursAt: '2026-09-28', maxGrade: 20, weight: 1, countsTowardAverage: true });
await command('gradeManual', manual.id, student, 16, 'Revisión de prueba', null, true);
await as(student);
const before = await snapshot();
check(before.studentResults[subject.id]?.some(x => x.activityId === manual.id && x.grade === 16), 'nota publicada presente antes del respaldo');
await db.exec('reset role');
const catalogSql = `select tablename, rowsecurity from pg_tables where schemaname='app' order by tablename`;
const tablesBefore = (await db.query(catalogSql)).rows;
const backup = await db.dumpDataDir('gzip');
const bytes = Buffer.from(await backup.arrayBuffer());
await fs.mkdir('.local-private/recovery', { recursive: true });
await fs.writeFile('.local-private/recovery/pglite-ficticio.tar.gz', bytes);
check(bytes.length > 0, 'respaldo materializado como archivo independiente');
await db.close();
const recoveryStart = performance.now();
db = new PGlite({ loadDataDir: new Blob([await fs.readFile('.local-private/recovery/pglite-ficticio.tar.gz')]) });
await db.waitReady;
check(JSON.stringify((await db.query(catalogSql)).rows) === JSON.stringify(tablesBefore), 'tablas y RLS coinciden después de restaurar');
await as(student);
const after = await snapshot();
check(JSON.stringify(after.studentResults) === JSON.stringify(before.studentResults), 'resultados y versiones publicados conservados');
check(after.state.subjects.some(x => x.id === subject.id), 'pertenencia y materia conservadas');
await as(other);
check(!(await snapshot()).state.subjects.some(x => x.id === subject.id), 'docente ajeno continúa sin acceso');
let denied = false;
try { await command('archiveSubject', subject.id); } catch (error) { denied = error.code === '42501' || error.message.startsWith('FORBIDDEN'); }
check(denied, 'operación ajena rechazada después de restaurar');
await as(teacher);
await command('updateSubject', subject.id, { name: 'Biología recuperada', course: '3.º A', year: 2026, description: 'Continuidad comprobada' });
check((await snapshot()).state.subjects.some(x => x.name === 'Biología recuperada'), 'se puede continuar operando sobre el entorno recuperado');
await db.exec('reset role');
check((await db.query("select count(*)::int n from pg_tables where schemaname='app' and rowsecurity")).rows[0].n === 45, 'RLS continúa activo en las 45 tablas');
await db.close();
const report = {
  startedAt: started, completedAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  environment: 'PGlite 0.5.8 local; Auth y Storage mínimos aislados; datos ficticios', migrations,
  backup: { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), format: 'PGlite datadir gzip' },
  recoveryAndVerificationMs: Math.round(performance.now() - recoveryStart), checks,
  limitations: ['No es un respaldo importable en PostgreSQL alojado ni una recuperación de Supabase.', 'No incluye sesiones Auth reales, contraseñas, bytes de Storage ni prueba posterior a despliegue.', 'La recuperación operativa del servicio remoto continúa pendiente; este ensayo cubre estructura y datos ficticios del motor aislado.'],
};
await fs.writeFile('docs/verificacion/recuperacion-aislada.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: checks.length, report: 'docs/verificacion/recuperacion-aislada.json', backupBytes: bytes.length }));
