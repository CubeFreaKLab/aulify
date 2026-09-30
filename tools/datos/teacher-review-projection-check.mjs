import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const migration = '20260930000631_aulify_teacher_review_projection.sql';
const reportIndex = process.argv.indexOf('--report');
const reportPath = reportIndex < 0 ? 'docs/verificacion/datos-proyeccion-revisiones-docente.json' : process.argv[reportIndex + 1];
const report = { startedAt: new Date().toISOString(), migration, environment: 'PGlite aislado; no lee credenciales ni usa servicios remotos.', checks: [] };
const db = new PGlite();
const uid = () => crypto.randomUUID();
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const admin = () => db.exec('reset role');
const actor = async id => {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
};
const command = async (action, ...args) => (await rows('select public.aulify_command($1,$2) value', [action, { args }]))[0].value;
const ok = (condition, name) => { assert.ok(condition, name); report.checks.push({ name, result: 'passed' }); };
const sortAttempts = list => [...list].sort((a, b) => a.id.localeCompare(b.id));
const normalize = value => {
  const result = structuredClone(value);
  delete result.state.revision;
  result.state.attempts = sortAttempts(result.state.attempts);
  return result;
};
async function denied(fn, name) {
  let code;
  try { await fn(); } catch (error) { code = error.code; }
  ok(code === '42501', name);
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
  const users = Object.fromEntries(['teacher', 'otherTeacher', 'a', 'b', 'unapproved'].map(name => [name, uid()]));
  for (const [name, id] of Object.entries(users)) await db.query('insert into auth.users values($1,$2,now(),$3)', [id, `${name}@example.test`, { name, role: name === 'teacher' || name === 'otherTeacher' ? 'teacher' : 'student' }]);
  await actor(users.teacher);
  const subject = await command('createSubject', { name: 'Proyección aislada', course: '3.º', year: 2026, description: 'Datos ficticios' });
  await admin();
  for (const name of ['a', 'b']) await db.query("insert into app.memberships(subject_id,student_id,status) values($1,$2,'approved')", [subject.id, users[name]]);
  const correct = uid();
  const questions = [
    { id: uid(), type: 'single', prompt: 'Selección', points: 5, options: [{ id: correct, text: 'Primera' }, { id: uid(), text: 'Segunda' }], correctOptionId: correct, explanation: 'SOLUCION_RESERVADA' },
    { id: uid(), type: 'open', prompt: 'Explicación', points: 5, manual: true, manualGuide: 'GUIA_RESERVADA' },
    { id: uid(), type: 'true-false', prompt: 'Última pregunta', points: 5, correct: true },
  ];
  await actor(users.teacher);
  const resource = { id: uid(), title: 'Revisiones completas', kind: 'quiz', blocks: [{ id: uid(), type: 'quiz', questions }], revision: 1 };
  await command('saveDraft', resource, 0);
  const version = await command('publishResource', resource.id);
  const settings = { purpose: 'practice', pace: 'individual', maxGrade: 100, weight: 1, countsTowardAverage: true, maxAttempts: 3, opensAt: new Date(Date.now() - 60000).toISOString(), closesAt: new Date(Date.now() + 3600000).toISOString(), timeLimitMinutes: null, timeZone: 'America/La_Paz', feedback: 'hidden', manualCorrection: false, shuffleQuestions: false, shuffleOptions: false, streaks: false, sound: false, ranking: false, teams: false, allowHint: false, allowDouble: false, bonusAffectsGrade: false, reportVisibility: false };
  const activity = await command('createActivity', version.id, subject.id, settings, 'Actividad principal');
  const emptyActivity = await command('createActivity', version.id, subject.id, settings, 'Actividad sin intentos');
  const otherActivity = await command('createActivity', version.id, subject.id, settings, 'Otra actividad');
  await actor(users.a);
  const first = await command('startAttempt', activity.id);
  await command('submitAnswer', first.id, questions[0].id, { type: 'single', optionId: correct }, uid(), false);
  await command('submitAnswer', first.id, questions[1].id, { type: 'open', text: 'Respuesta pendiente' }, uid(), false);
  await admin();
  // Cierre sintético aislado: permite comprobar una nota por omisión sin fila de respuesta.
  await db.query("select app.close_attempt($1,'deadline')", [first.id]);
  await actor(users.teacher);
  await command('reviewAnswer', first.id, questions[0].id, 3, 'REVISION_PRIVADA_UNO', 'Primera revisión');
  await command('reviewAnswer', first.id, questions[0].id, 4, 'REVISION_PRIVADA_DOS', 'Segunda revisión');
  await actor(users.a);
  const second = await command('startAttempt', activity.id);
  await actor(users.b);
  const peer = await command('startAttempt', activity.id);
  await command('submitAnswer', peer.id, questions[0].id, { type: 'single', optionId: correct }, uid(), false);
  const foreignAttempt = await command('startAttempt', otherActivity.id);
  await command('submitAnswer', foreignAttempt.id, questions[0].id, { type: 'single', optionId: correct }, uid(), false);
  await admin();
  await db.query("select app.close_attempt($1,'deadline')", [foreignAttempt.id]);
  await actor(users.teacher);
  await command('reviewAnswer', foreignAttempt.id, questions[0].id, 2, 'OTRA_ACTIVIDAD_PRIVADA', 'Revisión ajena al ámbito');

  const snapshot = async role => {
    await actor(users[role]);
    return normalize((await rows('select public.aulify_activity_snapshot($1) value', [activity.id]))[0].value);
  };
  const helper = async (id = activity.id, teacher = true, user = users.teacher) => {
    await admin();
    return sortAttempts((await rows('select app.activity_attempts_json($1,$2,$3) value', [id, teacher, user]))[0].value);
  };
  const before = {};
  for (const role of ['teacher', 'a', 'b']) before[role] = await snapshot(role);
  const beforeHelper = await helper();
  const beforeStudentHelper = await helper(activity.id, false, users.a);
  const beforeEmpty = await helper(emptyActivity.id);
  await admin();
  const omission = (await rows('select count(*)::int as n from app.question_grades g join app.attempt_questions q on q.id=g.attempt_question_id where q.attempt_id=$1 and not exists(select 1 from app.responses r where r.attempt_question_id=q.id)', [first.id]))[0].n;
  ok(omission === 1, 'Fixture incluye corrección por omisión sin respuesta');
  const sql = await fs.readFile(`supabase/migrations/${migration}`, 'utf8');
  report.migrationSha256 = crypto.createHash('sha256').update(sql).digest('hex');
  await db.exec(sql);
  for (const role of ['teacher', 'a', 'b']) {
    assert.deepEqual(await snapshot(role), before[role]);
    ok(true, `Snapshot completo equivalente para ${role}`);
  }
  assert.deepEqual(await helper(), beforeHelper);
  ok(true, 'Helper docente conserva proyección completa y todos los intentos');
  assert.deepEqual(await helper(activity.id, false, users.a), beforeStudentHelper);
  ok(true, 'Helper sin privilegio docente conserva proyección propia y revisiones vacías');
  assert.deepEqual(await helper(emptyActivity.id), beforeEmpty);
  ok(beforeEmpty.length === 0, 'Actividad sin intentos conserva array vacío');
  const current = await helper();
  const projectedFirst = current.find(x => x.id === first.id);
  const firstAnswer = projectedFirst.answers.find(x => x.questionId === questions[0].id);
  ok(JSON.stringify(firstAnswer.reviews.map(x => x.revision)) === '[1,2,3]', 'Conserva varias revisiones y su orden ascendente');
  ok(firstAnswer.reviews[1].comment === 'REVISION_PRIVADA_UNO' && firstAnswer.reviews[2].comment === 'REVISION_PRIVADA_DOS', 'Conserva comentarios y revisiones privadas del docente');
  ok(projectedFirst.answers.find(x => x.questionId === questions[1].id).reviews.length === 0, 'Respuesta escrita pendiente conserva reviews vacío');
  ok(!projectedFirst.answers.some(x => x.questionId === questions[2].id), 'Nota por omisión no inventa una respuesta');
  ok(current.find(x => x.id === second.id).answers.length === 0, 'Intento sin respuestas conserva answers vacío');
  ok(JSON.stringify(projectedFirst.answers.map(x => x.questionId)) === JSON.stringify(questions.slice(0, 2).map(x => x.id)), 'Conserva orden de las respuestas según posición de pregunta');
  ok(JSON.stringify(projectedFirst.questionOrder) === JSON.stringify(questions.map(x => x.id)), 'Conserva orden completo de preguntas incluidas las omitidas');
  ok(current.length === 3 && current.some(x => x.id === peer.id), 'Incluye varios intentos del mismo estudiante y otro participante');
  ok(!JSON.stringify(current).includes('OTRA_ACTIVIDAD_PRIVADA') && !current.some(x => x.id === foreignAttempt.id), 'No incorpora revisiones ni intentos de otra actividad');
  const student = await snapshot('a');
  ok(!JSON.stringify(student).includes('REVISION_PRIVADA') && !JSON.stringify(student).includes('SOLUCION_RESERVADA') && !JSON.stringify(student).includes('GUIA_RESERVADA'), 'Estudiante no recibe revisión privada, solución ni guía');
  await actor(users.otherTeacher);
  await denied(() => rows('select public.aulify_activity_snapshot($1)', [activity.id]), 'Docente ajeno no accede al snapshot');
  await actor(users.unapproved);
  await denied(() => rows('select public.aulify_activity_snapshot($1)', [activity.id]), 'Estudiante no aprobado no accede al snapshot');
  for (const role of ['teacher', 'a']) {
    await actor(users[role]);
    await denied(() => rows('select app.activity_attempts_json($1,true,$2)', [activity.id, users[role]]), `Cliente ${role} no puede invocar el helper privado`);
  }
  await db.exec('set role anon');
  await denied(() => rows('select public.aulify_activity_snapshot($1)', [activity.id]), 'Anónimo no accede al snapshot');
  await admin();
  const catalog = await rows("select p.prosecdef, p.proconfig, has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated, has_function_privilege('anon',p.oid,'EXECUTE') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.proname='activity_attempts_json'");
  ok(catalog.length === 1 && catalog[0].prosecdef && !catalog[0].authenticated && !catalog[0].anon && catalog[0].proconfig.includes('search_path=""'), 'Conserva helper privado SECURITY DEFINER con search_path vacío');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { code: error.code ?? error.name, message: error.message };
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.limitations = ['Base en memoria con Auth/Storage mínimos; no sustituye JWT ni concurrencia real.', 'No mide latencia HTTP, ACK o capacidad Q-06.', 'Se normaliza únicamente reloj state.revision y orden no contractual de la lista externa de intentos; preguntas, respuestas y revisiones se comparan en su orden original.'];
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure }));
  await db.close();
}
