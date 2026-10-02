import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID as id, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const base = 'http://127.0.0.1:3001';
const build = (await fs.readFile('.next/BUILD_ID', 'utf8')).trim();
assert.ok((await (await fetch(base)).text()).includes(build), 'Compilado identificado');
const env = Object.fromEntries(
  (await fs.readFile('.env.local', 'utf8'))
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const accounts = JSON.parse(await fs.readFile('.local-private/remote-test-accounts.json', 'utf8'));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'https://bnqyyumfmyexsqszglab.supabase.co');
assert.equal(accounts.projectRef, 'bnqyyumfmyexsqszglab');
const clients = {},
  jars = {};
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);
const report = {
  startedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  buildId: build,
  environment: 'Aplicación compilada local con Supabase Auth, PostgreSQL y Storage remotos',
  scriptSha256: createHash('sha256')
    .update(await fs.readFile('tools/datos/task-sequence-remote.mjs'))
    .digest('hex'),
  cases: [],
  limitations: [
    'Datos ficticios; no acredita alojamiento público ni carga sostenida.',
    'Las materias y archivos se conservan archivados para recuperación; no se purgan datos ajenos.',
  ],
};
let active, subjectId;
const check = (value, label) => {
  assert.ok(value, label);
  active.checks.push({ label, result: 'passed' });
};
const equal = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  active.checks.push({ label, result: 'passed' });
};
const http = async (role, path, body) => {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    redirect: 'manual',
    headers: {
      Origin: base,
      Cookie: [...(jars[role] || [])].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const first = cookie.split(';', 1)[0],
      i = first.indexOf('=');
    jars[role].set(first.slice(0, i), first.slice(i + 1));
  }
  return { status: response.status, data: await response.json() };
};
const rpc = async (role, name, args = {}) => {
  const { data, error } = await clients[role].rpc(name, args);
  if (error || data?.error)
    throw Object.assign(new Error((error || data.error).message), {
      code: (error || data.error).code,
    });
  return data;
};
const cmd = (role, action, ...args) =>
  rpc(role, 'aulify_command', { p_action: action, p_payload: { args } });
async function reject(fn, pattern, label) {
  let error;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  assert.ok(error, label);
  assert.match(error.message, pattern, label);
  active.checks.push({ label, result: 'rejected-as-expected' });
}
async function scenario(name, fn) {
  if (only && !name.startsWith(only)) return;
  active = { name, checks: [] };
  report.cases.push(active);
  try {
    await fn();
    active.status = 'passed';
  } catch (e) {
    active.status = 'failed';
    active.failure = { code: e.code || e.name, message: e.message.slice(0, 500) };
    process.exitCode = 1;
  }
  console.log(`${active.status}: ${name} (${active.checks.length})`);
}
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6q6sAAAAASUVORK5CYII=',
  'base64',
);
async function upload(name, bytes, complete = true) {
  const metadata = { name, size: bytes.length, purpose: 'submission' };
  const prepared = await http('student', '/api/files', { action: 'prepare', ...metadata });
  assert.equal(prepared.status, 200, 'Reserva de archivo');
  const p = prepared.data;
  const { error } = await clients.student.storage
    .from('aulify-files')
    .uploadToSignedUrl(p.path, p.token, bytes, { contentType: p.mime });
  if (error) throw error;
  const response = complete
    ? await http('student', '/api/files', { action: 'complete', id: p.id, ...metadata })
    : null;
  return { id: p.id, name, size: bytes.length, mimeType: p.mime, ...response?.data, response };
}
async function task(title, extra = {}) {
  return cmd('teacher', 'createTask', {
    subjectId,
    title,
    instructions: 'Adjunta un archivo ficticio para la verificación.',
    opensAt: new Date(Date.now() - 60000).toISOString(),
    closesAt: new Date(Date.now() + 1800000).toISOString(),
    maxGrade: 100,
    weight: 1,
    countsTowardAverage: true,
    allowLate: false,
    ...extra,
  });
}
try {
  for (const role of ['teacher', 'student']) {
    clients[role] = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const account = accounts.users[role];
    const { error } = await clients[role].auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error) throw error;
    jars[role] = new Map();
    assert.equal(
      (
        await http(role, '/api/auth', {
          action: 'access',
          email: account.email,
          password: account.password,
        })
      ).status,
      200,
    );
  }
  const s = await cmd('teacher', 'createSubject', {
    name: 'Entregas y archivos · prueba',
    course: '3.º A',
    year: 2026,
    description: 'Datos ficticios',
  });
  subjectId = s.id;
  const code = (await rpc('teacher', 'aulify_snapshot')).state.subjects.find(
    (s) => s.id === subjectId,
  ).code;
  const request = await cmd('student', 'requestMembership', code);
  await cmd('teacher', 'decideMembership', request.id, 'approved');
  const files = [];
  for (let i = 0; i < 6; i++) files.push(await upload(`prueba-${i + 1}.png`, png));
  assert.ok(
    files.every((f) => f.response.status === 200),
    'Seis archivos válidos preparados',
  );
  const t = await task('Entrega con versiones');
  const first = await cmd('student', 'submitTask', t.id, [files[0]], 'Primera versión', id());
  await scenario('AP-21 · secuencia adversa sin reemplazar entrega válida', async () => {
    const large = await http('student', '/api/files', {
      action: 'prepare',
      name: 'exceso.pdf',
      size: 11 * 1024 * 1024,
      purpose: 'submission',
    });
    equal(large.status, 400, 'Rechaza archivo de 11 MiB');
    await reject(
      () => cmd('student', 'submitTask', t.id, files, 'Seis archivos', id()),
      /FILE_COUNT/,
      'Rechaza sexto archivo',
    );
    const basePdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
    );
    const big = Buffer.concat([
      basePdf,
      Buffer.from('%' + 'x'.repeat(7 * 1024 * 1024 - basePdf.length - 2) + '\n'),
    ]);
    const totals = [];
    for (let i = 0; i < 3; i++) totals.push(await upload(`limite-${i}.pdf`, big));
    check(
      totals.every((f) => f.response.status === 200),
      'Tres archivos de 7 MiB confirmados con bytes reales',
    );
    await reject(
      () => cmd('student', 'submitTask', t.id, totals, 'Total de 21 MiB', id()),
      /INVALID_FILES/,
      'Rechaza total de 21 MiB',
    );
    const disguised = await upload('apariencia.png', Buffer.from('MZ' + 'x'.repeat(160)));
    equal(disguised.response.status, 400, 'Rechaza contenido de ejecutable con nombre PNG');
    await reject(
      () => cmd('student', 'submitTask', t.id, [disguised], 'Archivo engañoso', id()),
      /INVALID_FILES/,
      'Archivo no confirmado no se puede entregar',
    );
    const incomplete = await upload('incompleto.png', png, false);
    await reject(
      () => cmd('student', 'submitTask', t.id, [incomplete], 'Carga sin completar', id()),
      /INVALID_FILES/,
      'Carga incompleta no se puede entregar',
    );
    const existing = (await rpc('teacher', 'aulify_snapshot')).state.submissions.filter(
      (s) => s.taskId === t.id,
    );
    equal(
      existing.map((s) => [s.id, s.version, s.files.map((f) => f.id)]),
      [[first.id, 1, [files[0].id]]],
      'Toda la secuencia conserva la primera entrega intacta',
    );
  });
  let second;
  await scenario('AP-22 · reemplazo antes del cierre sin calificación', async () => {
    second = await cmd('student', 'submitTask', t.id, [files[1]], 'Segunda versión', id());
    equal(second.version, 2, 'Nueva entrega incrementa versión');
    const versions = (await rpc('teacher', 'aulify_snapshot')).state.submissions
      .filter((s) => s.taskId === t.id)
      .sort((a, b) => a.version - b.version);
    equal(
      versions.map((s) => s.files.map((f) => f.id)),
      [[files[0].id], [files[1].id]],
      'Conserva archivo anterior y nuevo por separado',
    );
    check(
      versions.every((s) => !s.evaluation),
      'No fabrica calificaciones',
    );
  });
  await scenario('AP-24 · carga fallida y republicación sobre la versión conservada', async () => {
    assert.ok(second, 'La segunda entrega debe existir');
    await cmd('teacher', 'reviewTask', second.id, 80, 'Primera evaluación');
    await cmd('teacher', 'publishTaskGrade', second.id);
    const bad = await upload('rechazado.png', Buffer.from('MZ' + 'y'.repeat(160)));
    equal(bad.response.status, 400, 'Nueva carga rechazada por sus bytes');
    await cmd(
      'teacher',
      'allowResubmission',
      t.id,
      accounts.users.student.id,
      new Date(Date.now() + 300000).toISOString(),
      'Revisar el contenido',
    );
    await reject(
      () => cmd('student', 'submitTask', t.id, [bad], 'Cambio inválido', id()),
      /INVALID_FILES/,
      'Carga fallida no consume una entrega válida',
    );
    await cmd(
      'teacher',
      'reviewTask',
      second.id,
      85,
      'Ajuste de evaluación',
      'La explicación adicional mejora el resultado',
    );
    await cmd('teacher', 'publishTaskGrade', second.id);
    const view = await rpc('student', 'aulify_snapshot');
    const versions = view.state.submissions
      .filter((s) => s.taskId === t.id)
      .sort((a, b) => a.version - b.version);
    equal(
      versions.map((s) => [s.version, s.files.map((f) => f.id)]),
      [
        [1, [files[0].id]],
        [2, [files[1].id]],
      ],
      'No aparece una versión nueva después del fallo',
    );
    equal(
      view.studentResults[subjectId].find((r) => r.activityId === t.id).grade,
      85,
      'Republicación actualiza la nota de la versión conservada',
    );
  });
  await scenario('AP-23 · entrega tardía y ventana de reentrega', async () => {
    const closed = new Date(Date.now() - 1000).toISOString();
    const denied = await task('Tardía desactivada', { closesAt: closed });
    await reject(
      () => cmd('student', 'submitTask', denied.id, [files[0]], 'Tarde', id()),
      /TASK_CLOSED/,
      'Rechaza entrega tardía desactivada',
    );
    const allowed = await task('Tardía habilitada', { closesAt: closed, allowLate: true });
    const late = await cmd(
      'student',
      'submitTask',
      allowed.id,
      [files[0]],
      'Tardía permitida',
      id(),
    );
    equal(late.late, true, 'Marca la entrega autorizada como tardía');
    await cmd('teacher', 'reviewTask', late.id, 70, 'Revisión');
    await cmd('teacher', 'publishTaskGrade', late.id);
    await reject(
      () => cmd('student', 'submitTask', allowed.id, [files[1]], 'Sin permiso', id()),
      /RESUBMISSION_PERMISSION_REQUIRED/,
      'Corrección requiere permiso incluso con tardías habilitadas',
    );
    const expires = new Date(Date.now() + 6500).toISOString();
    // El contrato abre la autorización al concederla; no recibe una apertura futura.
    await cmd(
      'teacher',
      'allowResubmission',
      allowed.id,
      accounts.users.student.id,
      expires,
      'Reentrega de prueba',
    );
    const replacement = await cmd(
      'student',
      'submitTask',
      allowed.id,
      [files[1]],
      'Dentro de ventana',
      id(),
    );
    equal(replacement.version, 2, 'Acepta una reentrega dentro de ventana');
    await reject(
      () => cmd('student', 'submitTask', allowed.id, [files[2]], 'Permiso consumido', id()),
      /RESUBMISSION_PERMISSION_REQUIRED/,
      'Permiso queda consumido',
    );
    await cmd(
      'teacher',
      'allowResubmission',
      allowed.id,
      accounts.users.student.id,
      new Date(Date.now() + 2000).toISOString(),
      'Ventana que vence',
    );
    await new Promise((r) => setTimeout(r, 2400));
    await reject(
      () => cmd('student', 'submitTask', allowed.id, [files[2]], 'Ventana vencida', id()),
      /RESUBMISSION_PERMISSION_REQUIRED/,
      'Rechaza tras vencer la ventana',
    );
  });
} catch (e) {
  report.setupFailure = { code: e.code || e.name, message: e.message.slice(0, 500) };
  process.exitCode = 1;
} finally {
  if (subjectId)
    try {
      await cmd('teacher', 'archiveSubject', subjectId);
      report.cleanup = 'materia archivada';
    } catch (e) {
      report.cleanup = e.code || e.name;
    }
  for (const [role, c] of Object.entries(clients)) {
    if (jars[role]?.size) await http(role, '/api/auth', { action: 'signout' });
    await c.auth.signOut({ scope: 'local' });
  }
  report.completedAt = new Date().toISOString();
  report.status =
    report.setupFailure || report.cases.some((c) => c.status !== 'passed') ? 'failed' : 'passed';
  const reportName = only
    ? `entregas-secuencia-${only.toLowerCase()}.json`
    : 'entregas-secuencia-remota.json';
  await fs.writeFile(`docs/verificacion/${reportName}`, JSON.stringify(report, null, 2) + '\n');
  console.log(`Informe ${report.status}; ${report.cases.length} secuencias.`);
}
