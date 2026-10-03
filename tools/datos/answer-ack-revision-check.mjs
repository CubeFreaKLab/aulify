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
    ack.syncRevision === (await sync(activity.id)) &&
      ack.syncRevision !== before &&
      ack.syncBaseRevision === before &&
      ack.syncProjectionComplete === true,
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
    JSON.stringify(replay.attempt) === JSON.stringify(ack.attempt) &&
      replay.feedback === ack.feedback &&
      replay.syncRevision === ack.syncRevision,
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
  await db.exec('reset role');
  await db.exec(`create function app.test_external_revision() returns trigger language plpgsql as $$begin
    update app.activity_sync_versions set public_revision=public_revision+1 where activity_id=(select p.activity_id from app.attempt_questions q join app.attempts a on a.id=q.attempt_id join app.participants p on p.id=a.participant_id where q.id=new.attempt_question_id);
    return new; end $$;
    create trigger test_external_revision after insert on app.responses for each row execute function app.test_external_revision();`);
  await actor(users.student);
  const final = await cmd(
    'submitAnswer',
    attempt.id,
    resource.blocks[0].questions[1].id,
    { type: 'single', optionId: question.correctOptionId },
    randomUUID(),
    false,
  );
  ok(
    final.syncProjectionComplete === false && final.attempt.answers.length === 2,
    'Cambio común simulado durante el envío invalida la omisión de lectura, sin perder respuestas',
  );
  const expected = {};
  for (const [key, id] of Object.entries(users)) {
    await actor(id);
    expected[key] = await sync(activity.id);
  }
  await db.exec('reset role;set role service_role');
  const originalSub = randomUUID();
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [originalSub]);
  const requests = Object.entries(users).map(([key, userId]) => ({
    key,
    userId,
    activityId: activity.id,
  }));
  requests.push({ key: 'unknown', userId: randomUUID(), activityId: activity.id });
  const batch = (await rows('select public.aulify_service_sync_batch($1) result', [requests]))[0]
    .result;
  ok(
    Object.entries(expected).every(
      ([key, revision]) => batch.find((r) => r.key === key)?.value?.revision === revision,
    ),
    'Lote de servicio conserva exactamente las huellas autorizadas de ambos perfiles',
  );
  ok(
    batch.find((r) => r.key === 'unknown')?.error && !batch.find((r) => r.key === 'unknown')?.value,
    'Identidad inexistente se rechaza sin cancelar a los otros participantes',
  );
  ok(
    (await rows("select current_setting('request.jwt.claim.sub') value"))[0].value === originalSub,
    'El lote restaura la identidad del llamador al terminar',
  );
  await actor(users.student);
  let denied = false;
  try {
    await rows('select public.aulify_service_sync_batch($1)', [requests]);
  } catch (error) {
    denied = error.code === '42501';
  }
  ok(
    denied,
    'Una cuenta autenticada no puede llamar al lote de servicio ni elegir otras identidades',
  );
  await db.exec('reset role');
  ok(
    !(
      await rows(
        "select has_function_privilege('anon','public.aulify_service_sync_batch(jsonb)','execute') value",
      )
    )[0].value,
    'El visitante tampoco puede ejecutar el lote de servicio',
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
