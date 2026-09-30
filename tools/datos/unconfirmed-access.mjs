import fs from 'node:fs/promises';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { parseArgs } from 'node:util';
import localAssert from 'node:assert/strict';
import { tmpdir } from 'node:os';

// Ensayo acotado AC-01. Nunca usa signup, invitaciones ni envío de correo.
const project = 'bnqyyumfmyexsqszglab';
const base = 'http://127.0.0.1:3001';
const script = 'tools/datos/unconfirmed-access.mjs';
const { values: options } = parseArgs({ options: {
  run: { type: 'boolean' }, 'self-test': { type: 'boolean' },
  'create-unconfirmed-fixtures': { type: 'string' }, 'expected-build': { type: 'string' },
  report: { type: 'string' }, manifest: { type: 'string' },
} });
function executionOptions(values) {
  if (!values.run || values['create-unconfirmed-fixtures'] !== '2' ||
      !values['expected-build'] || !/^[\w-]+$/.test(values['expected-build']) ||
      !values.report || !values.manifest) throw new Error('Ejecución requiere --run, --create-unconfirmed-fixtures=2, --expected-build y rutas nuevas --report/--manifest.');
  const destinations = [
    [values.report, 'docs/verificacion', /^acceso-sin-confirmar-[\w-]+\.json$/],
    [values.manifest, '.local-private', /^unconfirmed-access-fixtures-[\w-]+\.json$/],
  ];
  for (const [file, directory, pattern] of destinations) {
    if (path.dirname(path.resolve(file)) !== path.resolve(directory) || !pattern.test(path.basename(file)))
      throw new Error('Los destinos deben ser archivos nuevos de AC-01 dentro de sus directorios previstos.');
  }
}
async function assertNoPending(directory) {
  let files;
  try { files = await fs.readdir(directory); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const file of files.filter(name => /^unconfirmed-access-fixtures(?:-[\w-]+)?\.json$/.test(name))) {
    let previous;
    try { previous = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8')); }
    catch { throw new Error('Hay un manifiesto AC-01 ilegible. Revisarlo antes de crear cuentas.'); }
    if (previous.project !== project || !Array.isArray(previous.fixtures) ||
        !previous.cleanupVerifiedAt || !Number.isFinite(Date.parse(previous.cleanupVerifiedAt)) ||
        previous.fixtures.some(fixture => fixture.removed !== true))
      throw new Error('Hay una limpieza AC-01 pendiente o no verificada. No se crearán más cuentas.');
  }
}
async function reserveFile(file, initial) {
  // wx impide sobrescribir un informe o manifiesto, incluso entre procesos concurrentes.
  const handle = await fs.open(file, 'wx');
  try { await handle.writeFile(JSON.stringify(initial, null, 2) + '\n'); }
  finally { await handle.close(); }
}
async function selfTest() {
  let checks = 0;
  const valid = { run: true, 'create-unconfirmed-fixtures': '2', 'expected-build': 'example-build',
    report: 'docs/verificacion/acceso-sin-confirmar-test.json', manifest: '.local-private/unconfirmed-access-fixtures-test.json' };
  for (const values of [{ run: true }, { ...valid, 'create-unconfirmed-fixtures': '3' },
    { ...valid, report: 'docs/verificacion/acceso-sin-confirmar.json' },
    { ...valid, manifest: '../unconfirmed-access-fixtures-test.json' }]) {
    localAssert.throws(() => executionOptions(values)); checks++;
  }
  executionOptions(valid); checks++;
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'aulify-ac01-'));
  const file = path.join(directory, 'unconfirmed-access-fixtures-test.json');
  try {
    await assertNoPending(directory); checks++;
    const pending = { project, fixtures: [{ id: 'fictitious', removed: false }] };
    await reserveFile(file, pending);
    await localAssert.rejects(() => assertNoPending(directory)); checks++;
    await localAssert.rejects(() => reserveFile(file, { replaced: true }), { code: 'EEXIST' });
    localAssert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), pending); checks++;
    await fs.writeFile(file, JSON.stringify({ project, fixtures: [{ removed: true }] }));
    await localAssert.rejects(() => assertNoPending(directory)); checks++;
    await fs.writeFile(file, JSON.stringify({ project, fixtures: [{ removed: true }], cleanupVerifiedAt: new Date().toISOString() }));
    await assertNoPending(directory); checks++;
    await fs.writeFile(file, 'invalid');
    await localAssert.rejects(() => assertNoPending(directory)); checks++;
  } finally {
    // Sólo dos rutas creadas por esta prueba; no hay borrado recursivo ni archivos del proyecto.
    await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await fs.rmdir(directory);
  }
  console.log(JSON.stringify({ status: 'passed', checks, environment: 'Preflight local: sin .env, red, Auth ni cuentas nuevas.' }));
}
if (options['self-test']) {
  if (options.run) throw new Error('No combinar --self-test con --run.');
  await selfTest();
  process.exit(0);
}
if (!options.run) {
  await assertNoPending('.local-private');
  console.log('Preflight local aprobado: no hay manifiestos AC-01 pendientes. Sin --run no se leen claves ni se emiten solicitudes. Crear cuentas exige además --create-unconfirmed-fixtures=2, --expected-build y rutas nuevas --report/--manifest.');
  process.exit(0);
}
executionOptions(options);
await assertNoPending('.local-private');
const reportPath = options.report;
const fixturePath = options.manifest;
// Comprobar destinos existentes antes de leer credenciales o emitir solicitudes.
for (const file of [reportPath, fixturePath]) {
  try { await fs.access(file); throw new Error('No se puede reutilizar un informe o manifiesto AC-01.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const environment = Object.fromEntries(
  (await fs.readFile('.env.local', 'utf8')).split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')];
  }),
);
let legacyServiceKey = false;
try {
  const payload = JSON.parse(Buffer.from(environment.SUPABASE_SECRET_KEY.split('.')[1], 'base64url'));
  legacyServiceKey = payload.role === 'service_role' && payload.ref === project;
} catch { /* Una clave actual no tiene estructura JWT. */ }
if (environment.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co` ||
    !environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_') ||
    !(environment.SUPABASE_SECRET_KEY?.startsWith('sb_secret_') || legacyServiceKey)) throw new Error('Preparación de proyecto no válida.');
const client = (key) => createClient(environment.NEXT_PUBLIC_SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const admin = client(environment.SUPABASE_SECRET_KEY);
const report = {
  startedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  script: { path: script, sha256: createHash('sha256').update(await fs.readFile(script)).digest('hex') },
  environment: 'Aplicación compilada local y Supabase Auth real; cuentas ficticias nuevas sin confirmar',
  checks: [], cleanup: [], limits: { maximumAccounts: 2, sentEmails: 0 },
  limitations: ['No recorre el formulario de registro ni confirma enlaces por correo.', 'No comprueba SMTP, recuperación, rendimiento ni navegadores.'],
};
const fixtures = [];
const runId = randomUUID();
report.runId = runId;
let cleanupVerifiedAt;
const saveFixtures = () => fs.writeFile(fixturePath, JSON.stringify({ project, runId, fixtures, cleanupVerifiedAt }, null, 2) + '\n');
await reserveFile(fixturePath, { project, runId, fixtures });
await reserveFile(reportPath, { ...report, status: 'prepared', runId });
const assert = (condition, detail) => {
  report.checks.push({ detail, result: condition ? 'passed' : 'failed' });
  if (!condition) throw new Error(detail);
};
async function local(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Origin: base, 'Sec-Fetch-Site': 'same-origin', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000),
  });
  return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() };
}
try {
  report.buildId = (await fs.readFile('.next/BUILD_ID', 'utf8')).trim();
  assert(report.buildId === options['expected-build'], 'El build local coincide con el esperado explícitamente');
  const served = await fetch(base, { signal: AbortSignal.timeout(15_000) });
  const html = await served.text();
  assert(served.ok && html.includes(report.buildId), 'El servidor corresponde al build local registrado');
  for (const role of ['teacher', 'student']) {
    const email = `aulify-ac01-${randomUUID()}@example.invalid`;
    const password = `Ac01!${randomBytes(24).toString('base64url')}`;
    const fixture = { id: null, role, email, createdAt: new Date().toISOString(), removed: false, creationStatus: 'requested' };
    fixtures.push(fixture);
    // Guardar intención antes de la llamada: un corte no debe perder la identidad a revisar.
    await saveFixtures();
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: false, user_metadata: { role, name: 'Cuenta ficticia AC-01' },
    });
    if (error || !data.user) throw new Error('No se pudo preparar la cuenta ficticia.');
    fixture.id = data.user.id;
    fixture.creationStatus = 'created';
    await saveFixtures();
    assert(!data.user.email_confirmed_at, `${role}: cuenta preparada sin correo confirmado`);
    const publicClient = client(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const access = await publicClient.auth.signInWithPassword({ email, password });
    assert(access.error?.code === 'email_not_confirmed' && !access.data.session, `${role}: Auth rechaza acceso y no emite sesión`);
    const application = await local('/api/auth', { action: 'access', email, password });
    assert(application.status === 401 && application.body.error?.includes('Confirma tu correo'), `${role}: la aplicación orienta a confirmar el correo`);
    assert(!application.cookies.some((cookie) => /auth-token[^=]*=([^;]+)/.test(cookie)), `${role}: no hay cookie de sesión válida`);
    const command = await local('/api/commands', {
      action: role === 'teacher' ? 'createSubject' : 'requestMembership',
      args: role === 'teacher' ? [{ name: 'Materia ficticia AC-01', course: '3', year: '2026' }] : ['AC01XX'],
    });
    assert(command.status === 401, `${role}: operación de materia rechazada sin identidad confirmada`);
    const workspace = await local('/api/workspace');
    assert(workspace.status === 401 && !workspace.body.state, `${role}: aula privada no expuesta`);
    const persisted = await admin.auth.admin.getUserById(fixture.id);
    assert(!persisted.error && !persisted.data.user?.email_confirmed_at, `${role}: los intentos no confirman la cuenta`);
  }
  report.status = 'passed';
} catch {
  report.status = 'failed';
  // No serializar errores del SDK: pueden incluir detalles de solicitudes.
  report.failure = report.checks.at(-1)?.result === 'failed' ? report.checks.at(-1).detail : 'No terminó la preparación o ejecución acotada.';
  process.exitCode = 1;
} finally {
  report.verificationStatus = report.status;
  // El perfil creado por el trigger bloquea deleteUser por FK. No eliminar datos a ciegas.
  report.cleanup = fixtures.map(fixture => ({ role: fixture.role, removed: false }));
  report.cleanupMethod = 'Pendiente de limpieza manual verificada de fixtures exactos: referencias y sesiones, perfil, Auth y lectura posterior 404. No hay eliminación automática.';
  if (fixtures.length) { report.status = 'cleanup-pending'; process.exitCode = 1; }
  else { cleanupVerifiedAt = new Date().toISOString(); report.cleanupMethod = 'No se solicitó ninguna cuenta; no hay identidades que eliminar.'; }
  await saveFixtures();
  report.completedAt = new Date().toISOString();
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, cleanup: report.cleanup, reportPath }));
}
