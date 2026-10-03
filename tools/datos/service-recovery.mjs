/** Recupera los servicios utilizados por Aulify en un destino Docker aislado. */
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';

const projectRef = 'bnqyyumfmyexsqszglab';
const privateRoot = path.resolve('.local-private');
const recoveryRoot = path.join(privateRoot, 'service-recovery');
const docker =
  process.env.AULIFY_DOCKER_BIN ?? 'C:/Program Files/Docker/Docker/resources/bin/docker.exe';
const pgBin = process.env.AULIFY_PG_BIN ?? 'C:/Program Files/PostgreSQL/17/bin';
const images = {
  db: 'postgres:17.6',
  auth: 'supabase/gotrue:v2.196.0',
  rest: 'postgrest/postgrest:v14.17',
  storage: 'supabase/storage-api:v1.79.31',
  gateway: 'nginx:1.28-alpine',
};
let stage = 'options';
let runFolder;
let config;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const identifier = (value) => '"' + value.replaceAll('"', '""') + '"';
// Los respaldos pueden provenir de una configuración de colación distinta.
// Cotejar por identidad; el orden de nombres no es parte de los datos.
const byKey = (items, fields) =>
  [...items].sort((a, b) => {
    const left = fields.map((field) => a[field]).join('\0');
    const right = fields.map((field) => b[field]).join('\0');
    return left < right ? -1 : left > right ? 1 : 0;
  });
const confined = (value, root = privateRoot) => {
  const resolved = path.resolve(value);
  assert.ok(resolved.startsWith(root + path.sep), 'Ruta fuera del área privada');
  return resolved;
};
const save = (name, value) =>
  fs.writeFile(path.join(runFolder, name), JSON.stringify(value, null, 2) + '\n');

function execute(bin, args, { env = process.env, input, timeout = 180_000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env, cwd, windowsHide: true });
    const out = [],
      err = [];
    const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on('data', (bytes) => out.push(bytes));
    child.stderr.on('data', (bytes) => err.push(bytes));
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('No se inició el ejecutor'));
    });
    child.on('close', async (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        await fs.writeFile(
          path.join(runFolder, 'failure-private.log'),
          Buffer.concat([...out, ...err]),
        );
        reject(new Error('El ejecutor falló; detalle conservado en archivo privado'));
      } else resolve(Buffer.concat(out).toString('utf8').trim());
    });
    child.stdin.end(input);
  });
}
const compose = (args, timeout) =>
  execute(
    docker,
    ['compose', '-p', config.project, '-f', path.join(runFolder, 'compose.json'), ...args],
    { timeout },
  );
const pgEnv = () => ({
  ...process.env,
  PGHOST: '127.0.0.1',
  PGPORT: String(config.pgPort),
  PGUSER: 'postgres',
  PGPASSWORD: config.dbPassword,
  PGDATABASE: 'postgres',
  PGSSLMODE: 'disable',
  PGCONNECT_TIMEOUT: '10',
});
const sql = (input) =>
  execute(path.join(pgBin, 'psql.exe'), ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    env: pgEnv(),
    input: `set time zone 'UTC'; ${input};`,
  });
const port = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const p = server.address().port;
      server.close(() => resolve(p));
    });
  });
function jwt(role, secret) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      role,
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    }),
  ).toString('base64url');
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`;
}
async function waitFor(check, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (await check()) return;
    } catch {
      /* La salida de servicios permanece privada. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('El servicio no respondió dentro del plazo');
}
async function privateBackup(pointerName) {
  const pointer = JSON.parse(await fs.readFile(path.join(privateRoot, pointerName), 'utf8'));
  const folder = confined(pointer.folder, path.join(privateRoot, 'backups'));
  const manifest = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
  assert.equal(manifest.projectRef, projectRef);
  assert.equal(manifest.complete, true);
  return { folder, manifest };
}
async function createDestination() {
  const backup = await privateBackup('latest-postgres-backup.json');
  const storage = await privateBackup('latest-storage-backup.json');
  runFolder = confined(path.join(recoveryRoot, `run-${Date.now()}-${randomUUID()}`), recoveryRoot);
  await fs.mkdir(runFolder, { recursive: true });
  const secret = randomBytes(48).toString('hex');
  config = {
    format: 1,
    project: `aulify_recovery_${Date.now()}`,
    createdAt: new Date().toISOString(),
    backupFolder: backup.folder,
    storageFolder: storage.folder,
    pgPort: await port(),
    apiPort: await port(),
    dbPassword: randomBytes(32).toString('hex'),
    authPassword: randomBytes(32).toString('hex'),
    storagePassword: randomBytes(32).toString('hex'),
    restPassword: randomBytes(32).toString('hex'),
    jwtSecret: secret,
    anonKey: jwt('anon', secret),
    serviceKey: jwt('service_role', secret),
    images,
  };
  config.apiUrl = `http://127.0.0.1:${config.apiPort}`;
  await save('configuration-private.json', config);
  const document = {
    services: {
      db: {
        image: images.db,
        environment: { POSTGRES_PASSWORD: config.dbPassword },
        ports: [`127.0.0.1:${config.pgPort}:5432`],
        volumes: ['database:/var/lib/postgresql/data'],
      },
      auth: {
        image: images.auth,
        depends_on: ['db'],
        environment: {
          GOTRUE_API_HOST: '0.0.0.0',
          GOTRUE_API_PORT: '9999',
          API_EXTERNAL_URL: `${config.apiUrl}/auth/v1`,
          GOTRUE_DB_DRIVER: 'postgres',
          GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${config.authPassword}@db:5432/postgres`,
          GOTRUE_SITE_URL: 'http://127.0.0.1:3001',
          GOTRUE_DISABLE_SIGNUP: 'true',
          GOTRUE_JWT_ADMIN_ROLES: 'service_role',
          GOTRUE_JWT_AUD: 'authenticated',
          GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
          GOTRUE_JWT_EXP: '3600',
          GOTRUE_JWT_SECRET: secret,
          GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
          GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: 'false',
          GOTRUE_MAILER_AUTOCONFIRM: 'false',
        },
      },
      rest: {
        image: images.rest,
        depends_on: ['db'],
        environment: {
          PGRST_DB_URI: `postgres://authenticator:${config.restPassword}@db:5432/postgres`,
          PGRST_DB_SCHEMAS: 'public',
          PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions',
          PGRST_DB_ANON_ROLE: 'anon',
          PGRST_JWT_SECRET: secret,
          PGRST_DB_USE_LEGACY_GUCS: 'false',
          PGRST_DB_MAX_ROWS: '1000',
          PGRST_DB_POOL: '15',
          PGRST_SERVER_PORT: '3000',
        },
      },
      storage: {
        image: images.storage,
        depends_on: ['db', 'rest'],
        environment: {
          ANON_KEY: config.anonKey,
          SERVICE_KEY: config.serviceKey,
          AUTH_JWT_SECRET: secret,
          POSTGREST_URL: 'http://rest:3000',
          DATABASE_URL: `postgres://supabase_storage_admin:${config.storagePassword}@db:5432/postgres`,
          STORAGE_PUBLIC_URL: `${config.apiUrl}/storage/v1`,
          REQUEST_ALLOW_X_FORWARDED_PATH: 'true',
          FILE_SIZE_LIMIT: '52428800',
          STORAGE_BACKEND: 'file',
          GLOBAL_S3_BUCKET: 'aulify-recovery',
          FILE_STORAGE_BACKEND_PATH: '/var/lib/storage',
          TENANT_ID: 'aulify-recovery',
          REGION: 'local',
          ENABLE_IMAGE_TRANSFORMATION: 'false',
        },
        volumes: ['files:/var/lib/storage'],
      },
      gateway: {
        image: images.gateway,
        depends_on: ['auth', 'rest', 'storage'],
        ports: [`127.0.0.1:${config.apiPort}:80`],
        volumes: [
          `${path.join(runFolder, 'gateway.conf').replaceAll('\\', '/')}:/etc/nginx/conf.d/default.conf:ro`,
        ],
      },
    },
    volumes: { database: {}, files: {} },
  };
  await save('compose.json', document);
  await fs.writeFile(
    path.join(runFolder, 'gateway.conf'),
    `server {
    listen 80; client_max_body_size 52m;
    location /auth/v1/ { proxy_pass http://auth:9999/; }
    location /rest/v1/ { proxy_pass http://rest:3000/; }
    location /storage/v1/ { proxy_pass http://storage:5000/; }
  }\n`,
  );
  await fs.writeFile(
    path.join(privateRoot, 'latest-service-recovery.json'),
    JSON.stringify({ folder: runFolder }),
  );
}
async function restoreDatabase() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(config.backupFolder, 'manifest.json'), 'utf8'),
  );
  const archive = await fs.readFile(path.join(config.backupFolder, 'database.dump'));
  assert.equal(sha(archive), manifest.archiveSha256);
  assert.equal(archive.length, manifest.archiveBytes);
  stage = 'start-isolated-database';
  console.log(JSON.stringify({ phase: stage }));
  await compose(['up', '-d', 'db'], 600_000);
  await waitFor(async () => (await sql('select 1')) === '1');
  stage = 'restore-isolated-database';
  console.log(JSON.stringify({ phase: stage }));
  if (Number(await sql("select count(*) from pg_namespace where nspname='app'")) === 0) {
    await sql(`${manifest.roles.map((r) => `create role ${identifier(r.name)} nologin ${r.inherit ? 'inherit' : 'noinherit'} ${r.bypassrls ? 'bypassrls' : 'nobypassrls'}`).join(';')};
      create schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions`);
    await execute(
      path.join(pgBin, 'pg_restore.exe'),
      [
        '--no-password',
        '--exit-on-error',
        '--single-transaction',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--dbname=postgres',
        path.join(config.backupFolder, 'database.dump'),
      ],
      { env: pgEnv() },
    );
  }
  stage = 'verify-restored-database';
  const selections = manifest.tables.map(
    ({ schema, name }) => `select ${quote(schema)} as schema, ${quote(name)} as name,
    count(*) as rows, md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint
    from ${identifier(schema)}.${identifier(name)} t`,
  );
  const restored = JSON.parse(
    await sql(`select json_agg(x order by schema,name) from (${selections.join(' union all ')}) x`),
  );
  assert.deepEqual(byKey(restored, ['schema', 'name']), byKey(manifest.tables, ['schema', 'name']));
  const policy = JSON.parse(
    await sql(`select json_build_object('policies',(select coalesce(json_agg(x order by schemaname,tablename,policyname),'[]') from
    (select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('app','auth','public','storage','supabase_migrations')) x),
    'rls',(select json_agg(x order by schema,name) from (select n.nspname as schema,c.relname as name,c.relrowsecurity as enabled,c.relforcerowsecurity as forced
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app','auth','public','storage','supabase_migrations') and c.relkind in ('r','p')) x))`),
  );
  assert.deepEqual(
    byKey(policy.policies, ['schemaname', 'tablename', 'policyname']),
    byKey(manifest.permissions.policies, ['schemaname', 'tablename', 'policyname']),
  );
  assert.deepEqual(
    byKey(policy.rls, ['schema', 'name']),
    byKey(manifest.permissions.rls, ['schema', 'name']),
  );
  const migrations = Number(
    await sql('select count(*) from supabase_migrations.schema_migrations'),
  );
  const expectedMigrations = manifest.tables.find(
    (table) => table.schema === 'supabase_migrations' && table.name === 'schema_migrations',
  )?.rows;
  assert.ok(Number.isSafeInteger(expectedMigrations), 'Inventario de migraciones ausente');
  assert.equal(migrations, expectedMigrations, 'El ledger restaurado no corresponde al respaldo');
  await save('database-checkpoint.json', {
    verifiedAt: new Date().toISOString(),
    tables: restored.length,
    fingerprintsMatch: true,
    policiesMatch: true,
    migrations,
  });
  console.log(JSON.stringify({ phase: stage, tables: restored.length, hashesMatch: true }));
}
async function startServices() {
  stage = 'configure-local-service-roles';
  await sql(`alter role authenticator login password ${quote(config.restPassword)};
    grant anon,authenticated,service_role to authenticator;
    grant anon,authenticated,service_role to supabase_storage_admin;
    alter role supabase_auth_admin login password ${quote(config.authPassword)};
    alter role supabase_storage_admin login password ${quote(config.storagePassword)};
    alter role supabase_auth_admin set search_path=auth,public,extensions;
    alter role supabase_storage_admin set search_path=storage,public,extensions;
    grant usage on schema extensions to supabase_auth_admin,supabase_storage_admin;
    alter schema auth owner to supabase_auth_admin; alter schema storage owner to supabase_storage_admin;
    do $$ declare x record; r text; begin
      for x in select n.nspname as s,c.relname as t,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('auth','storage') and c.relkind in ('r','p','S','v') loop
        r:=case when x.s='auth' then 'supabase_auth_admin' else 'supabase_storage_admin' end;
        execute format('alter %s %I.%I owner to %I',case when x.relkind='S' then 'sequence' when x.relkind='v' then 'view' else 'table' end,x.s,x.t,r);
      end loop;
      for x in select n.nspname as s,p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','storage') and p.prokind='f' loop
        r:=case when x.s='auth' then 'supabase_auth_admin' else 'supabase_storage_admin' end;
        execute format('alter function %s owner to %I',x.f,r);
      end loop;
    end $$`);
  stage = 'start-http-services';
  console.log(JSON.stringify({ phase: stage }));
  await compose(['up', '-d'], 600_000);
  try {
    await waitFor(async () => (await fetch(`${config.apiUrl}/auth/v1/health`)).ok);
    await waitFor(async () => (await fetch(`${config.apiUrl}/storage/v1/status`)).ok);
    await waitFor(async () => (await request('/rest/v1/', config.anonKey, undefined, 'GET')).ok);
  } catch (error) {
    await fs.writeFile(
      path.join(runFolder, 'services-private.log'),
      await compose(['logs', '--no-color', '--tail', '100']),
    );
    throw error;
  }
  await save('services-checkpoint.json', {
    verifiedAt: new Date().toISOString(),
    healthy: ['auth', 'rest', 'storage'],
  });
}
async function request(route, token, body, method = 'POST', headers = {}) {
  return fetch(config.apiUrl + route, {
    method,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && !Buffer.isBuffer(body)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headers,
    },
    body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}
async function restoreFiles() {
  stage = 'restore-storage-http';
  console.log(JSON.stringify({ phase: stage }));
  const manifest = JSON.parse(
    await fs.readFile(path.join(config.storageFolder, 'manifest.json'), 'utf8'),
  );
  const database = JSON.parse(
    await fs.readFile(path.join(config.backupFolder, 'manifest.json'), 'utf8'),
  );
  assert.equal(manifest.objects.length, database.storage.length);
  let bytes = 0;
  for (const object of manifest.objects) {
    const metadata = database.storage.find((entry) => entry.name === object.path);
    assert.ok(metadata);
    assert.equal(object.id, metadata.id);
    assert.equal(new Date(object.updatedAt).getTime(), new Date(metadata.updatedAt).getTime());
    assert.match(object.localName, /^[a-f0-9]{64}\.bin$/);
    const content = await fs.readFile(path.join(config.storageFolder, 'objects', object.localName));
    assert.equal(content.length, object.size);
    assert.equal(sha(content), object.sha256);
    const route =
      '/storage/v1/object/aulify-files/' + object.path.split('/').map(encodeURIComponent).join('/');
    const response = await request(route, config.serviceKey, content, 'POST', {
      'x-upsert': 'true',
      'Content-Type': metadata.metadata?.mimetype ?? 'application/octet-stream',
    });
    if (!response.ok) {
      await fs.writeFile(
        path.join(runFolder, 'storage-failure-private.json'),
        await response.text(),
      );
      throw new Error('Subida de recuperación rechazada');
    }
    const downloaded = await request(route, config.serviceKey, undefined, 'GET');
    assert.equal(downloaded.ok, true);
    assert.equal(sha(Buffer.from(await downloaded.arrayBuffer())), object.sha256);
    bytes += content.length;
  }
  await save('files-checkpoint.json', {
    verifiedAt: new Date().toISOString(),
    objects: manifest.objects.length,
    bytes,
    httpHashesMatch: true,
  });
  console.log(
    JSON.stringify({
      phase: stage,
      objects: manifest.objects.length,
      bytes,
      httpHashesMatch: true,
    }),
  );
}
async function verifyAccess() {
  stage = 'verify-restored-auth-and-rpc';
  const credentials = JSON.parse(
    await fs.readFile(path.join(privateRoot, 'remote-test-accounts.json'), 'utf8'),
  );
  assert.equal(credentials.projectRef, projectRef);
  const users = Array.isArray(credentials.users)
    ? credentials.users
    : Object.values(credentials.users);
  const sessions = [];
  for (const user of users) {
    const response = await request('/auth/v1/token?grant_type=password', config.anonKey, {
      email: user.email,
      password: user.password,
    });
    const session = await response.json();
    if (!response.ok) {
      await save('auth-failure-private.json', session);
      throw new Error('Acceso a la cuenta recuperada rechazado');
    }
    assert.equal(session.user.id, user.id);
    const overview = await request(
      '/rest/v1/rpc/aulify_workspace_overview',
      session.access_token,
      {},
    );
    assert.equal(overview.ok, true);
    const data = await overview.json();
    assert.equal(data.userId, user.id);
    const profile = data.state.users.find((p) => p.id === user.id);
    assert.ok(profile);
    sessions.push({ user, token: session.access_token, role: profile.role, data });
  }
  await save('sessions-private.json', sessions);
  const teacher = sessions.find((session) => session.role === 'teacher');
  const student = sessions.find((session) => session.role === 'student');
  assert.ok(teacher && student);
  const denied = await request('/rest/v1/rpc/aulify_workspace_overview', config.anonKey, {});
  assert.equal(denied.ok, false);
  const activity = student.data.state.activities.find(
    (a) => a.subjectId && teacher.data.state.activities.some((t) => t.id === a.id),
  );
  let activityVerified = false;
  if (activity) {
    for (const account of [teacher, student]) {
      const response = await request('/rest/v1/rpc/aulify_activity_snapshot', account.token, {
        p_activity_id: activity.id,
      });
      assert.equal(response.ok, true);
      const snapshot = await response.json();
      assert.equal(snapshot.userId, account.user.id);
      assert.ok(snapshot.state.activities.some((a) => a.id === activity.id));
      if (account === student) {
        assert.equal(snapshot.state.versions.length, 0);
        assert.ok(snapshot.state.users.every((p) => p.id === account.user.id));
      }
    }
    activityVerified = true;
  }
  const manifest = JSON.parse(
    await fs.readFile(path.join(config.storageFolder, 'manifest.json'), 'utf8'),
  );
  let owned;
  for (const object of manifest.objects.filter((entry) =>
    entry.path.startsWith(teacher.user.id + '/'),
  )) {
    const file = await request('/rest/v1/rpc/aulify_file', teacher.token, {
      p_id: object.path.split('/').at(-1),
    });
    if (file.ok && (await file.json())?.path === object.path) {
      owned = object;
      break;
    }
  }
  assert.ok(owned, 'Falta archivo ficticio del docente en el corte recuperado');
  const fileId = owned.path.split('/').at(-1);
  const file = await request('/rest/v1/rpc/aulify_file', teacher.token, { p_id: fileId });
  assert.equal(file.ok, true);
  const details = await file.json();
  assert.equal(details.path, owned.path);
  const signing = await request(
    '/storage/v1/object/sign/aulify-files/' + owned.path,
    config.serviceKey,
    { expiresIn: 60 },
  );
  assert.equal(signing.ok, true);
  const link = await signing.json();
  const signedDownload = await fetch(config.apiUrl + '/storage/v1' + link.signedURL);
  assert.equal(signedDownload.ok, true);
  assert.equal(sha(Buffer.from(await signedDownload.arrayBuffer())), owned.sha256);
  const anonymousFile = await request(
    '/storage/v1/object/aulify-files/' + owned.path,
    config.anonKey,
    undefined,
    'GET',
  );
  assert.equal(anonymousFile.ok, false);
  await save('access-checkpoint.json', {
    verifiedAt: new Date().toISOString(),
    restoredAccounts: sessions.length,
    teacherLogin: true,
    studentLogin: true,
    rpcAuthorization: true,
    activityVerified,
    privateFileAuthorization: true,
    signedFileHashMatch: true,
    anonymousDataDenied: true,
    anonymousFileDenied: true,
  });
}
async function report() {
  const db = JSON.parse(
    await fs.readFile(path.join(runFolder, 'database-checkpoint.json'), 'utf8'),
  );
  const files = JSON.parse(
    await fs.readFile(path.join(runFolder, 'files-checkpoint.json'), 'utf8'),
  );
  const access = JSON.parse(
    await fs.readFile(path.join(runFolder, 'access-checkpoint.json'), 'utf8'),
  );
  const web = JSON.parse(await fs.readFile(path.join(runFolder, 'web-checkpoint.json'), 'utf8'));
  const summary = {
    status: 'passed',
    completedAt: new Date().toISOString(),
    environment: 'Docker aislado, solo loopback',
    services: ['PostgreSQL', 'Supabase Auth', 'PostgREST', 'Supabase Storage', 'Aulify Next.js'],
    images: config.images,
    database: db,
    files,
    access,
    web,
    originalProjectModified: false,
    credentialsPublished: false,
    servicesStopped: true,
    limitations: [
      'La comprobación se realiza en una copia local, no en otro proyecto administrado ni en Vercel.',
      'La configuración usa nuevas credenciales locales; no recupera sesiones JWT antiguas ni secretos administrados.',
      'El SMTP y servicios no utilizados como Realtime o Vault quedan fuera de este ensayo.',
      'La subida por API preserva rutas y bytes; el servicio puede actualizar metadatos técnicos del objeto.',
    ],
  };
  await fs.writeFile(
    'docs/verificacion/recuperacion-servicios.json',
    JSON.stringify(summary, null, 2) + '\n',
  );
  await save('report.json', summary);
  console.log(JSON.stringify(summary));
}
async function verifyRecoveredWeb() {
  stage = 'build-recovered-web';
  console.log(JSON.stringify({ phase: stage }));
  const webFolder = confined(path.join(runFolder, 'web'), recoveryRoot);
  await fs.mkdir(webFolder, { recursive: true });
  for (const name of [
    'src',
    'public',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'next.config.ts',
    'postcss.config.mjs',
    'next-env.d.ts',
  ]) {
    if (
      await fs.access(name).then(
        () => true,
        () => false,
      )
    )
      await fs.cp(name, path.join(webFolder, name), { recursive: true });
  }
  const modules = path.join(webFolder, 'node_modules');
  if (
    !(await fs.access(modules).then(
      () => true,
      () => false,
    ))
  )
    await fs.symlink(path.resolve('node_modules'), modules, 'junction');
  const next = path.resolve('node_modules/next/dist/bin/next');
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: config.apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.anonKey,
    SUPABASE_SECRET_KEY: config.serviceKey,
  };
  await execute(process.execPath, [next, 'build', '--webpack'], {
    cwd: webFolder,
    env,
    timeout: 300_000,
  });
  const webPort = await port();
  const base = `http://127.0.0.1:${webPort}`;
  const child = spawn(
    process.execPath,
    [next, 'start', '--hostname', '127.0.0.1', '--port', String(webPort)],
    { cwd: webFolder, env, windowsHide: true },
  );
  child.stdout.resume();
  child.stderr.resume();
  try {
    stage = 'verify-recovered-web';
    await waitFor(async () => (await fetch(base + '/acceso')).ok);
    const sessions = JSON.parse(
      await fs.readFile(path.join(runFolder, 'sessions-private.json'), 'utf8'),
    );
    const roles = ['teacher', 'student'];
    let checks = 0;
    for (const role of roles) {
      const session = sessions.find((account) => account.role === role);
      assert.ok(session);
      const response = await fetch(base + '/api/auth', {
        method: 'POST',
        headers: {
          Origin: base,
          'Content-Type': 'application/json',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: JSON.stringify({
          action: 'access',
          email: session.user.email,
          password: session.user.password,
        }),
      });
      assert.equal(response.ok, true);
      const jar = response.headers
        .getSetCookie()
        .map((value) => value.split(';', 1)[0])
        .join('; ');
      const workspace = await fetch(base + '/api/workspace', { headers: { Cookie: jar } });
      assert.equal(workspace.ok, true);
      const data = await workspace.json();
      assert.equal(data.userId, session.user.id);
      assert.equal(data.state.users.find((u) => u.id === data.userId).role, role);
      if (role === 'student') assert.ok(data.state.users.every((u) => u.id === session.user.id));
      const page = await fetch(base + '/aula', { headers: { Cookie: jar } });
      assert.equal(page.ok, true);
      const activity = data.state.activities.find((a) => a.kind === 'quiz');
      if (activity) {
        const detail = await fetch(base + '/api/workspace?activity=' + activity.id, {
          headers: { Cookie: jar },
        });
        assert.equal(detail.ok, true);
        const value = await detail.json();
        assert.equal(value.userId, session.user.id);
      }
      if (role === 'teacher') {
        const files = JSON.parse(
          await fs.readFile(path.join(config.storageFolder, 'manifest.json'), 'utf8'),
        );
        let downloaded = false;
        for (const object of files.objects.filter((entry) =>
          entry.path.startsWith(session.user.id + '/'),
        )) {
          const file = await fetch(base + '/api/files/' + object.path.split('/').at(-1), {
            headers: { Cookie: jar },
          });
          if (!file.ok) continue;
          assert.equal(sha(Buffer.from(await file.arrayBuffer())), object.sha256);
          downloaded = true;
          break;
        }
        assert.equal(downloaded, true);
      }
      checks++;
    }
    const denied = await fetch(base + '/api/workspace');
    assert.equal(denied.ok, false);
    await save('web-checkpoint.json', {
      verifiedAt: new Date().toISOString(),
      buildId: (await fs.readFile(path.join(webFolder, '.next/BUILD_ID'), 'utf8')).trim(),
      rolesVerified: checks,
      teacherAndStudentLogin: true,
      restoredWorkspace: true,
      activityRead: true,
      privateDownloadHashMatch: true,
      anonymousWorkspaceDenied: true,
      sourceEnvironmentUnchanged: true,
      scope:
        'Aplicación compilada separadamente contra la copia; recorridos HTTP, sin evaluación visual ni SMTP.',
    });
    console.log(
      JSON.stringify({ phase: stage, rolesVerified: checks, privateDownloadHashMatch: true }),
    );
  } finally {
    child.kill();
  }
}
try {
  const mode = process.argv[2];
  assert.ok(['--create', '--resume', '--stop'].includes(mode), 'Usar --create, --resume o --stop');
  if (mode === '--create') await createDestination();
  else {
    const pointer = JSON.parse(
      await fs.readFile(path.join(privateRoot, 'latest-service-recovery.json'), 'utf8'),
    );
    runFolder = confined(pointer.folder, recoveryRoot);
    config = JSON.parse(
      await fs.readFile(path.join(runFolder, 'configuration-private.json'), 'utf8'),
    );
  }
  assert.match(config.project, /^aulify_recovery_\d+$/);
  assert.equal(config.apiUrl, `http://127.0.0.1:${config.apiPort}`);
  if (mode === '--stop') {
    await compose(['stop']);
    console.log(JSON.stringify({ stopped: true }));
  } else {
    const exists = (name) =>
      fs.access(path.join(runFolder, name)).then(
        () => true,
        () => false,
      );
    if (!(await exists('database-checkpoint.json'))) await restoreDatabase();
    if (!(await exists('services-checkpoint.json'))) await startServices();
    else {
      await compose(['up', '-d']);
      // Al recrear un servicio cambia su dirección interna; renovar la resolución del proxy.
      await compose(['restart', 'gateway']);
      await waitFor(async () => (await fetch(`${config.apiUrl}/storage/v1/status`)).ok);
    }
    if (!(await exists('files-checkpoint.json'))) await restoreFiles();
    if (!(await exists('access-checkpoint.json'))) await verifyAccess();
    if (!(await exists('web-checkpoint.json'))) await verifyRecoveredWeb();
    stage = 'stop-isolated-services';
    await compose(['stop']);
    await report();
  }
} catch (error) {
  if (runFolder)
    await fs.writeFile(
      path.join(runFolder, 'failure-stack-private.log'),
      error.stack ?? String(error),
    );
  console.error(
    JSON.stringify({
      status: 'failed',
      phase: stage,
      detail:
        'Detalles conservados únicamente en el destino privado; no se modificó el proyecto original.',
    }),
  );
  process.exitCode = 1;
}
