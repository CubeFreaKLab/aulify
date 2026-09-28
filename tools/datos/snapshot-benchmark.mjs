import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
const migrations = (await fs.readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
const optimization = migrations.find(f => f.endsWith('_aulify_snapshot_authorized_sets.sql'));
if (!optimization) throw new Error('Falta la migración de optimización.');
for (const file of migrations.filter(f => f < optimization)) await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8'));
const uuid = () => crypto.randomUUID();
const as = async id => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
const command = async (action, ...args) => (await db.query('select public.aulify_command($1,$2) result', [action, { args }])).rows[0].result;
const fixtures = [];
for (let group = 0; group < 4; group++) {
  const teacher = uuid(), students = Array.from({ length: 50 }, uuid);
  for (const id of [teacher, ...students]) await db.query('insert into auth.users values($1,$2,now(),$3)', [id, `${id}@example.test`, { name: 'Persona ficticia', role: id === teacher ? 'teacher' : 'student' }]);
  await db.exec('set role authenticated'); await as(teacher);
  const subject = await command('createSubject', { name: `Materia ficticia ${group + 1}`, course: '3.º', year: 2026, description: 'Microcomparación aislada.' });
  await db.exec('reset role');
  for (const student of students) await db.query("insert into app.memberships(subject_id,student_id,status) values($1,$2,'approved')", [subject.id, student]);
  await db.exec('set role authenticated');
  const questions = Array.from({ length: 10 }, (_, i) => { const correct = uuid(); return { id: uuid(), type: 'single', prompt: `Pregunta ${i + 1}`, points: 1, options: [{ id: correct, text: 'A' }, { id: uuid(), text: 'B' }], correctOptionId: correct }; });
  const resource = { id: uuid(), title: 'Recurso ficticio', kind: 'quiz', blocks: [{ id: uuid(), type: 'quiz', questions }], revision: 1 };
  await command('saveDraft', resource, 0);
  const version = await command('publishResource', resource.id);
  const activity = await command('createActivity', version.id, subject.id, { purpose: 'practice', pace: 'individual', maxGrade: 100, weight: 1, countsTowardAverage: true, maxAttempts: 1, opensAt: new Date(Date.now() - 60000).toISOString(), closesAt: new Date(Date.now() + 3600000).toISOString(), timeLimitMinutes: null, timeZone: 'America/La_Paz', feedback: 'hidden', manualCorrection: false, shuffleQuestions: false, shuffleOptions: false, streaks: false, sound: false, ranking: false, teams: false, allowHint: false, allowDouble: false, bonusAffectsGrade: false, reportVisibility: false }, 'Actividad ficticia');
  for (const student of students) {
    await as(student); const attempt = await command('startAttempt', activity.id);
    await command('submitAnswer', attempt.id, questions[0].id, { type: 'single', optionId: questions[0].correctOptionId }, uuid(), false);
  }
  fixtures.push({ teacher, student: students[0], activityId: activity.id });
  await db.exec('reset role');
}
await db.exec('analyze; set role authenticated');
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const results = { measuredAt: new Date().toISOString(), environment: 'PGlite aislado; sin red ni concurrencia', people: 204, attempts: 200, questionsPerActivity: 10, optimization, stages: {} };
const views = {};
for (const stage of ['before', 'after']) {
  if (stage === 'after') { await db.exec('reset role'); await db.exec(await fs.readFile(`supabase/migrations/${optimization}`, 'utf8')); await db.exec('set role authenticated'); }
  results.stages[stage] = {};
  for (const role of ['student', 'teacher']) {
    await as(fixtures[0][role]);
    for (let i = 0; i < 3; i++) await db.query('select public.aulify_snapshot()');
    const elapsed = [];
    for (let i = 0; i < 20; i++) { const start = performance.now(); await db.query('select public.aulify_snapshot()'); elapsed.push(performance.now() - start); }
    const plan = (await db.query('explain (analyze,buffers,format json) select public.aulify_snapshot()')).rows[0]['QUERY PLAN'];
    const view = (await db.query('select public.aulify_snapshot() result')).rows[0].result;
    delete view.state.revision;
    // Colecciones de entidades sin orden contractual; las preguntas conservan su orden.
    for (const key of ['users','subjects','memberships','resources','versions','activities','attempts','powerups','evaluations','tasks','submissions','manualActivities','helpPreferences']) view.state[key].sort((a, b) => String(a.id ?? a.userId).localeCompare(String(b.id ?? b.userId)));
    views[`${stage}-${role}`] = JSON.stringify(view);
    results.stages[stage][role] = { samples: elapsed.length, p50Ms: percentile(elapsed, 0.5), p95Ms: percentile(elapsed, 0.95), plan };
  }
}
results.equivalent = ['student', 'teacher'].every(role => views[`before-${role}`] === views[`after-${role}`]);
if (!results.equivalent) throw new Error('La optimización alteró el contenido del snapshot.');
await fs.writeFile('docs/verificacion/datos-snapshot-benchmark.json', JSON.stringify(results, null, 2) + '\n');
for (const stage of ['before','after']) for (const role of ['student','teacher']) console.log(`${stage} ${role}: p95=${results.stages[stage][role].p95Ms.toFixed(2)}ms`);
console.log('Contenido equivalente en ambos perfiles; no es una prueba de capacidad remota.');
await db.close();
