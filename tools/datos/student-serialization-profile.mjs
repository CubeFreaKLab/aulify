import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PGlite } from '@electric-sql/pglite';
process.on('unhandledRejection', error => { console.error(`FAIL ${error.message}\n${error.where ?? ''}`); process.exit(1); });

// Perfil reproducible exclusivamente en memoria. No lee .env ni abre conexiones.
const db = new PGlite();
const startedAt = new Date().toISOString();
const lastMigration = '20260929221908_aulify_deferred_ranking_publication.sql';
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
const migrations = (await fs.readdir('supabase/migrations')).filter(f => f.endsWith('.sql') && f <= lastMigration).sort();
for (const file of migrations) await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8'));
const uuid = () => crypto.randomUUID();
const teacher = uuid(), other = uuid(), students = Array.from({ length: 50 }, uuid);
for (const user of [teacher, other, ...students]) await db.query('insert into auth.users values($1,$2,now(),$3)', [user, `${user}@example.test`, { name: 'Persona ficticia', role: students.includes(user) ? 'student' : 'teacher' }]);
const as = async id => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const command = async (action, ...args) => (await query('select public.aulify_command($1,$2) value', [action, { args }]))[0].value;
await db.exec('set role authenticated'); await as(teacher);
const subject = await command('createSubject', { name: 'Perfil SQL ficticio', course: '3.º', year: 2026, description: 'Escenario aislado de cincuenta participantes.' });
await db.exec('reset role');
for (const student of students) await db.query("insert into app.memberships(subject_id,student_id,status) values($1,$2,'approved')", [subject.id, student]);
await db.exec('set role authenticated');
const questions = Array.from({ length: 10 }, (_, i) => { const correct = uuid(); return { id: uuid(), type: 'single', prompt: `Pregunta ${i + 1}`, points: 1, options: [{ id: correct, text: 'A' }, { id: uuid(), text: 'B' }], correctOptionId: correct, explanation: 'Solución privada' }; });
const resource = { id: uuid(), title: 'Recurso de diagnóstico', kind: 'quiz', blocks: [{ id: uuid(), type: 'quiz', questions }], revision: 1 };
await command('saveDraft', resource, 0);
const version = await command('publishResource', resource.id);
const activity = await command('createActivity', version.id, subject.id, { purpose: 'practice', pace: 'individual', maxGrade: 100, weight: 1, countsTowardAverage: true, maxAttempts: 1, opensAt: new Date(Date.now() - 60000).toISOString(), closesAt: new Date(Date.now() + 3600000).toISOString(), timeLimitMinutes: null, timeZone: 'America/La_Paz', feedback: 'hidden', manualCorrection: false, shuffleQuestions: false, shuffleOptions: false, streaks: false, sound: false, ranking: false, teams: false, allowHint: false, allowDouble: false, bonusAffectsGrade: false, reportVisibility: false }, 'Actividad de diagnóstico');
const attempts = [];
for (const student of students) {
  await as(student); const attempt = await command('startAttempt', activity.id); attempts.push(attempt.id);
  for (const question of questions.slice(0, 8)) await command('submitAnswer', attempt.id, question.id, { type: 'single', optionId: question.correctOptionId }, uuid(), false);
}
await db.exec('reset role; analyze;');
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const result = { startedAt, environment: 'PGlite aislado, 50 participantes con ocho respuestas de diez; sin concurrencia ni tráfico remoto.', migrations, stages: [], checks: [], commandStages: [] };
const commandRequest = uuid();
async function measureCommand(name) {
 // Cada muestra se revierte. Ejecutar triggers diferidos antes de detener el reloj
 // evita confundir el cuerpo de la función con el trabajo pendiente del comando.
 const timings = [], counterDeltas = [];
 for (let i = 0; i < 16; i++) {
  const before = (await query('select teacher_revision from app.activity_sync_versions where activity_id=$1', [activity.id]))[0].teacher_revision;
  await db.exec('begin; set local role authenticated;'); await as(students[0]);
  const start = performance.now();
  const value = await command('submitAnswer', attempts[0], questions[8].id,
   { type: 'single', optionId: questions[8].correctOptionId }, commandRequest, false);
  await db.exec('set constraints all immediate');
  const elapsed = performance.now() - start;
  if (value.attempt.id !== attempts[0] || value.attempt.answers.length !== 9 || value.feedback !== null)
   throw new Error(`ACK inválido en ${name}`);
  await db.exec('reset role');
  const after = (await query('select teacher_revision from app.activity_sync_versions where activity_id=$1', [activity.id]))[0].teacher_revision;
  counterDeltas.push(Number(after) - Number(before));
  await db.exec('rollback');
  if (i >= 4) timings.push(elapsed);
 }
 if (counterDeltas.some(delta => delta !== 2)) throw new Error(`Cambió el contador docente en ${name}`);
 result.commandStages.push({ name, samples: timings.length, p50Ms: percentile(timings, 0.5), p95Ms: percentile(timings, 0.95), includesDeferredTriggers: true, persisted: false, teacherRevisionIncrementsPerAnswer: [...new Set(counterDeltas)] });
 result.checks.push({ name: `ACK con nueve respuestas y sin corrección oculta ${name}`, pass: true });
}
const originals = {};
for (const name of ['app.student_activity(uuid)', 'app.activity_snapshot(uuid)']) originals[name] = (await db.query('select pg_get_functiondef($1::regprocedure) value', [name])).rows[0].value;
const normalize = data => { const x = structuredClone(data); delete x.state.revision; x.state.attempts.sort((a, b) => a.id.localeCompare(b.id)); return JSON.stringify(x); };
const baselineViews = {};
async function measureStage(name) {
 await db.exec('set role authenticated');
 const stage = { name };
 for (const [role, user] of [['student', students[0]], ['teacher', teacher]]) {
  await as(user);
  for (let i = 0; i < 4; i++) await query('select public.aulify_activity_snapshot($1) value', [activity.id]);
  const timings = [];
  for (let i = 0; i < 30; i++) { const start = performance.now(); await query('select public.aulify_activity_snapshot($1) value', [activity.id]); timings.push(performance.now() - start); }
  const view = (await query('select public.aulify_activity_snapshot($1) value', [activity.id]))[0].value;
  const value = normalize(view);
  if (name === 'baseline') baselineViews[role] = value;
  else if (baselineViews[role] !== value) throw new Error(`Proyección ${role} no equivalente en ${name}`);
  result.checks.push({ name: `Proyección completa ${role} ${name}`, pass: true });
  if (role === 'student' && /correctOptionId|manualGuide|explanation|Solución privada/.test(value)) throw new Error('Filtración en proyección estudiante');
  stage[role] = { samples: 30, p50Ms: percentile(timings, 0.5), p95Ms: percentile(timings, 0.95), bytes: Buffer.byteLength(value) };
 }
 await db.exec('reset role'); result.stages.push(stage);
}
await measureStage('baseline');
await measureCommand('baseline');
await db.exec(await fs.readFile('tools/datos/profile-student-serialization.sql', 'utf8'));
await measureStage('reuseQuestions');
let snapshot = originals['app.activity_snapshot(uuid)'];
const oldStudent = "if not teacher then studentviews:=jsonb_build_object(a.id,app.student_activity(a.id)); end if;";
if (!snapshot.includes(oldStudent)) throw new Error('No se encontró lectura estudiantil');
snapshot = snapshot.replace(oldStudent, '').replace('if teacher then attempts:=', oldStudent + '\n if teacher then attempts:=');
const oldAttempt = 'jsonb_agg(app.attempt_json(at.id,teacher))';
if (!snapshot.includes(oldAttempt)) throw new Error('No se encontró agregado estudiantil');
snapshot = snapshot.replace(oldAttempt, "jsonb_agg(case when at.id::text=studentviews->a.id::text->'attempt'->>'id' then studentviews->a.id::text->'attempt' else app.attempt_json(at.id,teacher) end)");
snapshot = snapshot.replace("jsonb_build_array(app.activity_json(a.id))", "jsonb_build_array(case when teacher then app.activity_json(a.id) else studentviews->a.id::text->'activity' end)");
await db.exec(snapshot);
await measureStage('reuseQuestionsAttemptActivity');
await measureCommand('reuseQuestionsAttemptActivity');
for (const [label, user] of [['docente ajeno', other], ['perfil inexistente', uuid()]]) {
 await db.exec('set role authenticated'); await as(user); let rejected = false;
 try { await query('select public.aulify_activity_snapshot($1)', [activity.id]); } catch (error) { rejected = error.code === '42501'; }
 if (!rejected) throw new Error(`Autorización ${label}`);
 result.checks.push({ name: `Snapshot deniega ${label}`, pass: true });
 await db.exec('reset role');
}
await db.exec('set role authenticated'); await as(students[0]);
let denied = false;
try { await query('select app.profile_version_questions($1,$2)', [version.id, []]); } catch (error) { denied = error.code === '42501'; }
if (!denied) throw new Error('Helper accesible');
result.checks.push({ name: 'Helper privado deniega ejecución directa authenticated', pass: true });
await db.exec('reset role');
// Repetir base después del prototipo permite observar calentamiento y deriva local.
await db.exec(originals['app.student_activity(uuid)']); await db.exec(originals['app.activity_snapshot(uuid)']);
await measureStage('baselineRepeated');
await measureCommand('baselineRepeated');
result.finishedAt = new Date().toISOString();
result.limitations = ['Muestra de selección simple y un intento por estudiante; faltan pruebas exhaustivas con los demás tipos antes de migrar.', 'No mide CPU remota, contención, PostgREST, colas HTTP ni capacidad Q06.', 'Solo elimina reloj de transporte y orden no contractual de la colección de intentos al comparar. No elimina campos de permisos ni contenido.', 'Las muestras del comando se revierten tras ejecutar los triggers diferidos; no incluyen durabilidad del COMMIT, red, proxy ni contención entre clientes. Las funciones modificadas solo pertenecen a la ruta de lectura; una diferencia temporal del ACK entre etapas no acredita mejora del comando.'];
await fs.writeFile('docs/verificacion/datos-serializacion-estudiante-aislada.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ stages: result.stages, commandStages: result.commandStages, checks: result.checks.length }));
await db.close();
