import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
process.on('unhandledRejection', (error) => {
  console.error(`FAIL ${error.message}\n${error.where ?? ''}`);
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  console.error(`FAIL ${error.message}\n${error.where ?? ''}`);
  process.exit(1);
});
const db = new PGlite();
const report = {
  startedAt: new Date().toISOString(),
  environment: 'PGlite 0.5.8 aislado; comparación con snapshot anterior',
  checks: [],
};
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);

const files = (await fs.readdir('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
const target = files.find((f) => f.endsWith('_aulify_workspace_overview.sql'));
assert.ok(target);
const baseline = files.filter((f) => f < target);
assert.equal(baseline.length, 21);
for (const file of baseline)
  await db.exec(await fs.readFile('supabase/migrations/' + file, 'utf8'));
for (const [name, signature] of [
  ['snapshot', '()'],
  ['student_results', '(uuid)'],
]) {
  const def = (
    await db.query('select pg_get_functiondef($1::regprocedure) sql', ['app.' + name + signature])
  ).rows[0].sql;
  await db.exec(def.replace('app.' + name + '(', 'app.legacy_' + name + '('));
  await db.exec(
    'revoke all on function app.legacy_' +
      name +
      signature +
      ' from public,anon; grant execute on function app.legacy_' +
      name +
      signature +
      ' to authenticated',
  );
}
await db.exec(await fs.readFile('supabase/migrations/' + target, 'utf8'));
const subsequent = files.filter((file) => file > target);
for (const file of subsequent)
  await db.exec(await fs.readFile('supabase/migrations/' + file, 'utf8'));
report.migrationFiles = [...baseline, target, ...subsequent];
report.migrationSha256 = crypto
  .createHash('sha256')
  .update(await fs.readFile('supabase/migrations/' + target))
  .digest('hex');
const id = () => crypto.randomUUID();
const users = { teacher: id(), otherTeacher: id(), student: id(), studentOther: id() };
for (const [role, user] of Object.entries(users))
  await db.query('insert into auth.users values($1,$2,now(),$3)', [
    user,
    `${role}@example.test`,
    { name: role, role: role.startsWith('student') ? 'student' : 'teacher' },
  ]);
await db.exec('set role authenticated');
const as = async (role) =>
  db.query("select set_config('request.jwt.claim.sub',$1,false)", [users[role]]);
const command = async (action, ...args) => {
  const result = (await db.query('select public.aulify_command($1,$2) value', [action, { args }]))
    .rows[0].value;
  if (result?.error) throw new Error(result.error.message);
  return result;
};
const check = async (scenario, run) => {
  await run();
  report.checks.push({ scenario, passed: true });
  console.log(`PASS ${scenario}`);
};
const normalize = (input) => {
  const result = structuredClone(input);
  delete result.state.revision;
  result.state.attempts.sort((a, b) => a.id.localeCompare(b.id));
  return result;
};

const snapshot = async (name) => (await db.query('select ' + name + '() value')).rows[0].value;
const equal = async (role) => {
  await as(role);
  const before = await snapshot('app.legacy_snapshot');
  const current = await snapshot('public.aulify_workspace_overview');
  assert.deepEqual(current.studentActivities, {});
  const counts = Object.fromEntries(
    before.state.activities.map((a) => [
      a.id,
      role.startsWith('student')
        ? before.studentActivities[a.id].questions.length
        : before.state.versions
            .find((v) => v.id === a.versionId)
            .blocks.filter((b) => b.type === 'quiz')
            .flatMap((b) => b.questions).length,
    ]),
  );
  assert.deepEqual(current.activityQuestionCounts, counts);
  delete before.studentActivities;
  delete current.studentActivities;
  delete current.activityQuestionCounts;
  assert.deepEqual(normalize(current), normalize(before));
  for (const s of current.state.subjects.filter((s) => s.status === 'active'))
    if (role.startsWith('student')) {
      await db.exec('reset role');
      const r = await db.query(
        'select app.legacy_student_results($1) old,app.student_results($1) new',
        [s.id],
      );
      await as(role);
      assert.deepEqual(r.rows[0].new, r.rows[0].old);
    }
  return current;
};
const denies = async (sql, args = []) => {
  await assert.rejects(
    () => db.query(sql, args),
    (e) => e.code === '42501',
  );
};
await as('teacher');
const subject = await command('createSubject', {
  name: 'Proyección docente ficticia',
  course: '3.º A',
  year: 2026,
  description: 'Escenario aislado',
});
await db.exec('reset role');
for (const role of ['student', 'studentOther'])
  await db.query(
    "insert into app.memberships(subject_id,student_id,status) values($1,$2,'approved')",
    [subject.id, users[role]],
  );
await db.exec('set role authenticated');
const choice = [
    { id: id(), text: 'A' },
    { id: id(), text: 'B' },
  ],
  left = [
    { id: id(), text: 'A' },
    { id: id(), text: 'B' },
  ],
  right = [
    { id: id(), text: 'Uno' },
    { id: id(), text: 'Dos' },
  ],
  blank = id();
const questions = [
  {
    id: id(),
    type: 'single',
    prompt: 'Selección',
    points: 2,
    options: choice,
    correctOptionId: choice[0].id,
    hint: 'Pista privada',
    explanation: 'Explicación privada',
  },
  {
    id: id(),
    type: 'open',
    prompt: 'Explica',
    points: 4,
    manual: true,
    manualGuide: 'Guía privada',
  },
  {
    id: id(),
    type: 'matching',
    prompt: 'Relaciona',
    points: 4,
    left,
    right,
    pairs: { [left[0].id]: right[0].id, [left[1].id]: right[1].id },
  },
  {
    id: id(),
    type: 'fill-text',
    prompt: 'Completa',
    points: 2,
    template: `Concepto {${blank}}`,
    blanks: [{ id: blank, label: 'Concepto' }],
    manual: true,
    manualGuide: 'Criterio privado',
  },
  { id: id(), type: 'true-false', prompt: 'Verdadero', points: 1, correct: true },
];
const answers = [
  { type: 'single', optionId: choice[0].id },
  { type: 'open', text: 'Explicación ficticia' },
  { type: 'matching', pairs: { [left[0].id]: right[0].id, [left[1].id]: right[0].id } },
  { type: 'fill-text', texts: { [blank]: 'Respuesta' } },
  { type: 'true-false', value: true },
];
const resource = {
  id: id(),
  title: 'Recurso de proyección',
  kind: 'quiz',
  blocks: [{ id: id(), type: 'quiz', questions }],
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
  maxAttempts: 3,
  opensAt: new Date(Date.now() - 3600000).toISOString(),
  closesAt: new Date(Date.now() + 3600000).toISOString(),
  timeLimitMinutes: 15,
  timeZone: 'America/La_Paz',
  feedback: 'hidden',
  manualCorrection: false,
  shuffleQuestions: false,
  shuffleOptions: true,
  streaks: false,
  sound: false,
  ranking: false,
  teams: true,
  allowHint: true,
  allowDouble: true,
  bonusAffectsGrade: false,
  reportVisibility: true,
};
const activity = await command(
  'createActivity',
  version.id,
  subject.id,
  settings,
  'Actividad de proyección',
);
await command('configureTeams', activity.id, [
  { name: 'Equipo ficticio', studentIds: [users.student, users.studentOther] },
]);

await check('Resumen docente conserva historial completo', () => equal('teacher'));
await check('Estudiante sin intento: conteo sin preguntas ni soluciones', async () => {
  const s = await equal('student');
  assert.ok(!JSON.stringify(s).includes('Guía privada'));
  assert.equal(s.studentResults[subject.id][0].status, 'not-started');
});
await as('student');
const first = await command('startAttempt', activity.id);
await check('Intento abierto conserva estado y preguntas en endpoint específico', async () => {
  const s = await equal('student');
  assert.equal(s.studentResults[subject.id][0].status, 'in-progress');
  const scoped = (await db.query('select public.aulify_activity_snapshot($1) value', [activity.id]))
    .rows[0].value;
  assert.equal(scoped.studentActivities[activity.id].questions.length, 5);
});
for (let n = 0; n < questions.length; n++)
  await command('submitAnswer', first.id, questions[n].id, answers[n], id(), false);
await check('Respuestas escritas mantienen pendiente de revisión', async () => {
  const s = await equal('student');
  assert.equal(s.studentResults[subject.id][0].status, 'pending-review');
});
await check('Docente conserva respuestas y correcciones', () => equal('teacher'));
await command('reviewAnswer', first.id, questions[1].id, 3, 'Revisión');
await command('reviewAnswer', first.id, questions[3].id, 2, 'Completo');
await check('Calificación lista permanece privada hasta publicar', async () => {
  const s = await equal('student');
  assert.equal(s.studentResults[subject.id][0].status, 'unpublished');
  assert.equal(s.studentResults[subject.id][0].grade, null);
});
await as('teacher');
await command('publishGrade', activity.id, users.student);
await check('Nota publicada equivale al contrato anterior', async () => {
  const s = await equal('student');
  assert.equal(s.studentResults[subject.id][0].status, 'published');
  assert.ok(s.studentResults[subject.id][0].grade > 0);
});
await as('teacher');
await command('reviewAnswer', first.id, questions[1].id, 4, 'Ajuste', 'Revisión justificada');
await check('Revisión privada no altera publicación previa', () => equal('student'));
await as('student');
await command('startAttempt', activity.id);
await check('Múltiples intentos se conservan', async () => {
  const s = await equal('student');
  assert.equal(s.state.attempts.length, 2);
});
await db.exec('reset role');
const complete = async (label) => {
  const r = await db.query(
    "select id,app.attempt_complete(id) current,(app.attempt_score(id)->>'complete')::boolean previous from app.attempts",
  );
  assert.ok(r.rows.every((x) => x.current === x.previous));
  report.checks.push({ scenario: label, passed: true });
};
await complete('Completitud equivalente: abiertos, revisados y publicados');
for (const reason of ['withdrawal', 'archive', 'teacher_early', 'deadline', 'completed']) {
  await db.exec('begin');
  await db.query('update app.attempts set close_reason=$2,closed_at=now() where id=$1', [
    first.id,
    reason,
  ]);
  for (const decision of [null, 'evaluate', 'exclude']) {
    await db.query('delete from app.attempt_resolutions where attempt_id=$1', [first.id]);
    if (decision)
      await db.query(
        "insert into app.attempt_resolutions(attempt_id,decision,actor_id,reason,decided_at) values($1,$2,$3,'Fixture',now())",
        [first.id, decision, users.teacher],
      );
    await complete('Completitud ' + reason + '/' + (decision ?? 'sin resolución'));
  }
  await db.exec('rollback');
}
await as('otherTeacher');
await denies('select public.aulify_activity_snapshot($1)', [activity.id]);
await check('Docente ajeno recibe sólo su espacio', async () => {
  const s = await equal('otherTeacher');
  assert.equal(s.state.activities.length, 0);
});
await as('studentOther');
await equal('studentOther');
await db.exec('reset role');
await db.query("update app.memberships set status='withdrawn' where student_id=$1", [
  users.studentOther,
]);
await check('Retiro revoca actividades y conteos', async () => {
  const s = await equal('studentOther');
  assert.equal(s.state.activities.length, 0);
});
await db.exec('reset role');
await db.query('update app.subjects set archived_at=now() where id=$1', [subject.id]);
await check('Archivo oculta materia e historial al alumno', async () => {
  const s = await equal('student');
  assert.equal(s.state.activities.length, 0);
});
await as('teacher');
await db.exec('reset role');
await db.query('update app.subjects set archived_at=null,purge_started_at=now() where id=$1', [
  subject.id,
]);
await check('Purga impide leer el contenido', async () => {
  const s = await equal('student');
  assert.equal(s.state.activities.length, 0);
});
await db.exec('reset role; set role anon');
await denies('select public.aulify_workspace_overview()');
report.checks.push({ scenario: 'Anon no puede ejecutar el resumen', passed: true });
await db.exec('reset role; set role authenticated');
await denies('select app.attempt_complete($1)', [first.id]);
await db.query("select set_config('request.jwt.claim.sub','',false)");
await denies('select public.aulify_workspace_overview()');
report.checks.push({
  scenario: 'Sin identidad no accede; helper de completitud es privado',
  passed: true,
});
await db.exec('reset role');
const acl = (
  await db.query(
    "select prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon from pg_proc where oid='app.snapshot_data(boolean)'::regprocedure",
  )
).rows[0];
assert.equal(acl.anon, false);
assert.equal(acl.prosecdef, true);
assert.ok(acl.proconfig.includes('search_path=""'));
report.checks.push({
  scenario: 'Resumen privilegiado conserva búsqueda vacía y acceso restringido',
  passed: true,
});
report.finishedAt = new Date().toISOString();
report.result = 'passed';
await fs.writeFile(
  subsequent.length
    ? 'docs/verificacion/datos-completitud-existencia-local.json'
    : 'docs/verificacion/datos-resumen-aula-local.json',
  JSON.stringify(report, null, 2) + '\n',
);
await db.close();
console.log(report.checks.length + ' comprobaciones aprobadas');
