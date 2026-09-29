import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Base nueva en memoria: no usa .env, credenciales ni servicios externos.
const migration = '20260929224538_aulify_participant_teacher_revision.sql';
const reportIndex = process.argv.indexOf('--report');
const reportPath = reportIndex < 0 ? 'docs/verificacion/datos-revision-participante-aislada.json' : process.argv[reportIndex + 1];
const report = { startedAt: new Date().toISOString(), migration, environment: 'PGlite aislado; operaciones secuenciales, sin red ni concurrencia real.', checks: [], contention: { executed: false, reason: 'Docker Desktop Linux Engine no está disponible; no se ejecutó el ensayo con dos sesiones PostgreSQL.' } };
const db = new PGlite();
const ok = (condition, name, details) => {
  assert.ok(condition, name);
  report.checks.push({ name, result: 'passed', ...(details ? { details } : {}) });
};
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const admin = async () => db.exec('reset role');
const actor = async id => {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
};
const command = async (action, ...args) => (await rows('select public.aulify_command($1,$2) value', [action, { args }]))[0].value;
const uid = () => crypto.randomUUID();
const normalize = value => { const x = structuredClone(value); delete x.state.revision; return JSON.stringify(x); };
async function denies(fn, name) {
  let code;
  try { await fn(); } catch (error) { code = error.code; }
  ok(code === '42501', name, { code });
}

try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
    alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
  const migrations = (await fs.readdir('supabase/migrations')).filter(name => name.endsWith('.sql') && name < migration).sort();
  for (const name of migrations) await db.exec(await fs.readFile(`supabase/migrations/${name}`, 'utf8'));
  report.baselineMigrations = migrations;
  const users = Object.fromEntries(['teacher', 'otherTeacher', 'a', 'b', 'unapproved', 'late'].map(name => [name, uid()]));
  for (const [name, id] of Object.entries(users)) await db.query('insert into auth.users values($1,$2,now(),$3)', [id, `${name}@example.test`, { name: `Persona ${name}`, role: name.includes('Teacher') || name === 'teacher' ? 'teacher' : 'student' }]);
  await actor(users.teacher);
  const subject = await command('createSubject', { name: 'Contadores aislados', course: '3.º', year: 2026, description: 'Datos ficticios' });
  await admin();
  const memberships = {};
  for (const name of ['a', 'b', 'late']) memberships[name] = (await rows("insert into app.memberships(subject_id,student_id,status) values($1,$2,'approved') returning id", [subject.id, users[name]]))[0].id;
  await actor(users.teacher);
  const questions = Array.from({ length: 2 }, (_, i) => {
    const answer = uid();
    return { id: uid(), type: 'single', prompt: `Pregunta ${i + 1}`, points: 5, options: [{ id: answer, text: 'Primera' }, { id: uid(), text: 'Segunda' }], correctOptionId: answer, explanation: 'SOLUCION_RESERVADA' };
  });
  const resource = { id: uid(), title: 'Revisiones por participante', kind: 'quiz', blocks: [{ id: uid(), type: 'quiz', questions }], revision: 1 };
  await command('saveDraft', resource, 0);
  const version = await command('publishResource', resource.id);
  const activity = await command('createActivity', version.id, subject.id, { purpose: 'practice', pace: 'individual', maxGrade: 100, weight: 1, countsTowardAverage: true, maxAttempts: 2, opensAt: new Date(Date.now() - 60000).toISOString(), closesAt: new Date(Date.now() + 3600000).toISOString(), timeLimitMinutes: null, timeZone: 'America/La_Paz', feedback: 'hidden', manualCorrection: false, shuffleQuestions: false, shuffleOptions: false, streaks: false, sound: false, ranking: false, teams: false, allowHint: false, allowDouble: false, bonusAffectsGrade: false, reportVisibility: true }, 'Actividad aislada');
  const attempts = {};
  for (const name of ['a', 'b']) { await actor(users[name]); attempts[name] = await command('startAttempt', activity.id); }
  const sync = async name => { await actor(users[name]); return (await rows('select public.aulify_sync($1) value', [activity.id]))[0].value.revision; };
  const snapshot = async name => { await actor(users[name]); return normalize((await rows('select public.aulify_activity_snapshot($1) value', [activity.id]))[0].value); };
  const counters = async () => {
    await admin();
    return {
      activity: (await rows('select public_revision,teacher_revision,ctid::text tuple from app.activity_sync_versions where activity_id=$1', [activity.id]))[0],
      participants: await rows('select v.*,v.ctid::text tuple from app.participant_sync_versions v join app.participants p on p.id=v.participant_id where p.activity_id=$1 order by p.id', [activity.id]),
    };
  };
  const beforeViews = {}, beforeHashes = {};
  for (const name of ['teacher', 'a', 'b']) { beforeViews[name] = await snapshot(name); beforeHashes[name] = await sync(name); }
  await admin();
  const oldCommon = (await counters()).activity;
  await db.exec('begin');
  await actor(users.a);
  await command('submitAnswer', attempts.a.id, questions[0].id, { type: 'single', optionId: questions[0].correctOptionId }, uid(), false);
  await db.exec('set constraints all immediate');
  const oldAfter = (await counters()).activity;
  ok(oldAfter.tuple !== oldCommon.tuple && Number(oldAfter.teacher_revision) - Number(oldCommon.teacher_revision) === 2, 'Base: respuesta automática escribe dos veces la fila docente compartida');
  await db.exec('rollback');
  await admin();
  const sql = await fs.readFile(`supabase/migrations/${migration}`, 'utf8');
  report.migrationSha256 = crypto.createHash('sha256').update(sql).digest('hex');
  await db.exec(sql);
  for (const name of ['teacher', 'a', 'b']) ok((await snapshot(name)) === beforeViews[name], `Migración conserva snapshot completo ${name}`);
  for (const name of ['a', 'b']) ok((await sync(name)) === beforeHashes[name], `Migración conserva huella estudiantil ${name}`);
  const initialTeacher = await sync('teacher');
  ok(initialTeacher === await sync('teacher'), 'Agregado docente estable sin cambios');
  ok(initialTeacher !== beforeHashes.teacher, 'Cambio único de formato de huella docente al migrar');

  const request = uid(), beforeAnswer = await counters();
  const beforeA = await sync('a'), beforeB = await sync('b');
  await actor(users.a);
  const ack = await command('submitAnswer', attempts.a.id, questions[0].id, { type: 'single', optionId: questions[0].correctOptionId }, request, false);
  const afterAnswer = await counters();
  ok(JSON.stringify(afterAnswer.activity) === JSON.stringify(beforeAnswer.activity), 'Respuesta no escribe la fila técnica de actividad');
  const changed = afterAnswer.participants.filter((row, i) => row.tuple !== beforeAnswer.participants[i].tuple);
  ok(changed.length === 1, 'Respuesta escribe solo la fila técnica del participante autor');
  const oldParticipant = beforeAnswer.participants.find(row => row.participant_id === changed[0].participant_id);
  ok(Number(changed[0].teacher_revision) - Number(oldParticipant.teacher_revision) === 2 && Number(changed[0].student_revision) - Number(oldParticipant.student_revision) === 1, 'Respuesta automática incrementa dos revisiones docentes propias y una estudiantil');
  ok(await sync('teacher') !== initialTeacher && await sync('a') !== beforeA && await sync('b') === beforeB, 'Respuesta invalida docente y autor sin invalidar otro estudiante');
  ok(ack.attempt.answers.length === 1 && ack.feedback === null && !JSON.stringify(ack).includes('SOLUCION_RESERVADA'), 'ACK conserva respuesta y oculta solución');
  const beforeRetry = await counters(), hashRetry = await sync('teacher');
  await actor(users.a);
  assert.deepEqual(await command('submitAnswer', attempts.a.id, questions[0].id, { type: 'single', optionId: questions[0].correctOptionId }, request, false), ack);
  ok(JSON.stringify(await counters()) === JSON.stringify(beforeRetry) && await sync('teacher') === hashRetry, 'Reintento idempotente conserva ACK y no escribe contadores');
  await actor(users.a);
  await command('submitAnswer', attempts.a.id, questions[1].id, { type: 'single', optionId: questions[1].correctOptionId }, uid(), false);
  const studentView = await snapshot('a'), privateA = await sync('a'), privateB = await sync('b'), privateTeacher = await sync('teacher'), privateCounters = await counters();
  await actor(users.teacher);
  await command('reviewAnswer', attempts.a.id, questions[0].id, 3, 'Revisión privada', 'Corrección aislada');
  ok(await sync('teacher') !== privateTeacher && await sync('a') === privateA && await sync('b') === privateB, 'Corrección privada solo invalida al docente');
  ok(await snapshot('a') === studentView, 'Corrección privada conserva proyección estudiantil');
  ok(JSON.stringify((await counters()).activity) === JSON.stringify(privateCounters.activity), 'Corrección privada no escribe contador común');
  await actor(users.teacher);
  await command('publishGrade', activity.id, users.a, 'Resultado publicado', 'Primera publicación');
  ok(await sync('a') !== privateA && await sync('b') === privateB, 'Publicación invalida solo al estudiante correspondiente');
  const published = JSON.parse(await snapshot('a'));
  ok(published.state.evaluations.length === 1 && published.state.evaluations[0].grade === 80, 'Publicación expone la nota correcta y autorizada');

  const teacherBeforeJoin = await sync('teacher'), studentBeforeJoin = await sync('a');
  await admin();
  const participant = uid();
  await db.query('insert into app.participants(id,activity_id,membership_id,alias_no) values($1,$2,$3,99)', [participant, activity.id, memberships.late]);
  ok(await sync('teacher') !== teacherBeforeJoin && await sync('a') === studentBeforeJoin, 'Participante nuevo invalida docente sin revelar cambio a otro estudiante');
  const beforeDelete = await counters(), teacherBeforeDelete = await sync('teacher');
  await admin();
  await db.query('delete from app.participants where id=$1', [participant]);
  const afterDelete = await counters();
  ok(Number(afterDelete.activity.teacher_revision) > Number(beforeDelete.activity.teacher_revision) && afterDelete.participants.length === beforeDelete.participants.length - 1, 'Borrado de participante incrementa revisión común y elimina metadatos derivados');
  ok(await sync('teacher') !== teacherBeforeDelete && await sync('a') === studentBeforeJoin, 'Borrado invalida docente sin alterar huella estudiantil ajena');
  await admin();
  const replacement = uid();
  await db.query('insert into app.participants(id,activity_id,membership_id,alias_no) values($1,$2,$3,99)', [replacement, activity.id, memberships.late]);
  await db.query('update app.activity_sync_versions set teacher_revision=$2 where activity_id=$1', [activity.id, beforeDelete.activity.teacher_revision]);
  ok(await sync('teacher') !== teacherBeforeDelete, 'Identidad del agregado distingue reemplazo con igual contador y marca común');

  const commonA = await sync('a'), commonB = await sync('b');
  await admin();
  await db.query('select app.bump_sync_revision($1,$2,true,false)', [activity.id, replacement]);
  ok(await sync('a') !== commonA && await sync('b') !== commonB, 'Cambio público conserva invalidación común para ambos estudiantes');
  await admin();
  const missingBefore = (await counters()).activity;
  await db.query('select app.bump_sync_revision($1,$2,false,false)', [activity.id, uid()]);
  ok(Number((await counters()).activity.teacher_revision) === Number(missingBefore.teacher_revision) + 1, 'Participante ausente conserva fallback de revisión común');
  await actor(users.otherTeacher);
  await denies(() => rows('select public.aulify_sync($1)', [activity.id]), 'Docente ajeno no accede a huella');
  await actor(users.unapproved);
  await denies(() => rows('select public.aulify_sync($1)', [activity.id]), 'Estudiante no aprobado no accede a huella');
  await actor(users.a);
  await denies(() => rows('select * from app.participant_sync_versions'), 'Estudiante no lee contadores privados');
  await denies(() => rows('select app.bump_sync_revision($1,$2,false,false)', [activity.id, replacement]), 'Cliente no ejecuta helper privado');
  await db.exec('set role anon');
  await denies(() => rows('select public.aulify_sync($1)', [activity.id]), 'Anónimo no ejecuta sincronización');
  await admin();
  await db.query("update app.memberships set status='withdrawn' where id=$1", [memberships.b]);
  await actor(users.b);
  await denies(() => rows('select public.aulify_sync($1)', [activity.id]), 'Retiro revoca acceso independientemente del contador');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { code: error.code ?? error.name, message: error.message };
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.limitations = ['No mide concurrencia, bloqueo entre sesiones, red, PostgREST, CPU remota ni latencia Q-06.', 'Las comprobaciones de escrituras usan la identidad física de filas en una base aislada; no sustituyen un ensayo simultáneo.', 'El caso de reemplazo ajusta de forma administrativa la marca común únicamente para aislar la propiedad del agregado con identidad.'];
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure }));
  await db.close();
}
