import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Equivalencia y permisos en una base nueva. No lee credenciales ni usa red.
const db = new PGlite();
const files = (await fs.readdir('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
const migration = files.find((f) => f.endsWith('_aulify_set_based_service_sync.sql'));
assert.ok(migration, 'Migración creada por CLI');
const report = {
  at: new Date().toISOString(),
  environment: 'PGlite aislado; sin red ni concurrencia real',
  migration,
  checks: [],
  benchmark: {},
};
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const uid = () => crypto.randomUUID();
const actor = async (id) => {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
};
const command = async (action, ...args) =>
  (await query('select public.aulify_command($1,$2) value', [action, { args }]))[0].value;
function clean(rows) {
  return rows.map((row) => {
    const x = structuredClone(row);
    if (x.value) delete x.value.serverTime;
    return x;
  });
}
const check = (name) => report.checks.push({ name, passed: true });
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security;grant all on storage.objects to authenticated;grant usage on schema storage to authenticated;`);
  for (const f of files.filter((f) => f < migration))
    await db.exec(await fs.readFile('supabase/migrations/' + f, 'utf8'));
  const legacy = (
    await query(
      "select pg_get_functiondef('public.aulify_service_sync_batch(jsonb)'::regprocedure) value",
    )
  )[0].value;
  await db.exec(
    legacy.replace(
      'FUNCTION public.aulify_service_sync_batch(',
      'FUNCTION app.test_legacy_sync_batch(',
    ),
  );
  await db.exec(await fs.readFile('supabase/migrations/' + migration, 'utf8'));
  const users = Object.fromEntries(
    [
      'teacher',
      'foreign',
      'a',
      'b',
      'withdrawn',
      'unapproved',
      'unconfirmed',
      'noProfile',
      'noParticipant',
    ].map((n) => [n, uid()]),
  );
  for (const [name, id] of Object.entries(users))
    await db.query('insert into auth.users values($1,$2,$3,$4)', [
      id,
      name + '@example.test',
      name === 'unconfirmed' ? null : new Date(),
      { name, role: ['teacher', 'foreign'].includes(name) ? 'teacher' : 'student' },
    ]);
  await db.query('delete from app.profiles where id=$1', [users.noProfile]);
  await actor(users.teacher);
  const subject = await command('createSubject', {
    name: 'Lote aislado',
    course: '3.º',
    year: 2026,
    description: 'Datos ficticios',
  });
  await db.exec('reset role');
  for (const name of ['a', 'b', 'withdrawn', 'noParticipant'])
    await db.query('insert into app.memberships(subject_id,student_id,status)values($1,$2,$3)', [
      subject.id,
      users[name],
      name === 'withdrawn' ? 'withdrawn' : 'approved',
    ]);
  await actor(users.teacher);
  const option = uid();
  const question = {
    id: uid(),
    type: 'single',
    prompt: 'Pregunta',
    points: 1,
    options: [
      { id: option, text: 'A' },
      { id: uid(), text: 'B' },
    ],
    correctOptionId: option,
  };
  const resource = {
    id: uid(),
    title: 'Recurso',
    kind: 'quiz',
    blocks: [{ id: uid(), type: 'quiz', questions: [question] }],
    revision: 1,
  };
  await command('saveDraft', resource, 0);
  const version = await command('publishResource', resource.id);
  const settings = {
    purpose: 'practice',
    pace: 'individual',
    maxGrade: 100,
    weight: 1,
    countsTowardAverage: true,
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
  };
  const activity = await command('createActivity', version.id, subject.id, settings, 'Actividad');
  const timed = await command(
    'createActivity',
    version.id,
    subject.id,
    { ...settings, timeLimitMinutes: 10 },
    'Con plazo',
  );
  for (const a of [activity, timed])
    for (const u of ['a', 'b']) {
      await actor(users[u]);
      await command('startAttempt', a.id);
    }
  await db.exec('reset role');
  const requests = Object.entries(users).map(([key, userId]) => ({
    key,
    userId,
    activityId: activity.id,
  }));
  async function compare(name, entries = requests, setup) {
    await db.exec('begin');
    try {
      if (setup) await setup();
      await db.exec('set constraints all immediate');
      const before = (await query('select app.test_legacy_sync_batch($1) value', [entries]))[0]
        .value;
      const after = (await query('select public.aulify_service_sync_batch($1) value', [entries]))[0]
        .value;
      assert.deepEqual(clean(after), clean(before), name);
      assert.ok(
        !/email|subjectId|studentId|teacherRevision/.test(JSON.stringify(after)),
        name + ' solo metadatos opacos',
      );
      check(name);
    } finally {
      await db.exec('rollback');
    }
  }
  await compare('Identidades autorizadas, retiradas, no confirmadas, sin perfil y docente ajeno');
  await compare(
    'Duración y plazos de intentos',
    requests.map((x) => ({ ...x, activityId: timed.id })),
  );
  await compare(
    'Actividad inexistente',
    requests.map((x) => ({ ...x, activityId: uid() })),
  );
  await compare('Identidad y actividad ausentes', [
    { key: 'a', userId: null, activityId: activity.id },
    { key: 'b', userId: users.a, activityId: null },
  ]);
  await compare('Entrada inválida no cancela los otros elementos', [
    ...requests,
    { key: 'bad', userId: 'no-uuid', activityId: activity.id },
  ]);
  await compare('UUID alternativo conserva conversión original', [
    { key: 'a', userId: '{' + users.a + '}', activityId: activity.id },
  ]);
  await compare('Actividad no publicada', requests, () =>
    db.query('update app.activities set published_at=null where id=$1', [activity.id]),
  );
  await compare('Materia archivada', requests, () =>
    db.query('update app.subjects set archived_at=now() where id=$1', [subject.id]),
  );
  await compare('Revisión individual cambiada', requests, () =>
    db.query(
      'update app.participant_sync_versions set student_revision=student_revision+3,teacher_revision=teacher_revision+5',
    ),
  );
  await compare('Marcas opcionales ausentes', requests, () =>
    db.exec('delete from app.participant_sync_versions;delete from app.activity_sync_versions'),
  );
  await compare('Inicio futuro', requests, () =>
    db.query("update app.activities set opens_at=now()+interval '10 minutes' where id=$1", [
      activity.id,
    ]),
  );
  await compare(
    'Plazo común y personal extendido',
    requests.map((x) => ({ ...x, activityId: timed.id })),
    async () => {
      await db.query(
        "insert into app.deadline_extensions(activity_id,participant_id,new_deadline,reason,actor_id) values($1,null,now()+interval '2 hours','Prueba',$2)",
        [timed.id, users.teacher],
      );
    },
  );
  const acl = (
    await query(
      "select has_function_privilege('anon','public.aulify_service_sync_batch(jsonb)','execute') anon,has_function_privilege('authenticated','public.aulify_service_sync_batch(jsonb)','execute') authenticated,has_function_privilege('service_role','public.aulify_service_sync_batch(jsonb)','execute') service",
    )
  )[0];
  assert.deepEqual(acl, { anon: false, authenticated: false, service: true });
  check('Solo service_role puede ejecutar el lote');
  const batch = Array.from({ length: 64 }, (_, i) => ({ ...requests[i % 3], key: String(i) }));
  for (const [name, fn] of [
    ['legacy', 'app.test_legacy_sync_batch'],
    ['candidate', 'public.aulify_service_sync_batch'],
  ]) {
    const times = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      await query('select ' + fn + '($1)', [batch]);
      if (i > 2) times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    report.benchmark[name] = {
      samples: times.length,
      p50Ms: times[Math.floor(times.length * 0.5)],
      p95Ms: times[Math.ceil(times.length * 0.95) - 1],
    };
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { message: error.message, code: error.code };
  process.exitCode = 1;
} finally {
  await db.close();
  await fs.writeFile(
    'docs/verificacion/sync-lotes-conjuntos-local.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
}
