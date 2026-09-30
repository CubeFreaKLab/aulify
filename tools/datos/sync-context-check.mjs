import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Base nueva en memoria. No lee .env ni usa Auth, HTTP o una base remota.
const migration = '20260930005228_aulify_sync_context_reads.sql';
const reportPath = 'docs/verificacion/datos-sync-contexto-local.json';
const report = { startedAt: new Date().toISOString(), migration, environment: 'PGlite aislado; sin red ni concurrencia real.', checks: [] };
report.scriptSha256 = crypto.createHash('sha256').update(await fs.readFile('tools/datos/sync-context-check.mjs')).digest('hex');
const db = new PGlite();
const uid = () => crypto.randomUUID();
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const admin = () => db.exec('reset role');
const actor = async (id, role = 'authenticated') => {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
};
const command = async (action, ...args) => (await rows('select public.aulify_command($1,$2) value', [action, { args }]))[0].value;
const ok = (condition, name) => { assert.ok(condition, name); report.checks.push({ name, result: 'passed' }); };
const normalize = value => { const result = structuredClone(value); delete result.serverTime; return result; };
const functions = ['app.activity_sync(uuid)', 'public.aulify_sync(uuid)'];
const acl = async () => rows("select oid::regprocedure::text name,prosecdef,proconfig,proacl::text from pg_proc where oid=any($1::regprocedure[]) order by 1", [functions]);
let users, activity;

async function outcome(fn, id) {
  await db.exec('savepoint call_result');
  try {
    const value = (await rows(`select public.${fn}($1) value`, [id]))[0].value;
    await db.exec('release savepoint call_result');
    return { value };
  } catch (error) {
    await db.exec('rollback to savepoint call_result; release savepoint call_result');
    return { code: error.code, message: error.message.replaceAll('aulify_sync_baseline', 'aulify_sync') };
  }
}

async function compare(name, user, { id = activity.id, setup, code, deadline } = {}) {
  await admin();
  await db.exec('begin');
  try {
    const txTime = (await rows('select now()::text value'))[0].value;
    if (setup) await setup(txTime);
    await db.exec('set constraints all immediate');
    await actor(users[user], user === 'anonymous' ? 'anon' : 'authenticated');
    const baseline = await outcome('aulify_sync_baseline', id);
    const candidate = await outcome('aulify_sync', id);
    if (baseline.code || candidate.code) {
      assert.deepEqual(candidate, baseline, `${name}: rechazo equivalente`);
      assert.equal(candidate.code, code ?? '42501', `${name}: código de rechazo`);
    } else {
      assert.equal(code, undefined, `${name}: se esperaba rechazo`);
      assert.deepEqual(normalize(candidate.value), normalize(baseline.value), `${name}: JSON completo salvo reloj de ejecución`);
      assert.ok(Number.isFinite(Date.parse(candidate.value.serverTime)), `${name}: reloj válido`);
      assert.ok(Date.parse(candidate.value.serverTime) >= Date.parse(baseline.value.serverTime), `${name}: reloj no retrocede`);
      if (deadline !== undefined) assert.equal(candidate.value.nextDeadline, typeof deadline === 'function' ? deadline(txTime) : deadline, `${name}: plazo esperado`);
    }
    ok(true, name);
    return candidate.value;
  } finally {
    await db.exec('rollback');
  }
}

try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
    alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
  const migrations = (await fs.readdir('supabase/migrations')).filter(name => name.endsWith('.sql') && name <= '20260930000631_aulify_teacher_review_projection.sql').sort();
  assert.equal(migrations.length, 18, 'Base esperada: 18 migraciones');
  for (const name of migrations) await db.exec(await fs.readFile(`supabase/migrations/${name}`, 'utf8'));
  report.baselineMigrations = migrations;
  const baseline = (await rows("select pg_get_functiondef('app.activity_sync(uuid)'::regprocedure) value"))[0].value;
  report.baselineFunctionSha256 = crypto.createHash('sha256').update(baseline).digest('hex');
  await db.exec(baseline.replace('FUNCTION app.activity_sync(', 'FUNCTION app.activity_sync_baseline('));
  await db.exec(`create function public.aulify_sync_baseline(p_activity_id uuid) returns jsonb language sql security invoker set search_path='' as $$select app.activity_sync_baseline(p_activity_id)$$;
    revoke all on function app.activity_sync_baseline(uuid),public.aulify_sync_baseline(uuid) from public,anon,authenticated;
    grant execute on function app.activity_sync_baseline(uuid),public.aulify_sync_baseline(uuid) to authenticated;`);
  users = Object.fromEntries(['teacher', 'otherTeacher', 'a', 'b', 'noParticipant', 'withdrawn', 'unapproved', 'unconfirmed', 'noProfile'].map(name => [name, uid()]));
  for (const [name, id] of Object.entries(users)) await db.query('insert into auth.users values($1,$2,$3,$4)', [id, `${name}@example.test`, name === 'unconfirmed' ? null : new Date(), { name, role: name === 'teacher' || name === 'otherTeacher' ? 'teacher' : 'student' }]);
  await db.query('delete from app.profiles where id=$1', [users.noProfile]);
  await actor(users.teacher);
  const subject = await command('createSubject', { name: 'Sondeo aislado', course: '3.º', year: 2026, description: 'Datos ficticios' });
  await admin();
  const memberships = {};
  for (const name of ['a', 'b', 'noParticipant', 'withdrawn']) memberships[name] = (await rows('insert into app.memberships(subject_id,student_id,status) values($1,$2,$3) returning id', [subject.id, users[name], name === 'withdrawn' ? 'withdrawn' : 'approved']))[0].id;
  await actor(users.teacher);
  const questions = Array.from({ length: 2 }, (_, i) => {
    const correct = uid();
    return { id: uid(), type: 'single', prompt: `Pregunta ${i + 1}`, points: 5, options: [{ id: correct, text: 'Primera' }, { id: uid(), text: 'Segunda' }], correctOptionId: correct, explanation: 'SOLUCION_RESERVADA' };
  });
  const resource = { id: uid(), title: 'Recurso aislado', kind: 'quiz', blocks: [{ id: uid(), type: 'quiz', questions }], revision: 1 };
  await command('saveDraft', resource, 0);
  const version = await command('publishResource', resource.id);
  const settings = { purpose: 'practice', pace: 'individual', maxGrade: 100, weight: 1, countsTowardAverage: true, maxAttempts: 2, opensAt: new Date(Date.now() - 60000).toISOString(), closesAt: new Date(Date.now() + 3600000).toISOString(), timeLimitMinutes: null, timeZone: 'America/La_Paz', feedback: 'hidden', manualCorrection: false, shuffleQuestions: false, shuffleOptions: false, streaks: false, sound: false, ranking: false, teams: false, allowHint: false, allowDouble: false, bonusAffectsGrade: false, reportVisibility: true };
  activity = await command('createActivity', version.id, subject.id, settings, 'Quiz principal');
  const empty = await command('createActivity', version.id, subject.id, settings, 'Sin participantes');
  const reading = await command('publishReading', version.id, subject.id);
  const attempts = {};
  for (const name of ['a', 'b']) { await actor(users[name]); attempts[name] = await command('startAttempt', activity.id); }
  await admin();
  const participant = (await rows('select id from app.participants where activity_id=$1 and membership_id=$2', [activity.id, memberships.a]))[0].id;
  const beforeAcl = await acl();
  const candidate = await fs.readFile(`supabase/migrations/${migration}`, 'utf8');
  report.migrationSha256 = crypto.createHash('sha256').update(candidate).digest('hex');
  await db.exec(candidate);
  assert.deepEqual(await acl(), beforeAcl);
  ok(true, 'Conserva ACL, SECURITY DEFINER/INVOKER y search_path');
  ok(!/for\s+(update|share)|\b(insert|delete|update)\s+(into|from|app\.)/i.test(candidate), 'No introduce escrituras ni bloqueos de fila');

  for (const name of ['teacher', 'a', 'b', 'noParticipant']) await compare(`Quiz sin duración: ${name}`, name);
  for (const name of ['teacher', 'a']) await compare(`Actividad sin participantes: ${name}`, name, { id: empty.id });
  for (const name of ['otherTeacher', 'withdrawn', 'unapproved', 'unconfirmed', 'noProfile', 'missingIdentity', 'anonymous']) await compare(`Permiso denegado: ${name}`, name, { code: '42501' });
  for (const name of ['teacher', 'a']) {
    await compare(`Actividad inexistente: ${name}`, name, { id: uid(), code: '42501' });
    await compare(`Actividad no quiz: ${name}`, name, { id: reading.id, code: '42501' });
  }

  const scenarios = [
    ['Propietario también participante', async () => {
      const membership = (await rows("insert into app.memberships(subject_id,student_id,status) values($1,$2,'approved') returning id", [subject.id, users.teacher]))[0].id;
      await db.query('insert into app.participants(activity_id,membership_id,alias_no) values($1,$2,88)', [activity.id, membership]);
    }],
    ['Sin publicar', () => db.query('update app.activities set published_at=null where id=$1', [activity.id]), true],
    ['Materia archivada', () => db.query('update app.subjects set archived_at=now() where id=$1', [subject.id]), true],
    ['Materia en purga', () => db.query('update app.subjects set purge_started_at=now() where id=$1', [subject.id]), true],
    ['Sin contador común', () => db.query('delete from app.activity_sync_versions where activity_id=$1', [activity.id])],
    ['Sin contador propio', () => db.query('delete from app.participant_sync_versions where participant_id=$1', [participant])],
    ['Sin ajustes opcionales', () => db.query('delete from app.quiz_settings where activity_id=$1', [activity.id])],
    ['Sin cierre', () => db.query('update app.activities set closes_at=null where id=$1', [activity.id])],
    ['Antes de apertura', () => db.query("update app.activities set opens_at=now()+interval '10 minutes',closes_at=now()+interval '1 hour' where id=$1", [activity.id])],
    ['Instante de apertura', () => db.query("update app.activities set opens_at=now(),closes_at=now()+interval '1 hour' where id=$1", [activity.id])],
    ['Instante de cierre', () => db.query("update app.activities set opens_at=now()-interval '1 hour',closes_at=now() where id=$1", [activity.id])],
    ['Cierre vencido', () => db.query("update app.activities set opens_at=now()-interval '2 hours',closes_at=now()-interval '1 hour' where id=$1", [activity.id])],
    ['Duración sin ampliaciones', () => db.query('update app.quiz_settings set duration_seconds=300 where activity_id=$1', [activity.id])],
    ['Duración sin cierre común', async () => { await db.query('update app.quiz_settings set duration_seconds=300 where activity_id=$1', [activity.id]); await db.query('update app.activities set closes_at=null where id=$1', [activity.id]); }],
    ['Ampliaciones comunes y personales', async () => {
      await db.query('update app.quiz_settings set duration_seconds=300 where activity_id=$1', [activity.id]);
      await db.query("insert into app.deadline_extensions(activity_id,participant_id,new_deadline,actor_id,reason) values($1,null,now()+interval '2 hours',$3,'Común1'),($1,null,now()+interval '3 hours',$3,'Común2'),($1,$2,now()+interval '20 minutes',$3,'Personal1'),($1,$2,now()+interval '30 minutes',$3,'Personal2')", [activity.id, participant, users.teacher]);
    }],
    ['Ampliación no limita intento sin duración', () => db.query("insert into app.deadline_extensions(activity_id,participant_id,new_deadline,actor_id,reason) values($1,$2,now()+interval '30 minutes',$3,'Personal')", [activity.id, participant, users.teacher])],
    ['Ningún intento abierto con duración', async () => {
      await db.query('update app.quiz_settings set duration_seconds=300 where activity_id=$1', [activity.id]);
      await db.query("update app.attempts set closed_at=now(),close_reason='deadline' where id=any($1::uuid[])", [[attempts.a.id, attempts.b.id]]);
    }],
  ];
  for (const [name, setup, studentDenied] of scenarios) {
    for (const role of ['teacher', 'a', 'noParticipant']) await compare(`${name}: ${role}`, role, { setup, ...(studentDenied && role !== 'teacher' ? { code: '42501' } : {}) });
  }

  const initial = {};
  for (const name of ['teacher', 'a', 'b']) initial[name] = await compare(`Huella inicial: ${name}`, name);
  await actor(users.a);
  const key = uid();
  await command('submitAnswer', attempts.a.id, questions[0].id, { type: 'single', optionId: questions[0].correctOptionId }, key, false);
  const answer = {};
  for (const name of ['teacher', 'a', 'b']) answer[name] = await compare(`Tras respuesta: ${name}`, name);
  ok(answer.teacher.revision !== initial.teacher.revision && answer.a.revision !== initial.a.revision && answer.b.revision === initial.b.revision, 'Respuesta invalida solo docente y autor');
  await actor(users.a);
  await command('submitAnswer', attempts.a.id, questions[0].id, { type: 'single', optionId: questions[0].correctOptionId }, key, false);
  ok((await compare('Reintento idempotente', 'a')).revision === answer.a.revision, 'Reintento conserva huella');
  await actor(users.a);
  await command('submitAnswer', attempts.a.id, questions[1].id, { type: 'single', optionId: questions[1].correctOptionId }, uid(), false);
  const beforePrivate = {};
  for (const name of ['teacher', 'a', 'b']) beforePrivate[name] = await compare(`Antes de revisión privada: ${name}`, name);
  await actor(users.teacher);
  await command('reviewAnswer', attempts.a.id, questions[0].id, 3, 'Comentario privado', 'Corrección aislada');
  const privateReview = {};
  for (const name of ['teacher', 'a', 'b']) privateReview[name] = await compare(`Tras revisión privada: ${name}`, name);
  ok(privateReview.teacher.revision !== beforePrivate.teacher.revision && privateReview.a.revision === beforePrivate.a.revision && privateReview.b.revision === beforePrivate.b.revision, 'Revisión privada no modifica huellas estudiantiles');
  await actor(users.teacher);
  await command('publishGrade', activity.id, users.a, 'Resultado publicado', 'Primera publicación');
  const publishedA = await compare('Publicación de nota: autor', 'a');
  const publishedB = await compare('Publicación de nota: compañero', 'b');
  await compare('Publicación de nota: docente', 'teacher');
  ok(publishedA.revision !== privateReview.a.revision && publishedB.revision === privateReview.b.revision, 'Publicación invalida solo al estudiante destinatario');

  await admin();
  const replacement = uid();
  await db.query('insert into app.participants(id,activity_id,membership_id,alias_no) values($1,$2,$3,99)', [replacement, activity.id, memberships.noParticipant]);
  const beforeDelete = await compare('Participante incorporado: docente', 'teacher');
  await compare('Participante sin intento: estudiante', 'noParticipant');
  await admin();
  await db.query('delete from app.participants where id=$1', [replacement]);
  const afterDelete = await compare('Participante eliminado: docente', 'teacher');
  await compare('Participante eliminado: estudiante', 'noParticipant');
  ok(beforeDelete.revision !== afterDelete.revision, 'Borrado conserva invalidación docente');
  await admin();
  await db.query('insert into app.participants(activity_id,membership_id,alias_no) values($1,$2,99)', [activity.id, memberships.noParticipant]);
  const reinserted = await compare('Participante reinsertado: docente', 'teacher');
  ok(reinserted.revision !== afterDelete.revision, 'Reinserción conserva identidad en la huella docente');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { code: error.code ?? error.name, message: error.message };
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.limitations = [
    'Compara las funciones sobre el mismo estado y dentro de la misma transacción para fijar now(); clock_timestamp se valida por separado.',
    'No mide PostgreSQL remoto, plan de producción, espera del pool, concurrencia, red, carga ni Q-06.',
    'La candidata solo agrupa lecturas del polling; no demuestra que fueran la causa del p95 observado.',
  ];
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ path: reportPath, status: report.status, checks: report.checks.length, failure: report.failure }));
  await db.close();
}
