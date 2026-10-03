import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const report = {
  startedAt: new Date().toISOString(),
  environment: 'PGlite aislado, sin red',
  checks: [],
};
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const actor = async (id) => {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
};
const cmd = async (action, ...args) =>
  (await rows('select public.aulify_command($1,$2) value', [action, { args }]))[0].value;
const sync = async (activity) =>
  (await rows('select public.aulify_sync($1) value', [activity]))[0].value.revision;
const ok = (condition, name) => {
  assert.ok(condition, name);
  report.checks.push({ name, status: 'passed' });
};
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
    alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
  const migrations = (await fs.readdir('supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const name of migrations)
    await db.exec(await fs.readFile('supabase/migrations/' + name, 'utf8'));
  report.migrations = migrations;
  const users = { teacher: randomUUID(), student: randomUUID(), peer: randomUUID() };
  for (const [role, id] of Object.entries(users))
    await db.query('insert into auth.users values($1,$2,now(),$3)', [
      id,
      role + '@example.test',
      { name: role, role: role === 'teacher' ? 'teacher' : 'student' },
    ]);
  await actor(users.teacher);
  const subject = await cmd('createSubject', { name: 'Acuses de prueba', course: '3', year: 2026 });
  await db.exec('reset role');
  for (const id of [users.student, users.peer])
    await db.query(
      "insert into app.memberships(subject_id,student_id,status) values($1,$2,'approved')",
      [subject.id, id],
    );
  await actor(users.teacher);
  const question = {
    id: randomUUID(),
    type: 'single',
    prompt: 'Pregunta',
    points: 5,
    options: [
      { id: randomUUID(), text: 'Una' },
      { id: randomUUID(), text: 'Dos' },
    ],
    explanation: 'SOLUCION_RESERVADA',
  };
  question.correctOptionId = question.options[0].id;
  const resource = {
    id: randomUUID(),
    title: 'Dos preguntas',
    kind: 'quiz',
    revision: 1,
    blocks: [
      {
        id: randomUUID(),
        type: 'quiz',
        questions: [
          question,
          { ...question, id: randomUUID(), options: question.options.map((o) => ({ ...o })) },
        ],
      },
    ],
  };
  await cmd('saveDraft', resource, 0);
  const version = await cmd('publishResource', resource.id);
  const activity = await cmd(
    'createActivity',
    version.id,
    subject.id,
    {
      purpose: 'practice',
      pace: 'individual',
      maxGrade: 100,
      weight: 1,
      countsTowardAverage: false,
      maxAttempts: 1,
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      timeLimitMinutes: null,
      timeZone: 'America/La_Paz',
      feedback: 'hidden',
      manualCorrection: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      streaks: false,
      sound: false,
      ranking: false,
      teams: false,
      allowHint: false,
      allowDouble: false,
      bonusAffectsGrade: false,
      reportVisibility: false,
    },
    'Quiz de prueba',
  );
  await actor(users.peer);
  await cmd('startAttempt', activity.id);
  const peerBefore = await sync(activity.id);
  await actor(users.teacher);
  const teacherBefore = await sync(activity.id);
  await actor(users.student);
  const attempt = await cmd('startAttempt', activity.id);
  const before = await sync(activity.id);
  const key = randomUUID();
  const ack = await cmd(
    'submitAnswer',
    attempt.id,
    question.id,
    { type: 'single', optionId: question.correctOptionId },
    key,
    false,
  );
  ok(
    ack.syncRevision === (await sync(activity.id)) && ack.syncRevision !== before,
    'ACK corresponde a la revisión persistida después de la transacción',
  );
  ok(
    ack.attempt.answers.length === 1 && ack.attempt.answers[0].idempotencyKey === key,
    'ACK conserva la respuesta y la clave confirmadas',
  );
  ok(
    ack.feedback === null && !JSON.stringify(ack).includes('SOLUCION_RESERVADA'),
    'ACK no revela soluciones ni retroalimentación oculta',
  );
  const replay = await cmd(
    'submitAnswer',
    attempt.id,
    question.id,
    { type: 'single', optionId: question.correctOptionId },
    key,
    false,
  );
  ok(
    JSON.stringify(replay) === JSON.stringify(ack),
    'Reintento conserva resultado y revisión sin duplicar la respuesta',
  );
  await actor(users.peer);
  ok((await sync(activity.id)) === peerBefore, 'Respuesta ajena no invalida al compañero');
  await actor(users.teacher);
  ok((await sync(activity.id)) !== teacherBefore, 'El docente sigue observando la participación');
  await db.exec('reset role');
  const properties = (
    await rows(
      "select prosecdef,has_function_privilege('anon','public.aulify_command(text,jsonb)','execute') anon,has_function_privilege('authenticated','public.aulify_command(text,jsonb)','execute') authenticated from pg_proc where oid='public.aulify_command(text,jsonb)'::regprocedure",
    )
  )[0];
  ok(
    properties.prosecdef === false && !properties.anon && properties.authenticated,
    'Conserva invocador y permisos de la entrada pública',
  );
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await db.close();
  await fs.writeFile(
    'docs/verificacion/revision-ack-aislada.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      failure: report.failure,
    }),
  );
}
