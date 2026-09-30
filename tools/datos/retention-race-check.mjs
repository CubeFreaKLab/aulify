import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Clúster nuevo y desechable: nunca se conecta a una instalación o base existente.
const bin = process.env.AULIFY_POSTGRES_BIN ?? 'C:/Program Files/PostgreSQL/17/bin';
const suffix = process.platform === 'win32' ? '.exe' : '';
const executable = (name) => path.join(bin, name + suffix);
const cutoff = '20260930000631_aulify_teacher_review_projection.sql';
const scriptPath = 'tools/datos/retention-race-check.mjs';
const reportPath = 'docs/verificacion/carrera-restauracion-purga.json';
const hash = (data) => createHash('sha256').update(data).digest('hex');
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const user = randomUUID(), other = randomUUID(), student = randomUUID();
await fs.mkdir('.local-private', { recursive: true });
const directory = await fs.mkdtemp(path.resolve('.local-private/retention-race-'));
const cluster = path.join(directory, 'cluster');
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const selected = server.address().port;
    server.close(() => resolve(selected));
  });
});
const report = {
  startedAt: new Date().toISOString(), status: 'running',
  environment: 'PostgreSQL nativo local; clúster exclusivo nuevo; conexiones concurrentes reales',
  script: { path: scriptPath, sha256: hash(await fs.readFile(scriptPath)) },
  migrationCutoff: cutoff, scenarios: [], checks: [],
  limitations: [
    'No ejecuta mantenimiento remoto ni prueba el servicio de objetos de Supabase.',
    'Auth y Storage se representan con esquemas de prueba; los comandos de dominio y mantenimiento son los migrados sin modificación.',
    'Se ajusta archived_at en los fixtures para alcanzar el límite de treinta días sin esperar ese plazo; no mide el objetivo operativo de veinticuatro horas.',
    'PGlite tiene una sola conexión exclusiva; no se usa para demostrar bloqueos entre sesiones.',
  ],
};
const equal = (actual, expected, detail) => {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`ASSERT: ${detail}`);
  report.checks.push({ detail, result: 'passed' });
  console.log(`PASS ${detail}`);
};
const run = (name, args) => new Promise((resolve, reject) => {
  const child = spawn(executable(name), args, { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
  let stdout='',stderr='';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data',(chunk)=>{stdout+=chunk;});
  child.stderr.on('data',(chunk)=>{stderr+=chunk;});
  child.on('error',reject);
  // pg_ctl puede dejar handles heredados en postgres.exe; esperar su salida, no el cierre de esos handles.
  child.on('exit',(code)=>{
    child.stdout.destroy(); child.stderr.destroy();
    if(code===0)resolve({stdout,stderr});else reject(new Error(`${name}: ${stderr||stdout}`));
  });
});
const sessions = [];
class Session {
  constructor(name) {
    this.name = name;
    this.buffer = '';
    this.errors = '';
    this.child = spawn(executable('psql'), ['-X', '-qAt', '-P', 'pager=off', '-v', 'VERBOSITY=verbose', '-h', '127.0.0.1', '-p', String(port), '-U', 'retention_test', '-d', 'postgres'], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PGCLIENTENCODING: 'UTF8', PGAPPNAME: name, PGCONNECT_TIMEOUT: '5' },
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => { this.buffer += chunk; this.flush(); });
    this.child.stderr.on('data', (chunk) => { this.errors += chunk; });
    this.child.on('error', (error) => this.pending?.reject(error));
    this.child.on('exit', (code) => { if (this.pending) this.pending.reject(new Error(`psql ${name} exited ${code}`)); });
    sessions.push(this);
  }
  flush() {
    const pending = this.pending;
    if (!pending || !this.buffer.includes(pending.marker)) return;
    this.pending = null;
    const output = this.buffer.slice(0, this.buffer.indexOf(pending.marker)).trim();
    this.buffer = this.buffer.slice(this.buffer.indexOf(pending.marker) + pending.marker.length).replace(/^\r?\n/, '');
    // stderr y stdout son flujos separados: dejar drenar el diagnóstico anterior al marcador.
    setTimeout(() => {
      const error = this.errors.slice(pending.errorStart);
      if (/ERROR:|FATAL:/.test(error)) {
        const failure = new Error(error.trim());
        failure.code = error.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5}):/)?.[1];
        pending.reject(failure);
      } else pending.resolve(output);
    }, 10);
  }
  exec(sql) {
    if (this.pending) throw new Error(`Consulta superpuesta en ${this.name}`);
    return new Promise((resolve, reject) => {
      const marker = `done_${randomUUID().replaceAll('-', '')}`;
      this.pending = { marker, errorStart: this.errors.length, resolve, reject };
      this.child.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
  }
  async json(sql) { return JSON.parse(await this.exec(sql)); }
  async init() {
    await this.exec("set statement_timeout='8s'; set lock_timeout='6s';");
    this.pid = Number(await this.exec('select pg_backend_pid();'));
    return this;
  }
  async close() {
    if (this.child.exitCode === null) {
      const ended = new Promise((resolve) => this.child.once('exit', resolve));
      this.child.stdin.end('rollback;\n\\q\n');
      await ended;
    }
  }
}
const actor = (session, id = user) => session.exec(`set role authenticated; set request.jwt.claim.sub=${quote(id)};`);
const command = (session, action, ...args) => session.json(`select public.aulify_command(${quote(action)},${quote(JSON.stringify({ args }))}::jsonb);`);
const tick = async (session) => { await session.exec('set role service_role;'); return session.json("select public.aulify_maintenance('tick');"); };
const rejected = async (work, match, detail) => {
  let failure;
  try { await work(); } catch (error) { failure = error; }
  equal(Boolean(failure?.message.includes(match)), true, detail);
  return failure?.code;
};
let started = false;
try {
  report.postgresVersion = (await run('postgres', ['--version'])).stdout.trim();
  await run('initdb', ['-D', cluster, '-U', 'retention_test', '--auth=trust', '--encoding=UTF8', '--no-locale']);
  await run('pg_ctl', ['-D', cluster, '-l', path.join(directory, 'postgres.log'), '-w', '-t', '20', 'start', '-o', `-h 127.0.0.1 -p ${port} -c max_connections=12 -c log_min_messages=warning`]);
  started = true;
  const admin = await new Session('retention-observer').init();
  await admin.exec(`
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
  report.migrations = [];
  for (const filename of (await fs.readdir('supabase/migrations')).filter((name) => name.endsWith('.sql') && name <= cutoff).sort()) {
    const sql = await fs.readFile(`supabase/migrations/${filename}`, 'utf8');
    await admin.exec(sql);
    report.migrations.push({ filename, sha256: hash(sql) });
  }
  equal(report.migrations.length, 18, 'El ensayo fija las dieciocho migraciones confirmadas');
  for (const [id, role] of [[user, 'teacher'], [other, 'teacher'], [student, 'student']])
    await admin.exec(`insert into auth.users values(${quote(id)},${quote(id+'@example.test')},now(),${quote(JSON.stringify({name:'Cuenta ficticia',role}))}::jsonb);`);
  const restore = await new Session('retention-restore').init();
  const purge = await new Session('retention-purge').init();
  const secondPurge = await new Session('retention-second-purge').init();
  report.independentBackendCount = new Set(sessions.map((session) => session.pid)).size;
  const createSubject = async (label) => {
    await actor(admin);
    return command(admin, 'createSubject', { name: label, course: '3A', year: 2026, description: 'Fixture aislado de concurrencia' });
  };
  const archive = async (id, remaining) => {
    await actor(admin);
    await command(admin, 'archiveSubject', id);
    await admin.exec(`reset role;
      update app.subjects set archived_at=clock_timestamp()-interval '30 days'+interval '${remaining}' where id=${quote(id)};
      update app.purge_jobs set due_at=(select archived_at+interval '30 days' from app.subjects where id=${quote(id)}) where subject_id=${quote(id)};`);
  };
  const subjectState = (id) => admin.json(`select coalesce((select jsonb_build_object('archived',archived_at is not null,'purgeStarted',purge_started_at is not null) from app.subjects where id=${quote(id)}),'null'::jsonb);`);
  const jobState = (id) => admin.json(`select coalesce(jsonb_agg(status order by id),'[]') from app.purge_jobs where subject_id=${quote(id)};`);
  const waitDue = (id) => admin.exec(`select pg_sleep(greatest(0,extract(epoch from ((select archived_at+interval '30 days' from app.subjects where id=${quote(id)})-clock_timestamp()))+0.04));`);
  const blockedBy = async (waiting, blocking) => {
    for (let index = 0; index < 80; index++) {
      const state = await admin.json(`select jsonb_build_object('blocked',${blocking.pid}=any(pg_blocking_pids(${waiting.pid})),'waitType',(select wait_event_type from pg_stat_activity where pid=${waiting.pid}));`);
      if (state.blocked) return state;
      await delay(15);
    }
    throw new Error('No se observó el bloqueo esperado entre procesos PostgreSQL.');
  };
  const control = await createSubject('Materia de control intacta');
  await admin.exec('reset role;');
  const controlBefore = await admin.json(`select to_jsonb(s) from app.subjects s where id=${quote(control.id)};`);
  const profilesBefore = await admin.json('select jsonb_agg(to_jsonb(p) order by id) from app.profiles p;');
  const fileId = randomUUID();
  await admin.exec(`insert into app.file_objects(id,owner_id,bucket,object_path,original_name,mime_type,byte_size,sha256,state,validated_at) values(${quote(fileId)},${quote(user)},'aulify-files',${quote(user+'/'+fileId)},'fixture.png','image/png',68,${quote('a'.repeat(64))},'ready',now());
    insert into storage.objects(bucket_id,name,owner_id) values('aulify-files',${quote(user+'/'+fileId)},${quote(user)});`);
  await actor(admin);
  const resource = { id: randomUUID(), ownerId: user, title:'Biblioteca conservada',kind:'resource',revision:1,updatedAt:new Date().toISOString(),blocks:[{id:randomUUID(),type:'image',fileId,url:`/api/files/${fileId}`,alt:'Imagen ficticia compartida por lecturas'}] };
  await command(admin,'saveDraft',resource,0);
  const version = await command(admin,'publishResource',resource.id);
  await command(admin,'publishReading',version.id,control.id);
  await admin.exec('reset role;');
  const libraryBefore = await admin.json(`select jsonb_build_object('resource',(select to_jsonb(r) from app.resources r where id=${quote(resource.id)}),'draft',(select to_jsonb(d) from app.resource_drafts d where resource_id=${quote(resource.id)}),'version',(select to_jsonb(v) from app.resource_versions v where id=${quote(version.id)}),'file',(select to_jsonb(f) from app.file_objects f where id=${quote(fileId)}));`);

  const first = await createSubject('Restauración confirma antes de purga');
  await archive(first.id,'600 milliseconds');
  await restore.exec('begin;'); await actor(restore);
  equal(await command(restore,'restoreSubject',first.id),true,'Restauración obtiene el bloqueo antes del límite');
  await waitDue(first.id);
  equal(await tick(purge),{files:[]},'Purga posterior al límite omite la materia bloqueada por restauración');
  equal(await subjectState(first.id),{archived:true,purgeStarted:false},'La sesión observadora aún ve el archivo no confirmado');
  await restore.exec('commit;');
  await tick(purge);
  equal(await subjectState(first.id),{archived:false,purgeStarted:false},'La restauración confirmada sobrevive al siguiente lote');
  equal(await jobState(first.id),['cancelled'],'La restauración cancela el trabajo pendiente');
  report.scenarios.push({name:'Restauración antes del límite mantiene bloqueo al cruzarlo',result:'restauración preservada; mantenimiento SKIP LOCKED'});

  const second = await createSubject('Purga gana después del límite');
  await actor(admin); await command(admin,'publishReading',version.id,second.id);
  await archive(second.id,'-1 second');
  await purge.exec('begin;'); await tick(purge);
  await restore.exec('begin;'); await actor(restore);
  const restoreOutcome = command(restore,'restoreSubject',second.id).then((value)=>({value}),(error)=>({error}));
  const lock = await blockedBy(restore,purge);
  equal(lock.waitType,'Lock','Restauración espera el bloqueo transaccional de la purga');
  await purge.exec('commit;');
  const result = await restoreOutcome;
  equal(Boolean(result.error?.message.includes('RESTORE_UNAVAILABLE')),true,'Después del borrado confirmado, restauración es rechazada');
  await restore.exec('rollback;');
  equal(await subjectState(second.id),null,'Purga confirmada elimina únicamente la materia vencida');
  report.scenarios.push({name:'Purga bloquea primero una materia vencida',lockObserved:lock,result:'restauración espera y rechaza después del commit'});

  const third = await createSubject('Restauración revierte después del límite');
  await archive(third.id,'600 milliseconds');
  await restore.exec('begin;'); await actor(restore); await command(restore,'restoreSubject',third.id);
  await waitDue(third.id); await tick(purge);
  await restore.exec('rollback;');
  equal(await subjectState(third.id),{archived:true,purgeStarted:false},'Rollback de restauración conserva materia archivada y sin marca de purga');
  await tick(purge);
  equal(await subjectState(third.id),null,'El lote posterior retoma la materia tras rollback de restauración');
  report.scenarios.push({name:'Restauración revierte al cruzar el límite',result:'primer tick omite; siguiente tick purga'});

  const fourth = await createSubject('Dos consumidores y rollback');
  await archive(fourth.id,'-1 second');
  await purge.exec('begin;'); await tick(purge);
  equal(await tick(secondPurge),{files:[]},'Un segundo consumidor no procesa la materia bloqueada por el primero');
  equal(await subjectState(fourth.id),{archived:true,purgeStarted:false},'Observador no ve el borrado sin confirmar del primer consumidor');
  await purge.exec('rollback;');
  equal(await subjectState(fourth.id),{archived:true,purgeStarted:false},'Rollback revierte el lote completo de purga');
  await tick(secondPurge);
  equal(await subjectState(fourth.id),null,'Otro consumidor puede completar el trabajo revertido');
  equal(await tick(secondPurge),{files:[]},'Repetir el lote confirmado es idempotente');
  report.scenarios.push({name:'Consumidores concurrentes y fallo transaccional',result:'SKIP LOCKED y rollback permiten reintento sin doble eliminación'});

  const boundary = await createSubject('Límite exacto de treinta días');
  await archive(boundary.id,'1 day');
  await admin.exec(`begin; update app.subjects set archived_at=now()-interval '30 days' where id=${quote(boundary.id)}; savepoint boundary;`);
  equal(await admin.json(`select to_jsonb(archived_at+interval '30 days'=now()) from app.subjects where id=${quote(boundary.id)};`),true,'Fixture alcanza exactamente treinta días, sin tolerancia ni espera estimada');
  await actor(admin);
  await rejected(()=>command(admin,'restoreSubject',boundary.id),'RESTORE_UNAVAILABLE','Restauración rechazada exactamente a los treinta días');
  await admin.exec('rollback to savepoint boundary; commit;');
  await admin.exec('reset role;');
  equal(await subjectState(boundary.id),{archived:true,purgeStarted:false},'Rechazo en el límite no cambia la materia');
  report.scenarios.push({name:'Límite exacto según reloj transaccional PostgreSQL',result:'restauración rechazada'});

  const permissions = await createSubject('Permisos de restauración');
  await archive(permissions.id,'1 day');
  for (const id of [other,student]) {
    await actor(restore,id);
    await rejected(()=>command(restore,'restoreSubject',permissions.id),'RESTORE_UNAVAILABLE','Cuenta ajena no puede restaurar una materia');
  }
  await rejected(()=>restore.json("select public.aulify_maintenance('tick');"),'permission denied','Rol autenticado no puede ejecutar mantenimiento');
  await restore.exec('set role anon;');
  await rejected(()=>command(restore,'restoreSubject',permissions.id),'permission denied','Rol anónimo no puede invocar restauración');
  await admin.exec('reset role;');
  equal(await admin.json(`select to_jsonb(s) from app.subjects s where id=${quote(control.id)};`),controlBefore,'Materia de control conserva todas sus columnas');
  equal(await admin.json('select jsonb_agg(to_jsonb(p) order by id) from app.profiles p;'),profilesBefore,'Todas las cuentas conservan su perfil');
  equal(await admin.json(`select jsonb_build_object('resource',(select to_jsonb(r) from app.resources r where id=${quote(resource.id)}),'draft',(select to_jsonb(d) from app.resource_drafts d where resource_id=${quote(resource.id)}),'version',(select to_jsonb(v) from app.resource_versions v where id=${quote(version.id)}),'file',(select to_jsonb(f) from app.file_objects f where id=${quote(fileId)}));`),libraryBefore,'Biblioteca, versión y archivo compartido permanecen íntegros tras la purga concurrente');
  equal(await admin.json(`select count(*)::int from storage.objects where name=${quote(user+'/'+fileId)};`),1,'El objeto compartido no entra en la eliminación de la materia vencida');
  await actor(admin);
  equal((await admin.json(`select public.aulify_file(${quote(fileId)});`)).id,fileId,'El docente conserva el acceso autorizado al archivo de biblioteca');
  report.status='passed';
} catch (error) {
  report.status='failed'; report.error={message:error.message,code:error.code};
  process.exitCode=1; console.error(error.message);
} finally {
  for (const session of sessions) await session.close().catch((error)=>{ report.cleanupError=error.message; });
  if (started) {
    try { await run('pg_ctl',['-D',cluster,'-w','-t','20','stop','-m','fast']); report.clusterStopped=true; }
    catch (error) { report.clusterStopped=false; report.cleanupError=error.message; process.exitCode=1; }
  }
  report.finishedAt=new Date().toISOString();
  report.newClusterRetained=true;
  await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(`REPORT ${report.checks.length} checks; ${report.status}; local cluster stopped=${report.clusterStopped}`);
}
