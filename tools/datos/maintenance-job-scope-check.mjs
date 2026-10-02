import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID as id, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite(),
  teacher = id(),
  student = id(),
  checks = [];
const row = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const owner = () => db.exec('reset role');
const as = async (actor) => {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
};
const cmd = async (action, ...args) =>
  (await row('select public.aulify_command($1,$2) result', [action, { args }])).result;
const tick = async (jobId) => {
  await db.exec('set role service_role');
  return (await row("select public.aulify_maintenance('tick',$1) result", [{ jobId }])).result;
};
const confirm = async (jobId, ids) => {
  await db.exec('set role service_role');
  return (await row("select public.aulify_maintenance('confirmFiles',$1) result", [{ jobId, ids }]))
    .result;
};
const equal = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  checks.push({ label, result: 'passed' });
};
const rejected = async (fn, code, label) => {
  let error;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  assert.ok(error, label);
  assert.match(error.message, code);
  checks.push({ label, result: 'rejected-as-expected' });
};
const report = {
  startedAt: new Date().toISOString(),
  environment: 'PGlite aislado con Auth/Storage mínimos',
  checks,
  scriptSha256: createHash('sha256')
    .update(await fs.readFile('tools/datos/maintenance-job-scope-check.mjs'))
    .digest('hex'),
  limitations: ['No verifica JWT, transferencia de bytes, concurrencia ni recuperación operativa.'],
};
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
  create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
  alter table storage.objects enable row level security;grant all on storage.objects to authenticated;grant usage on schema storage to authenticated;`);
  report.migrations = (await fs.readdir('supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of report.migrations)
    await db.exec(await fs.readFile(`supabase/migrations/${f}`, 'utf8'));
  for (const [actor, role] of [
    [teacher, 'teacher'],
    [student, 'student'],
  ])
    await db.query('insert into auth.users values($1,$2,now(),$3)', [
      actor,
      `${actor}@example.test`,
      { role, name: 'Prueba' },
    ]);
  const fixtures = [];
  for (let i = 0; i < 2; i++) {
    await as(teacher);
    const s = await cmd('createSubject', {
      name: `Materia ${i}`,
      course: '3.º',
      year: 2026,
      description: 'Prueba aislada',
    });
    const snap = (await row('select public.aulify_snapshot() result')).result;
    const code = snap.state.subjects.find((x) => x.id === s.id).code;
    await as(student);
    const request = await cmd('requestMembership', code);
    await as(teacher);
    await cmd('decideMembership', request.id, 'approved');
    const task = await cmd('createTask', {
      subjectId: s.id,
      title: 'Tarea',
      instructions: 'Prueba',
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      maxGrade: 100,
      weight: 1,
      countsTowardAverage: true,
      allowLate: false,
    });
    const fileId = id(),
      name = `archivo-${i}.png`;
    await owner();
    await row('select public.aulify_reserve_upload($1,$2,$3,$4,$5,$6)', [
      student,
      fileId,
      name,
      'submission',
      67,
      'image/png',
    ]);
    const objectPath = `${student}/${fileId}`;
    await db.query(
      'insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',
      ['aulify-files', objectPath, student, { size: 67 }],
    );
    await row('select public.aulify_register_file($1,$2,$3,$4,$5,$6)', [
      student,
      fileId,
      name,
      'image/png',
      67,
      '1'.repeat(64),
    ]);
    await as(student);
    await cmd('submitTask', task.id, [{ id: fileId }], 'Entrega ficticia', id());
    await as(teacher);
    await cmd('archiveSubject', s.id);
    await owner();
    await db.query("update app.subjects set archived_at=now()-interval '31 days' where id=$1", [
      s.id,
    ]);
    const job = (await row('select id from app.purge_jobs where subject_id=$1', [s.id])).id;
    await db.query("update app.purge_jobs set due_at=now()-interval '1 day' where id=$1", [job]);
    fixtures.push({ subjectId: s.id, fileId, objectPath, job });
  }
  const [target, control] = fixtures;
  await as(student);
  await rejected(
    () => row("select public.aulify_maintenance('tick',$1)", [{ jobId: target.job }]),
    /permission denied/,
    'Cliente no ejecuta mantenimiento',
  );
  const first = await tick(target.job);
  equal(
    first.files.map((f) => f.id),
    [target.fileId],
    'Solo reclama archivos del trabajo elegido',
  );
  await owner();
  equal(
    (await row('select count(*)::int n from app.subjects where id=$1', [target.subjectId])).n,
    0,
    'Elimina registros de la materia elegible',
  );
  equal(
    (await row('select status from app.purge_jobs where id=$1', [control.job])).status,
    'scheduled',
    'No reclama otro trabajo elegible',
  );
  equal(
    (await row('select state from app.file_objects where id=$1', [control.fileId])).state,
    'ready',
    'Conserva archivo ajeno',
  );
  equal(
    (await row('select count(*)::int n from app.subjects where id=$1', [control.subjectId])).n,
    1,
    'Conserva otra materia',
  );
  await rejected(
    () => confirm(target.job, [control.fileId]),
    /PURGE_JOB_FILE_MISMATCH/,
    'Rechaza confirmación de archivo de otro trabajo',
  );
  await rejected(
    () => confirm(target.job, [target.fileId]),
    /STORAGE_OBJECT_REMAINS/,
    'No elimina metadatos mientras persistan objetos',
  );
  const again = await tick(target.job);
  equal(again.files, first.files, 'Reintento conserva los objetos pendientes');
  await owner();
  await db.query('delete from storage.objects where bucket_id=$1 and name=$2', [
    'aulify-files',
    target.objectPath,
  ]);
  equal(
    await confirm(target.job, [target.fileId]),
    { deleted: 1 },
    'Confirma borrado después de retirar el objeto',
  );
  equal(
    await confirm(target.job, [target.fileId]),
    { deleted: 0 },
    'Confirmación repetida es idempotente',
  );
  equal((await tick(target.job)).files, [], 'Trabajo terminado no vuelve a reclamar archivos');
  await owner();
  equal(
    (await row('select status from app.purge_jobs where id=$1', [target.job])).status,
    'done',
    'Trabajo elegido termina',
  );
  equal(
    (await row('select count(*)::int n from storage.objects where name=$1', [control.objectPath]))
      .n,
    1,
    'Objeto de control conserva su metadata',
  );
  await db.exec('set role service_role');
  await rejected(
    () => row("select public.aulify_maintenance('tick',$1)", [{ jobId: id() }]),
    /PURGE_JOB_NOT_FOUND/,
    'No acepta un trabajo inexistente',
  );
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.failure = e.message;
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await db.close();
  await fs.writeFile(
    'docs/verificacion/mantenimiento-acotado.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(`${report.status}: ${checks.length} comprobaciones`);
}
