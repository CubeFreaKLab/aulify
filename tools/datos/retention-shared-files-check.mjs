import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PGlite } from '@electric-sql/pglite';

// Base nueva en memoria y bytes locales propios. No lee credenciales ni se conecta a Supabase.
const scriptPath = 'tools/datos/retention-shared-files-check.mjs';
const reportPath = 'docs/verificacion/conservacion-archivos-compartidos.json';
const prefix = `ap31-ap32-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
const bytesRoot = path.resolve('.local-private', prefix);
await fs.mkdir(bytesRoot, { recursive: false });
const hash = (value) => createHash('sha256').update(value).digest('hex');
const report = {
  startedAt: new Date().toISOString(),
  environment: 'PostgreSQL aislado en PGlite; bytes reales en directorio local exclusivo',
  prefix,
  script: { path: scriptPath, sha256: hash(await fs.readFile(scriptPath)) },
  checks: [],
  limitations: [
    'No ejecuta mantenimiento remoto ni prueba la API de Storage de Supabase.',
    'La referencia compartida biblioteca/entrega se siembra por SQL como topología histórica; los comandos públicos exigen propietarios distintos por rol y no permiten crearla directamente.',
    'El fallo parcial se introduce entre el borrado local de bytes y la confirmación SQL; no simula una caída real de Supabase.',
    'No mide el objetivo operativo de 24 horas ni una carrera concurrente restauración/purga.',
  ],
};
const equal = (actual, expected, detail) => {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`ASSERT: ${detail}`);
  report.checks.push({ detail, result: 'passed' });
  console.log(`PASS ${detail}`);
};
const db = new PGlite();
const owner = async () => db.exec('reset role');
const service = async () => db.exec('set role service_role');
const as = async (user) => {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
};
const result = async (sql, args = []) => (await db.query(sql, args)).rows[0].result;
const command = (action, ...args) =>
  result('select public.aulify_command($1,$2) result', [action, { args }]);
const maintenance = async (action, payload = {}) => {
  await service();
  return result('select public.aulify_maintenance($1,$2) result', [action, payload]);
};
const rejected = async (fn, code, detail) => {
  let failure;
  try {
    await fn();
  } catch (error) {
    failure = error;
  }
  equal(failure?.message?.split(':')[0], code, detail);
};
const files = new Map();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6wsAAAAAASUVORK5CYII=',
  'base64',
);
async function upload(user, label, purpose) {
  const id = randomUUID();
  const name = `${prefix}-${label}.png`;
  const filePath = path.join(bytesRoot, name);
  const objectPath = `${user}/${id}`;
  await service();
  await db.query('select public.aulify_reserve_upload($1,$2,$3,$4,$5,$6)', [
    user,
    id,
    name,
    purpose,
    png.length,
    'image/png',
  ]);
  await fs.writeFile(filePath, png, { flag: 'wx' });
  await owner();
  await db.query(
    'insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',
    ['aulify-files', objectPath, user, { size: png.length, mimetype: 'image/png' }],
  );
  await service();
  await db.query('select public.aulify_register_file($1,$2,$3,$4,$5,$6)', [
    user,
    id,
    name,
    'image/png',
    png.length,
    hash(await fs.readFile(filePath)),
  ]);
  const file = { id, filePath, objectPath };
  files.set(id, file);
  return file;
}
async function deleteLocalBytes(fileId) {
  const file = files.get(fileId);
  if (!file || path.dirname(path.resolve(file.filePath)) !== bytesRoot)
    throw new Error('ASSERT: Archivo fuera del directorio propio del ensayo.');
  // Solo un archivo conocido de esta ejecución, nunca un directorio ni una ruta de Storage externa.
  await fs.unlink(file.filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await owner();
  await db.query('delete from storage.objects where bucket_id=$1 and name=$2', [
    'aulify-files',
    file.objectPath,
  ]);
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
    alter table storage.objects enable row level security;
    grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;
  `);
  report.migrations = (await fs.readdir('supabase/migrations'))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const migration of report.migrations)
    await db.exec(await fs.readFile(`supabase/migrations/${migration}`, 'utf8'));
  const teacher = randomUUID(),
    student = randomUUID();
  for (const [id, role] of [
    [teacher, 'teacher'],
    [student, 'student'],
  ])
    await db.query('insert into auth.users values($1,$2,now(),$3)', [
      id,
      `${prefix}-${role}@example.test`,
      { name: `${prefix}-${role}`, role },
    ]);
  await as(teacher);
  const subject = await command('createSubject', {
    name: `${prefix} vencida`,
    course: '3A',
    year: 2026,
    description: 'Datos ficticios del ensayo aislado.',
  });
  const control = await command('createSubject', {
    name: `${prefix} vigente`,
    course: '3B',
    year: 2026,
    description: 'Control que debe conservarse.',
  });
  const initial = await result('select public.aulify_snapshot() result');
  const code = initial.state.subjects.find((item) => item.id === subject.id).code;
  await as(student);
  const request = await command('requestMembership', code);
  await as(teacher);
  await command('decideMembership', request.id, 'approved');
  const task = await command('createTask', {
    subjectId: subject.id,
    title: `${prefix} entrega`,
    instructions: 'Adjunta imágenes ficticias.',
    opensAt: new Date(Date.now() - 60_000).toISOString(),
    closesAt: new Date(Date.now() + 60_000).toISOString(),
    maxGrade: 20,
    weight: 1,
    countsTowardAverage: true,
    allowLate: false,
  });
  const shared = await upload(teacher, 'compartido', 'resource');
  const exclusiveA = await upload(student, 'exclusivo-a', 'submission');
  const exclusiveB = await upload(student, 'exclusivo-b', 'submission');
  await as(teacher);
  const resource = {
    id: randomUUID(),
    ownerId: teacher,
    title: `${prefix} biblioteca`,
    kind: 'resource',
    revision: 1,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: randomUUID(),
        type: 'image',
        fileId: shared.id,
        url: `/api/files/${shared.id}`,
        alt: 'Punto ficticio para verificar conservación.',
      },
    ],
  };
  await command('saveDraft', resource, 0);
  const version = await command('publishResource', resource.id);
  await as(student);
  await rejected(
    () => command('submitTask', task.id, [{ id: shared.id }], '', randomUUID()),
    'INVALID_FILES',
    'El contrato no permite entregar un archivo de otra cuenta',
  );
  const submission = await command(
    'submitTask',
    task.id,
    [{ id: exclusiveA.id }, { id: exclusiveB.id }],
    'Entrega ficticia propia.',
    randomUUID(),
  );
  await owner();
  // Topología histórica explícita: se prueba el guard de referencias, no un comando público de compartir.
  await db.query('insert into app.submission_files values($1,$2,3)', [submission.id, shared.id]);
  equal(
    await result('select count(*)::int result from app.draft_files where file_id=$1', [shared.id]),
    1,
    'El archivo compartido tiene referencia autorizada en borrador',
  );
  equal(
    await result('select count(*)::int result from app.content_blocks where file_id=$1', [
      shared.id,
    ]),
    1,
    'El archivo compartido tiene referencia autorizada en versión publicada',
  );
  equal(
    await result('select count(*)::int result from app.submission_files where file_id=$1', [
      shared.id,
    ]),
    1,
    'La topología histórica también referencia el mismo objeto desde la entrega',
  );
  const controlBefore = await result('select to_jsonb(s) result from app.subjects s where id=$1', [
    control.id,
  ]);
  const draftBefore = await result(
    'select to_jsonb(d) result from app.resource_drafts d where resource_id=$1',
    [resource.id],
  );
  const versionBefore = await result(
    'select to_jsonb(v) result from app.resource_versions v where id=$1',
    [version.id],
  );
  const usersBefore = await result(
    'select jsonb_agg(to_jsonb(u) order by id) result from auth.users u',
  );
  await as(teacher);
  await command('archiveSubject', subject.id);
  await owner();
  await db.query("update app.subjects set archived_at=now()-interval '31 days' where id=$1", [
    subject.id,
  ]);
  await db.query(
    "update app.purge_jobs set due_at=now() where subject_id=$1 and status='scheduled'",
    [subject.id],
  );
  await as(teacher);
  await rejected(
    () => command('restoreSubject', subject.id),
    'RESTORE_UNAVAILABLE',
    'La materia ficticia vencida no se restaura',
  );
  const queue = await maintenance('tick');
  equal(
    queue.files.map((file) => file.id).sort(),
    [exclusiveA.id, exclusiveB.id].sort(),
    'La cola contiene solo los dos archivos exclusivos, no el compartido',
  );
  await owner();
  equal(
    await result('select count(*)::int result from app.subjects where id=$1', [subject.id]),
    0,
    'Se eliminan las relaciones de la materia vencida',
  );
  equal(
    await result('select count(*)::int result from app.submission_files where file_id=$1', [
      shared.id,
    ]),
    0,
    'Se elimina la referencia vencida al archivo compartido',
  );
  equal(
    hash(await fs.readFile(shared.filePath)),
    hash(png),
    'Los bytes compartidos se conservan íntegros tras quitar la materia',
  );
  await as(teacher);
  equal(
    await result('select app.can_file($1) result', [shared.id]),
    true,
    'La biblioteca sigue autorizando la lectura del objeto compartido',
  );
  await rejected(
    () => maintenance('confirmFiles', { ids: [exclusiveA.id, exclusiveB.id] }),
    'STORAGE_OBJECT_REMAINS',
    'No se confirman metadatos mientras persisten objetos',
  );

  await deleteLocalBytes(exclusiveA.id);
  await rejected(
    () => maintenance('confirmFiles', { ids: [exclusiveA.id, exclusiveB.id] }),
    'STORAGE_OBJECT_REMAINS',
    'Fallo parcial: falta borrar el segundo objeto y la confirmación completa se rechaza',
  );
  await owner();
  equal(
    await result("select count(*)::int result from app.file_objects where state='delete_pending'"),
    2,
    'El fallo parcial conserva ambos metadatos pendientes para reintentar',
  );
  equal(
    await result("select count(*)::int result from app.purge_jobs where status='running'"),
    1,
    'El trabajo no se declara terminado tras el fallo parcial',
  );
  const retryQueue = await maintenance('tick');
  equal(
    retryQueue.files.map((file) => file.id).sort(),
    [exclusiveA.id, exclusiveB.id].sort(),
    'El siguiente tick vuelve a entregar los pendientes sin duplicarlos',
  );
  for (const file of retryQueue.files) await deleteLocalBytes(file.id);
  equal(
    (await maintenance('confirmFiles', { ids: [exclusiveA.id, exclusiveB.id] })).deleted,
    2,
    'El reintento elimina dos metadatos después de eliminar los bytes',
  );
  equal(
    (await maintenance('confirmFiles', { ids: [exclusiveA.id, exclusiveB.id] })).deleted,
    0,
    'Repetir la confirmación ya aplicada es idempotente',
  );
  equal(
    (await maintenance('tick')).files,
    [],
    'El tick final no vuelve a ofrecer archivos completados',
  );
  await owner();
  equal(
    await result("select count(*)::int result from app.purge_jobs where status='done'"),
    1,
    'El trabajo finaliza únicamente tras confirmar todos sus objetos exclusivos',
  );
  equal(
    await result('select to_jsonb(s) result from app.subjects s where id=$1', [control.id]),
    controlBefore,
    'La materia de control se conserva íntegra',
  );
  equal(
    await result('select to_jsonb(d) result from app.resource_drafts d where resource_id=$1', [
      resource.id,
    ]),
    draftBefore,
    'El borrador independiente se conserva íntegro',
  );
  equal(
    await result('select to_jsonb(v) result from app.resource_versions v where id=$1', [
      version.id,
    ]),
    versionBefore,
    'La versión publicada independiente se conserva íntegra',
  );
  equal(
    await result('select jsonb_agg(to_jsonb(u) order by id) result from auth.users u'),
    usersBefore,
    'Las cuentas de control se conservan íntegras',
  );
  equal(
    (await fs.readdir(bytesRoot)).sort(),
    [path.basename(shared.filePath)],
    'Solo permanece el archivo compartido en el directorio exclusivo del ensayo',
  );
  equal(
    hash(await fs.readFile(shared.filePath)),
    hash(png),
    'El hash final del archivo compartido coincide con su carga inicial',
  );
  // Segundo recorrido alcanzable por comandos públicos, sin la referencia histórica de entrega.
  await as(teacher);
  const readingSubject = await command('createSubject', {
    name: `${prefix} lectura pública`,
    course: '3C',
    year: 2026,
    description: 'Reutiliza una imagen de biblioteca mediante publicación de lectura.',
  });
  const reading = await command('publishReading', version.id, readingSubject.id);
  await owner();
  equal(
    await result('select version_id result from app.activities where id=$1', [reading.id]),
    version.id,
    'El comando público vincula la versión de biblioteca a una lectura de la materia',
  );
  await as(teacher);
  await command('archiveSubject', readingSubject.id);
  await owner();
  await db.query("update app.subjects set archived_at=now()-interval '31 days' where id=$1", [
    readingSubject.id,
  ]);
  await db.query(
    "update app.purge_jobs set due_at=now() where subject_id=$1 and status='scheduled'",
    [readingSubject.id],
  );
  equal(
    (await maintenance('tick')).files,
    [],
    'Purgar la materia de lectura no propone borrar la imagen de biblioteca',
  );
  await owner();
  equal(
    await result('select count(*)::int result from app.activities where id=$1', [reading.id]),
    0,
    'La actividad de lectura exclusiva de la materia vencida se elimina',
  );
  equal(
    await result('select to_jsonb(v) result from app.resource_versions v where id=$1', [
      version.id,
    ]),
    versionBefore,
    'La versión publicada permanece tras eliminar su actividad de lectura',
  );
  equal(
    hash(await fs.readFile(shared.filePath)),
    hash(png),
    'Los bytes permanecen intactos en el recorrido público de lectura',
  );
  await as(teacher);
  equal(
    await result('select app.can_file($1) result', [shared.id]),
    true,
    'La docente mantiene acceso por biblioteca después de purgar la lectura',
  );
  await owner();
  const completedJobs = await result(
    "select count(*)::int result from app.purge_jobs where status='done'",
  );
  equal(completedJobs, 2, 'Ambos recorridos completan su trabajo de purga');
  report.observation = {
    filesCreated: 3,
    sharedBytes: png.length,
    exclusiveBytesDeleted: 2 * png.length,
    retries: 1,
    completedJobs,
    remoteMutations: 0,
  };
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await db.close();
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({ status: report.status, checks: report.checks.length, report: reportPath }),
  );
}
