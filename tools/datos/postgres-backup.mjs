/** Respaldo lógico privado y ensayo de recuperación en PostgreSQL nativo. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';

const projectRef = 'bnqyyumfmyexsqszglab';
const schemas = ['app', 'auth', 'public', 'storage', 'supabase_migrations'];
const root = path.resolve('.local-private/backups');
const pgBin = process.env.AULIFY_PG_BIN ?? 'C:/Program Files/PostgreSQL/17/bin';
let stage = 'options';
const executable = (name) => path.join(pgBin, name + (os.platform() === 'win32' ? '.exe' : ''));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const identifier = (value) => '"' + value.replaceAll('"', '""') + '"';
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const privatePath = (value) => {
  const resolved = path.resolve(value);
  assert.ok(resolved.startsWith(root + path.sep), 'Destino fuera del respaldo privado');
  return resolved;
};

function run(name, args, env, input, timeout = 180_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable(name), args, { env, windowsHide: true });
    const stdout = [];
    let size = 0;
    // Los mensajes de PostgreSQL pueden contener filas o valores privados.
    // Nunca imprimir stderr ni incorporar estos mensajes en una excepción pública.
    let errorText = '';
    child.stderr.on('data', (chunk) => {
      if (errorText.length < 1024 * 1024) errorText += chunk.toString();
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16 * 1024 * 1024) child.kill();
      else stdout.push(chunk);
    });
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error(`No se pudo iniciar ${name}`));
    });
    const complete = async (code) => {
      clearTimeout(timer);
      if (name === 'pg_ctl') {
        // En Windows el servidor puede heredar las tuberías del proceso de arranque.
        // Su vida no debe impedir resolver la salida de pg_ctl.
        child.stdout.destroy();
        child.stderr.destroy();
      }
      if (code !== 0) {
        try {
          await fs.writeFile(
            path.join(root, `${name}-${Date.now()}-error-private.log`),
            errorText,
            { mode: 0o600 },
          );
        } catch {
          /* La excepción pública nunca contiene el stderr privado. */
        }
        const category = timedOut
          ? 'timeout'
          : /schema .*public.*already exists/i.test(errorText)
            ? 'public-schema-exists'
            : /role .*does not exist/i.test(errorText)
              ? 'missing-role'
              : /function .*does not exist/i.test(errorText)
                ? 'missing-function'
                : /type .*does not exist/i.test(errorText)
                  ? 'missing-type'
                  : /extension .*not available/i.test(errorText)
                    ? 'missing-extension'
                    : /permission denied/i.test(errorText)
                      ? 'permission'
                      : /could not connect|connection refused/i.test(errorText)
                        ? 'connection'
                        : 'execution';
        reject(new Error(`Falló ${name} (${category}); detalles privados omitidos`));
      } else resolve(Buffer.concat(stdout).toString('utf8').trim());
    };
    child.on(name === 'pg_ctl' ? 'exit' : 'close', complete);
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function sourceConnection() {
  const connection = parseEnv(await fs.readFile('.local-private/postgres-backup.env', 'utf8'));
  assert.equal(connection.PGHOST, 'aws-0-sa-east-1.pooler.supabase.com');
  assert.equal(connection.PGPORT, '5432');
  assert.equal(connection.PGUSER, `postgres.${projectRef}`);
  assert.equal(connection.PGDATABASE, 'postgres');
  assert.equal(connection.PGSSLMODE, 'require');
  assert.ok(connection.PGPASSWORD, 'Falta la contraseña en el archivo privado');
  return { ...process.env, ...connection, PGCONNECT_TIMEOUT: '15' };
}

const query = (env, sql, snapshot) =>
  run(
    'psql',
    ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1'],
    env,
    snapshot
      ? `begin isolation level repeatable read read only; set transaction snapshot ${literal(snapshot)}; set time zone 'UTC'; ${sql}; commit;`
      : `set time zone 'UTC'; ${sql};`,
  );

async function holdSnapshot(env) {
  const child = spawn(executable('psql'), ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    env,
    windowsHide: true,
  });
  child.stderr.resume();
  let exited = false;
  const completed = new Promise((resolve) =>
    child.on('close', (code) => {
      exited = true;
      resolve(code);
    }),
  );
  const snapshot = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('No se abrió la instantánea'));
    }, 20_000);
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('No se abrió PostgreSQL'));
    });
    child.on('close', () => {
      clearTimeout(timer);
      reject(new Error('La instantánea se cerró antes de exportarse'));
    });
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/(?:^|\n)([A-Fa-f0-9]+-[A-Fa-f0-9]+-\d+)(?:\r?\n)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.stdin.write(
      'begin isolation level repeatable read read only; select pg_export_snapshot();\n',
    );
  });
  return {
    snapshot,
    close: async () => {
      if (!exited) child.stdin.end('commit;\n');
      const code = await completed;
      assert.equal(code, 0, 'La sesión de instantánea no terminó correctamente');
    },
  };
}

async function inventory(env, snapshot) {
  const tables = JSON.parse(
    await query(
      env,
      `select coalesce(json_agg(x order by schema,name),'[]')
    from (select n.nspname as schema,c.relname as name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in (${schemas.map(literal).join(',')}) and c.relkind in ('r','p')) x`,
      snapshot,
    ),
  );
  const selections = tables.map(
    ({ schema, name }) => `select ${literal(schema)} as schema,
    ${literal(name)} as name,count(*) as rows,
    md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as fingerprint
    from ${identifier(schema)}.${identifier(name)} t`,
  );
  return JSON.parse(
    await query(
      env,
      `select json_agg(x order by schema,name) from (${selections.join(' union all ')}) x`,
      snapshot,
    ),
  );
}

async function permissions(env, snapshot) {
  return JSON.parse(
    await query(
      env,
      `select json_build_object(
    'policies',(select coalesce(json_agg(x order by schemaname,tablename,policyname),'[]')
      from (select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
      from pg_policies where schemaname in (${schemas.map(literal).join(',')})) x),
    'rls',(select json_agg(x order by schema,name) from
      (select n.nspname as schema,c.relname as name,c.relrowsecurity as enabled,
      c.relforcerowsecurity as forced from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in (${schemas.map(literal).join(',')}) and c.relkind in ('r','p')) x))`,
      snapshot,
    ),
  );
}

async function createBackup() {
  stage = 'source-snapshot';
  const env = await sourceConnection();
  const folder = privatePath(path.join(root, `postgres-${Date.now()}-${randomUUID()}`));
  await fs.mkdir(folder, { recursive: true });
  const startedAt = new Date().toISOString();
  const held = await holdSnapshot(env);
  let manifest;
  try {
    const roles = JSON.parse(
      await query(
        env,
        `select json_agg(x order by name) from
      (select rolname as name,rolinherit as inherit,rolbypassrls as bypassrls
      from pg_roles where rolname not like 'pg_%' and rolname<>'postgres') x`,
        held.snapshot,
      ),
    );
    const tableInventory = await inventory(env, held.snapshot);
    const policyInventory = await permissions(env, held.snapshot);
    const storage = JSON.parse(
      await query(
        env,
        `select coalesce(json_agg(x order by name),'[]')
      from (select id,name,metadata,updated_at as "updatedAt" from storage.objects
      where bucket_id='aulify-files') x`,
        held.snapshot,
      ),
    );
    console.log(JSON.stringify({ phase: 'export', tables: tableInventory.length }));
    await run(
      'pg_dump',
      [
        '--format=custom',
        '--compress=6',
        '--no-password',
        ...schemas.map((schema) => `--schema=${schema}`),
        `--snapshot=${held.snapshot}`,
        `--file=${path.join(folder, 'database.dump')}`,
      ],
      env,
      undefined,
      600_000,
    );
    const archive = await fs.readFile(path.join(folder, 'database.dump'));
    assert.ok(archive.length < 256 * 1024 * 1024, 'Respaldo superior al límite privado');
    manifest = {
      format: 1,
      projectRef,
      schemas,
      startedAt,
      capturedAt: new Date().toISOString(),
      postgresVersion: await query(env, "select current_setting('server_version')", held.snapshot),
      complete: true,
      archiveBytes: archive.length,
      archiveSha256: sha(archive),
      roles,
      tables: tableInventory,
      permissions: policyInventory,
      storage,
      limitations: [
        'No incluye Realtime, Vault ni credenciales de los servicios administrados.',
        'Las contraseñas cifradas de Auth son datos privados del archivo; no se exportan contraseñas de roles PostgreSQL.',
        'Los bytes de Storage se respaldan aparte; este archivo no demuestra la restauración de sus servicios HTTP.',
      ],
    };
  } finally {
    await held.close();
  }
  await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2), {
    flag: 'wx',
  });
  await fs.writeFile(
    '.local-private/latest-postgres-backup.json',
    JSON.stringify({ folder }, null, 2),
  );
  const summary = {
    status: 'passed',
    projectRef,
    startedAt,
    capturedAt: manifest.capturedAt,
    postgresVersion: manifest.postgresVersion,
    schemas,
    tables: manifest.tables.length,
    appTables: manifest.tables.filter((table) => table.schema === 'app').length,
    archiveBytes: manifest.archiveBytes,
    archiveSha256: manifest.archiveSha256,
    storageMetadataObjects: manifest.storage.length,
    credentialsPublished: false,
    limitations: manifest.limitations,
  };
  await fs.writeFile(
    'docs/verificacion/respaldo-postgres.json',
    JSON.stringify(summary, null, 2) + '\n',
  );
  console.log(JSON.stringify(summary));
}

async function verifyBackup(directory) {
  const folder = privatePath(directory);
  const manifest = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
  assert.equal(manifest.projectRef, projectRef);
  assert.deepEqual(manifest.schemas, schemas);
  assert.equal(manifest.complete, true);
  const archive = await fs.readFile(path.join(folder, 'database.dump'));
  assert.equal(archive.length, manifest.archiveBytes);
  assert.equal(sha(archive), manifest.archiveSha256);
  return { folder, manifest };
}

async function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function restoreTest(directory) {
  stage = 'verify-archive';
  const { folder, manifest } = await verifyBackup(directory);
  const recovery = privatePath(path.join(root, `recovery-${Date.now()}-${randomUUID()}`));
  await fs.mkdir(recovery, { recursive: true });
  const password = randomBytes(32).toString('hex');
  const passwordFile = path.join(recovery, 'local-password.txt');
  await fs.writeFile(passwordFile, password + '\n', { flag: 'wx' });
  const port = await unusedPort();
  // La restauración siempre utiliza un clúster nuevo y escucha solo en loopback.
  const env = {
    ...process.env,
    PGHOST: '127.0.0.1',
    PGPORT: String(port),
    PGUSER: 'postgres',
    PGDATABASE: 'postgres',
    PGPASSWORD: password,
    PGSSLMODE: 'disable',
  };
  const cluster = path.join(recovery, 'cluster');
  stage = 'initialize-local-cluster';
  try {
    await run(
      'initdb',
      [
        '-D',
        cluster,
        '-U',
        'postgres',
        '--encoding=UTF8',
        '--locale=C',
        '--auth=scram-sha-256',
        `--pwfile=${passwordFile}`,
      ],
      env,
    );
    await run(
      'pg_ctl',
      [
        '-D',
        cluster,
        '-l',
        path.join(recovery, 'postgres.log'),
        '-o',
        `-p ${port} -h 127.0.0.1`,
        '-t',
        '30',
        '-w',
        'start',
      ],
      env,
      undefined,
      40_000,
    );
    stage = 'verify-local-address';
    assert.equal(await query(env, 'select host(inet_server_addr())'), '127.0.0.1');
    stage = 'prepare-local-roles';
    const roles = manifest.roles
      .map(
        (role) =>
          `create role ${identifier(role.name)} nologin ${role.inherit ? 'inherit' : 'noinherit'} ${role.bypassrls ? 'bypassrls' : 'nobypassrls'};`,
      )
      .join('\n');
    await query(
      env,
      `${roles}\n create schema extensions;
      create extension if not exists pgcrypto with schema extensions;
      create extension if not exists "uuid-ossp" with schema extensions;`,
    );
    console.log(JSON.stringify({ phase: 'restore', isolated: true }));
    stage = 'restore-archive';
    await run(
      'pg_restore',
      [
        '--no-password',
        '--exit-on-error',
        '--single-transaction',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--dbname=postgres',
        path.join(folder, 'database.dump'),
      ],
      env,
    );
    const restored = await inventory(env);
    stage = 'verify-table-fingerprints';
    assert.deepEqual(restored, manifest.tables, 'Filas o huellas de tablas diferentes');
    stage = 'verify-rls';
    assert.deepEqual(
      await permissions(env),
      manifest.permissions,
      'Políticas o estados RLS diferentes',
    );
    const ledger = Number(
      await query(env, 'select count(*) from supabase_migrations.schema_migrations'),
    );
    const expectedMigrations = manifest.tables.find(
      (table) => table.schema === 'supabase_migrations' && table.name === 'schema_migrations',
    )?.rows;
    assert.ok(Number.isSafeInteger(expectedMigrations), 'Inventario de migraciones ausente');
    assert.equal(
      ledger,
      expectedMigrations,
      'La copia no contiene el corte de migraciones esperado',
    );

    stage = 'verify-storage-pair';
    const storagePointer = JSON.parse(
      await fs.readFile('.local-private/latest-storage-backup.json', 'utf8'),
    );
    const storageFolder = privatePath(storagePointer.folder);
    const storageManifest = JSON.parse(
      await fs.readFile(path.join(storageFolder, 'manifest.json'), 'utf8'),
    );
    assert.equal(storageManifest.projectRef, projectRef);
    assert.equal(storageManifest.complete, true);
    const sorted = [...storageManifest.objects].sort((a, b) => a.path.localeCompare(b.path));
    const databaseObjects = [...manifest.storage].sort((a, b) => a.name.localeCompare(b.name));
    assert.equal(
      sorted.length,
      databaseObjects.length,
      'Storage y la instantánea tienen distintos objetos',
    );
    const restoredObjects = path.join(recovery, 'storage-objects');
    await fs.mkdir(restoredObjects);
    let bytes = 0;
    for (let index = 0; index < sorted.length; index++) {
      const object = sorted[index];
      const metadata = databaseObjects[index];
      assert.equal(object.path, metadata.name, 'Ruta de Storage distinta del respaldo SQL');
      assert.equal(object.id, metadata.id, 'Identificador de Storage distinto');
      assert.equal(
        new Date(object.updatedAt).getTime(),
        new Date(metadata.updatedAt).getTime(),
        'Objeto modificado entre copias',
      );
      assert.equal(object.size, Number(metadata.metadata?.size), 'Tamaño de Storage distinto');
      assert.match(object.localName, /^[a-f0-9]{64}\.bin$/);
      const content = await fs.readFile(path.join(storageFolder, 'objects', object.localName));
      assert.equal(content.length, object.size);
      assert.equal(sha(content), object.sha256);
      await fs.writeFile(path.join(restoredObjects, object.localName), content, { flag: 'wx' });
      assert.equal(
        sha(await fs.readFile(path.join(restoredObjects, object.localName))),
        object.sha256,
      );
      bytes += content.length;
    }
    const summary = {
      status: 'passed',
      environment: 'PostgreSQL nativo aislado y archivos locales',
      sourceProject: projectRef,
      postgresVersion: await query(env, "select current_setting('server_version')"),
      restoredAt: new Date().toISOString(),
      schemas,
      tables: restored.length,
      appTables: restored.filter((table) => table.schema === 'app').length,
      migrations: ledger,
      allTableFingerprintsMatch: true,
      rlsPoliciesMatch: true,
      storageObjects: sorted.length,
      storageBytes: bytes,
      allStorageHashesMatch: true,
      originalProjectModified: false,
      credentialsPublished: false,
      limitations: [
        'No recrea Supabase Auth HTTP, PostgREST ni Storage HTTP en otro proyecto.',
        'El cotejo detecta diferencias de objetos entre copias; no crea una instantánea atómica de base y archivos.',
        'No restaura roles de inicio de sesión, configuración SMTP, Realtime ni Vault.',
      ],
    };
    await fs.writeFile(path.join(recovery, 'result.json'), JSON.stringify(summary, null, 2));
    await fs.writeFile(
      'docs/verificacion/restauracion-postgres-nativa.json',
      JSON.stringify(summary, null, 2) + '\n',
    );
    await fs.writeFile(
      '.local-private/latest-postgres-recovery.json',
      JSON.stringify({ folder: recovery, ...summary }, null, 2),
    );
    console.log(JSON.stringify(summary));
  } finally {
    const running = await fs.access(path.join(cluster, 'postmaster.pid')).then(
      () => true,
      () => false,
    );
    try {
      if (running)
        await run(
          'pg_ctl',
          ['-D', cluster, '-m', 'fast', '-t', '30', '-w', 'stop'],
          env,
          undefined,
          40_000,
        );
    } finally {
      await fs.unlink(passwordFile);
    }
  }
}

try {
  const operation = process.argv[2];
  if (operation === '--create') await createBackup();
  else if (operation === '--verify') {
    const { manifest } = await verifyBackup(process.argv[3]);
    console.log(
      JSON.stringify({
        status: 'passed',
        archiveBytes: manifest.archiveBytes,
        tables: manifest.tables.length,
      }),
    );
  } else if (operation === '--restore-test') await restoreTest(process.argv[3]);
  else throw new Error('Usar --create, --verify RUTA_PRIVADA o --restore-test RUTA_PRIVADA');
} catch (error) {
  // Las excepciones de assert no se serializan: pueden contener inventarios privados.
  console.error(
    JSON.stringify({
      status: 'failed',
      stage,
      reason:
        error instanceof assert.AssertionError
          ? 'No coincide una condición de integridad; detalles privados omitidos'
          : error.message.replaceAll(/\b(?:postgresql|postgres):\/\/\S+/g, '[conexión privada]'),
    }),
  );
  process.exitCode = 1;
}
