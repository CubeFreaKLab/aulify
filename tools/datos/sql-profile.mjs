import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PGlite } from '@electric-sql/pglite';
process.on('unhandledRejection', error => { console.error(`FAIL ${error.message}\n${error.where ?? ''}`); process.exit(1); });

// Perfil reproducible exclusivamente en memoria. No lee .env ni abre conexiones.
const db = new PGlite();
const startedAt = new Date().toISOString();
const lastMigration = '20260928083904_aulify_private_lock_revision.sql';
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
const summarize = values => ({ samples: values.length, p50Ms: percentile(values, 0.5), p95Ms: percentile(values, 0.95), minimumMs: Math.min(...values), maximumMs: Math.max(...values) });
const measure = async (sql, args, n = 30) => {
  for (let i = 0; i < 4; i++) await db.query(sql, args);
  const elapsed = [];
  for (let i = 0; i < n; i++) { const start = performance.now(); await db.query(sql, args); elapsed.push(performance.now() - start); }
  const value = (await query(sql, args))[0]?.value;
  return { ...summarize(elapsed), jsonBytes: value === undefined ? null : Buffer.byteLength(JSON.stringify(value)) };
};
const results = { startedAt, environment: 'PGlite 0.5.8 en memoria; un solo proceso, sin red y sin concurrencia', migrations, fixture: { teachers: 1, foreignTeachers: 1, students: 50, questions: 10, attempts: 50, answersPerAttempt: 8, storedAnswers: 400, feedback: 'hidden', duration: null }, components: {}, stages: {}, writes: {}, checks: [] };
const assert = (ok, label) => { if (!ok) throw new Error(label); results.checks.push({ case: label, passed: true }); };
// Los componentes internos se miden como postgres con auth.uid configurado;
// las rutas completas se miden como authenticated, con sus permisos reales.
await as(teacher);
const components = {
  teacherAttempts50: ['select jsonb_agg(app.attempt_json(at.id,true)) value from app.attempts at join app.participants p on p.id=at.participant_id where p.activity_id=$1', [activity.id]],
  expiryScan50: ['select array_agg(at.id) value from app.attempts at join app.participants p on p.id=at.participant_id where p.activity_id=$1 and at.closed_at is null and app.deadline($1,p.id,at.started_at)<=now()', [activity.id]],
  teacherVersion: ['select app.version_json($1,true) value', [version.id]],
  studentVersion: ['select app.version_json($1,false) value', [version.id]],
  studentAttempt: ['select app.attempt_json($1,false) value', [attempts[0]]],
  scoreSingleAnswer: ['select app.score_answer(id,$2) value from app.attempt_questions where attempt_id=$1 and question_key=$3', [attempts[0], { type: 'single', optionId: questions[8].correctOptionId }, questions[8].id]],
};
for (const [key, [sql, args]] of Object.entries(components)) results.components[key] = await measure(sql, args);
await as(students[0]);
results.components.studentProjection = await measure('select app.student_activity($1) value', [activity.id]);
results.components.presentQuestions10 = await measure('select jsonb_agg(app.present_question(version_id,question_key,$2) order by position) value from app.questions where version_id=$1', [version.id, attempts[0]]);

const normalize = value => { const copy = structuredClone(value); delete copy.serverTime; if (copy.state) { delete copy.state.revision; copy.state.attempts.sort((a, b) => a.id.localeCompare(b.id)); } return JSON.stringify(copy); };
const views = {};
async function wholeStage(stage) {
  await db.exec('set role authenticated'); results.stages[stage] = {};
  for (const [role, user] of [['student', students[0]], ['teacher', teacher]]) {
    await as(user);
    for (const [name, sql] of [['sync', 'select public.aulify_sync($1) value'], ['snapshot', 'select public.aulify_activity_snapshot($1) value']]) {
      results.stages[stage][`${role}_${name}`] = await measure(sql, [activity.id]);
      views[`${stage}_${role}_${name}`] = normalize((await query(sql, [activity.id]))[0].value);
    }
  }
  await db.exec('reset role');
}
await wholeStage('baseline');

// Medir también los triggers diferidos. ROLLBACK conserva el mismo escenario.
await as(students[0]);
for (const finalAnswer of [false, true]) {
  const timings = [], commands = [], deferred = []; let deltas;
  for (let i = 0; i < 34; i++) {
    await db.exec('begin');
    if (finalAnswer) await command('submitAnswer', attempts[0], questions[8].id, { type: 'single', optionId: questions[8].correctOptionId }, uuid(), false);
    await db.exec('set constraints all immediate; set constraints all deferred');
    const before = (await query('select teacher_revision from app.activity_sync_versions where activity_id=$1', [activity.id]))[0];
    const q = questions[finalAnswer ? 9 : 8], req = uuid();
    await db.exec('set local role authenticated');
    const start = performance.now();
    await command('submitAnswer', attempts[0], q.id, { type: 'single', optionId: q.correctOptionId }, req, false);
    const acknowledged = performance.now(); await db.exec('set constraints all immediate'); const end = performance.now();
    if (i >= 4) { timings.push(end - start); commands.push(acknowledged - start); deferred.push(end - acknowledged); }
    await db.exec('reset role');
    const after = (await query('select teacher_revision from app.activity_sync_versions where activity_id=$1', [activity.id]))[0];
    deltas = Number(after.teacher_revision) - Number(before.teacher_revision);
    if (i === 33) {
      await db.exec('set local role authenticated');
      await command('submitAnswer', attempts[0], q.id, { type: 'single', optionId: q.correctOptionId }, req, false);
      await db.exec('set constraints all immediate; reset role');
      const replay = (await query('select teacher_revision from app.activity_sync_versions where activity_id=$1', [activity.id]))[0];
      assert(replay.teacher_revision === after.teacher_revision, `Reintento ${finalAnswer ? 'final' : 'ordinario'} no incrementa revisión`);
    }
    await db.exec('rollback');
  }
  results.writes[finalAnswer ? 'lastAnswer' : 'ordinaryAnswer'] = { totalIncludingDeferred: summarize(timings), commandBeforeDeferred: summarize(commands), deferredFlush: summarize(deferred), sharedTeacherRevisionIncrements: deltas };
}

// Prototipo A exclusivamente local: evita calcular el digest solo para autorizar.
const originalSnapshotSql = (await query("select pg_get_functiondef('app.activity_snapshot(uuid)'::regprocedure) value"))[0].value;
const originalSyncSql = (await query("select pg_get_functiondef('app.activity_sync(uuid)'::regprocedure) value"))[0].value;
let snapshotSql = originalSnapshotSql;
snapshotSql = snapshotSql.replace('perform app.activity_sync(p_activity_id);', '')
  .replace('teacher:=s.owner_id=u;', `teacher:=s.owner_id=u;
 if a.id is null or a.kind<>'quiz' or not coalesce(teacher,false) and
  (a.published_at is null or s.archived_at is not null or s.purge_started_at is not null or
   not exists(select 1 from app.memberships where subject_id=s.id and student_id=u and status='approved')) then
  raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';
 end if;`);
await db.exec(snapshotSql);
await wholeStage('authOnlyPrototype');
for (const role of ['student', 'teacher']) for (const name of ['sync', 'snapshot']) assert(views[`baseline_${role}_${name}`] === views[`authOnlyPrototype_${role}_${name}`], `Prototipo A conserva ${role} ${name}, omitiendo solo reloj de transporte`);

// Prototipo B local: una lectura de contexto sustituye seis lecturas separadas.
await db.exec(`create or replace function app.activity_sync(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=app.require_user(); x record; owner boolean; common_deadline timestamptz; next_deadline timestamptz;
begin
 select ac.*,su.owner_id,su.archived_at,su.purge_started_at,m.status membership_status,
  pa.id participant_id,qs.duration_seconds,v.public_revision,v.teacher_revision,pv.student_revision into x
 from app.activities ac join app.subjects su on su.id=ac.subject_id
 left join app.quiz_settings qs on qs.activity_id=ac.id
 left join app.memberships m on m.subject_id=ac.subject_id and m.student_id=u
 left join app.participants pa on pa.activity_id=ac.id and pa.membership_id=m.id
 left join app.activity_sync_versions v on v.activity_id=ac.id
 left join app.participant_sync_versions pv on pv.participant_id=pa.id where ac.id=p_activity_id;
 owner:=x.owner_id=u;
 if x.id is null or x.kind<>'quiz' or not coalesce(owner,false) and
  (x.published_at is null or x.archived_at is not null or x.purge_started_at is not null or x.membership_status is distinct from 'approved') then
  raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';
 end if;
 select greatest(x.closes_at,max(new_deadline)) into common_deadline from app.deadline_extensions where activity_id=x.id and participant_id is null;
 next_deadline:=common_deadline;
 if x.duration_seconds is not null then
  select least(common_deadline,min(greatest(at.started_at+make_interval(secs=>x.duration_seconds),e.personal_deadline))) into next_deadline
  from app.attempts at join app.participants pa on pa.id=at.participant_id
  left join lateral(select max(new_deadline) personal_deadline from app.deadline_extensions where participant_id=pa.id) e on true
  where pa.activity_id=x.id and at.closed_at is null and (owner or pa.id=x.participant_id);
 end if;
 if x.opens_at>now() then next_deadline:=least(next_deadline,x.opens_at); end if;
 return jsonb_build_object('revision',md5(jsonb_build_array(u,x.id,coalesce(x.public_revision,0),
  case when owner then coalesce(x.teacher_revision,0) else coalesce(x.student_revision,0) end,
  now()>=x.opens_at,next_deadline,now()>=next_deadline)::text),'serverTime',clock_timestamp(),'nextDeadline',next_deadline);
end $$;`);
await wholeStage('combinedContextPrototype');
for (const role of ['student', 'teacher']) for (const name of ['sync', 'snapshot']) assert(views[`baseline_${role}_${name}`] === views[`combinedContextPrototype_${role}_${name}`], `Prototipo B conserva ${role} ${name}, omitiendo solo reloj de transporte`);
for (const user of [other, uuid()]) {
  await db.exec('set role authenticated'); await as(user);
  for (const fn of ['aulify_sync', 'aulify_activity_snapshot']) {
    let rejected = false;
    try { await db.query(`select public.${fn}($1)`, [activity.id]); } catch (error) { rejected = error.code === '42501'; }
    assert(rejected, `${fn} deniega ${user === other ? 'docente ajeno' : 'perfil inexistente'} en prototipo`);
  }
  await db.exec('reset role');
}
// Prototipo C: agregados por conjuntos para los 50 intentos de la vista docente.
await db.exec(await fs.readFile('tools/datos/profile-attempts-setbased.sql', 'utf8'));
const snapshotDefinition = (await query("select pg_get_functiondef('app.activity_snapshot(uuid)'::regprocedure) value"))[0].value;
const oldAggregate = "select coalesce(jsonb_agg(app.attempt_json(at.id,teacher)),'[]') into attempts from app.attempts at join app.participants pa on pa.id=at.participant_id join app.memberships m on m.id=pa.membership_id where pa.activity_id=a.id and (teacher or m.student_id=u);";
if (!snapshotDefinition.includes(oldAggregate)) throw new Error('No se encontró el agregado original del snapshot.');
await db.exec(snapshotDefinition.replace(oldAggregate, 'attempts:=app.profile_attempts_json(a.id,teacher,u);'));
await wholeStage('setBasedAttemptsPrototype');
for (const role of ['student', 'teacher']) for (const name of ['sync', 'snapshot']) assert(views[`baseline_${role}_${name}`] === views[`setBasedAttemptsPrototype_${role}_${name}`], `Prototipo C conserva ${role} ${name}, omitiendo reloj y orden no contractual de intentos`);
await as(teacher);
results.components.setBasedTeacherAttempts50 = await measure('select app.profile_attempts_json($1,true,$2) value', [activity.id, teacher]);
// Un solo intento no amortiza los CTE; conservar su lectura original.
await db.exec(snapshotDefinition.replace(oldAggregate, `if teacher then attempts:=app.profile_attempts_json(a.id,true,u); else ${oldAggregate} end if;`));
await wholeStage('teacherOnlySetBasedPrototype');
for (const role of ['student', 'teacher']) for (const name of ['sync', 'snapshot']) assert(views[`baseline_${role}_${name}`] === views[`teacherOnlySetBasedPrototype_${role}_${name}`], `Prototipo D conserva ${role} ${name}, omitiendo reloj y orden no contractual de intentos`);
// Comparación final mínima: retirar A/B y conservar únicamente el cambio docente.
await db.exec(originalSyncSql);
await db.exec(originalSnapshotSql.replace(oldAggregate, `if teacher then attempts:=app.profile_attempts_json(a.id,true,u); else ${oldAggregate} end if;`));
await wholeStage('recommendedPrototype');
for (const role of ['student', 'teacher']) for (const name of ['sync', 'snapshot']) assert(views[`baseline_${role}_${name}`] === views[`recommendedPrototype_${role}_${name}`], `Propuesta mínima conserva ${role} ${name}, omitiendo reloj y orden no contractual de intentos`);
results.finishedAt = new Date().toISOString();
results.limitations = ['No mide contención, conexiones, PostgREST, Auth, red ni Next.js.', 'Las propuestas solo se aplican al proceso PGlite; no son migraciones desplegables ni sustituyen los ensayos de seguridad completos.', 'El conjunto ficticio tiene respuestas automáticas, un intento por alumno y ocho respuestas de diez; otros volúmenes y revisiones pueden cambiar los costos.', 'La descarga JSON incluye la serialización y comunicación local de PGlite; no es tiempo exclusivo del motor PostgreSQL.', 'Las fases se ejecutan secuencialmente; sus diferencias pequeñas no prueban una mejora causal en producción.'];
await fs.writeFile('docs/verificacion/datos-perfil-sql-aislado.json', JSON.stringify(results, null, 2) + '\n');
for (const [key, value] of Object.entries(results.components)) console.log(`Componente ${key}: p50=${value.p50Ms.toFixed(2)}ms p95=${value.p95Ms.toFixed(2)}ms`);
for (const [stage, values] of Object.entries(results.stages)) for (const [key, value] of Object.entries(values)) console.log(`${stage} ${key}: p50=${value.p50Ms.toFixed(2)}ms p95=${value.p95Ms.toFixed(2)}ms`);
for (const [key, value] of Object.entries(results.writes)) console.log(`${key}: p95=${value.totalIncludingDeferred.p95Ms.toFixed(2)}ms; contadores compartidos=${value.sharedTeacherRevisionIncrements}`);
console.log(`${results.checks.length} comprobaciones de equivalencia/rechazo aprobadas; sin tráfico remoto.`);
await db.close();
