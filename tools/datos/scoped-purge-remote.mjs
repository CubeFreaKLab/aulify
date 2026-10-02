import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID as id, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  (await fs.readFile('.env.local', 'utf8'))
    .split(/\r?\n/)
    .filter((x) => x.trim() && !x.startsWith('#'))
    .map((x) => {
      const i = x.indexOf('=');
      return [x.slice(0, i), x.slice(i + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const accounts = JSON.parse(await fs.readFile('.local-private/remote-test-accounts.json', 'utf8'));
assert.equal(accounts.projectRef, 'bnqyyumfmyexsqszglab');
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, `https://${accounts.projectRef}.supabase.co`);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options),
  clients = {};
for (const role of ['teacher', 'student']) {
  const c = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    options,
  );
  const { error } = await c.auth.signInWithPassword(accounts.users[role]);
  if (error) throw error;
  clients[role] = c;
}
const rpc = async (c, name, args = {}) => {
  const { data, error } = await c.rpc(name, args);
  if (error || data?.error)
    throw Object.assign(new Error((error || data.error).message), {
      code: (error || data.error).code,
    });
  return data;
};
const cmd = (role, action, ...args) =>
  rpc(clients[role], 'aulify_command', { p_action: action, p_payload: { args } });
const path = '.local-private/scoped-purge-fixture.json';
const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
const report = {
  startedAt: new Date().toISOString(),
  environment: 'Supabase remoto, JWT y Storage real; mantenimiento limitado a los trabajos creados',
  checks: [],
  limitations: [
    'Antigüedad de treinta días sintética; no representa esperar treinta días reales.',
    'Las solicitudes de restauración y purga son concurrentes; no se instrumentan los tiempos internos de bloqueo SQL.',
    'El fallo parcial es una interrupción controlada después de borrar un objeto; no se induce una caída del proveedor.',
  ],
};
const check = (value, label) => {
  assert.ok(value, label);
  report.checks.push({ label, result: 'passed' });
};
const equal = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  report.checks.push({ label, result: 'passed' });
};
async function reject(fn, regex, label) {
  let e;
  try {
    await fn();
  } catch (error) {
    e = error;
  }
  assert.ok(e, label);
  assert.match(`${e.code}: ${e.message}`, regex, label);
  report.checks.push({ label, result: 'rejected-as-expected', code: e.code });
}
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6q6sAAAAASUVORK5CYII=',
  'base64',
);
async function upload() {
  const fileId = id(),
    owner = accounts.users.student.id,
    name = 'conservacion-prueba.png';
  const reservation = await rpc(admin, 'aulify_reserve_upload', {
    p_owner: owner,
    p_id: fileId,
    p_name: name,
    p_purpose: 'submission',
    p_size: png.length,
    p_mime: 'image/png',
  });
  assert.equal(reservation.path, `${owner}/${fileId}`);
  const { error } = await admin.storage
    .from(reservation.bucket)
    .upload(reservation.path, png, { contentType: 'image/png', upsert: false });
  if (error) throw error;
  const registered = await rpc(admin, 'aulify_register_file', {
    p_owner: owner,
    p_id: fileId,
    p_name: name,
    p_mime: 'image/png',
    p_size: png.length,
    p_sha256: createHash('sha256').update(png).digest('hex'),
  });
  return { id: fileId, owner, bucket: reservation.bucket, path: reservation.path, registered };
}
async function remove(f, fixture) {
  assert.ok(fixture.files.some((x) => x.id === f.id && x.path === f.path));
  assert.equal(f.path, `${f.owner}/${f.id}`);
  assert.equal(f.bucket, 'aulify-files');
  const { error } = await admin.storage.from(f.bucket).remove([f.path]);
  if (error) throw error;
}
const outside = (state, ids) => ({
  subjects: state.subjects.filter((x) => !ids.includes(x.id)),
  resources: state.resources,
  versions: state.versions,
  activities: state.activities.filter((x) => !ids.includes(x.subjectId)),
  tasks: state.tasks.filter((x) => !ids.includes(x.subjectId)),
  manualActivities: state.manualActivities.filter((x) => !ids.includes(x.subjectId)),
});
try {
  if (process.argv.includes('--prepare')) {
    const fixture = {
      runId: id(),
      projectRef: accounts.projectRef,
      createdAt: new Date().toISOString(),
      subjects: {},
      files: [],
    };
    for (const key of ['restore', 'purge']) {
      const s = await cmd('teacher', 'createSubject', {
        name: `Conservación acotada ${key} · prueba`,
        course: '3.º',
        year: 2026,
        description: 'Datos ficticios exclusivos de la comprobación.',
      });
      fixture.subjects[key] = s;
      const code = (await rpc(clients.teacher, 'aulify_snapshot')).state.subjects.find(
        (x) => x.id === s.id,
      ).code;
      const request = await cmd('student', 'requestMembership', code);
      await cmd('teacher', 'decideMembership', request.id, 'approved');
      if (key === 'purge') {
        const task = await cmd('teacher', 'createTask', {
          subjectId: s.id,
          title: 'Archivos exclusivos de prueba',
          instructions: 'Datos ficticios',
          opensAt: new Date(Date.now() - 60000).toISOString(),
          closesAt: new Date(Date.now() + 3600000).toISOString(),
          maxGrade: 100,
          weight: 1,
          countsTowardAverage: true,
          allowLate: false,
        });
        for (let i = 0; i < 2; i++) fixture.files.push(await upload());
        await cmd(
          'student',
          'submitTask',
          task.id,
          fixture.files.map((f) => f.registered),
          'Entrega de prueba',
          id(),
        );
      }
      await cmd('teacher', 'archiveSubject', s.id);
    }
    await fs.writeFile(path, JSON.stringify(fixture, null, 2) + '\n');
    const restore = fixture.subjects.restore.id,
      purge = fixture.subjects.purge.id;
    const sql = `begin;\nupdate app.subjects set archived_at=now()-interval '30 days'+interval '5 minutes' where id='${restore}';\nupdate app.subjects set archived_at=now()-interval '30 days' where id='${purge}';\nupdate app.purge_jobs pj set due_at=s.archived_at+interval '30 days' from app.subjects s where pj.subject_id=s.id and s.id in ('${restore}','${purge}');\ncommit;\nselect jsonb_agg(jsonb_build_object('subjectId',subject_id,'jobId',id)) as jobs from app.purge_jobs where subject_id in ('${restore}','${purge}');`;
    await fs.writeFile('.local-private/scoped-purge-prepare.sql', sql);
    console.log(
      'Preparación guardada: dos materias ficticias, dos archivos. Falta ajustar fechas y registrar sus trabajos por SQL.',
    );
  } else if (process.argv.includes('--verify')) {
    const fixture = JSON.parse(await fs.readFile(path, 'utf8'));
    assert.equal(fixture.projectRef, accounts.projectRef);
    assert.ok(fixture.jobs?.restore && fixture.jobs?.purge, 'Falta identificar trabajos propios');
    const ids = Object.values(fixture.subjects).map((s) => s.id);
    const before = outside((await rpc(clients.teacher, 'aulify_snapshot')).state, ids);
    const tick = (jobId) =>
      rpc(admin, 'aulify_maintenance', { p_action: 'tick', p_payload: { jobId } });
    const confirm = (ids) =>
      rpc(admin, 'aulify_maintenance', {
        p_action: 'confirmFiles',
        p_payload: { jobId: fixture.jobs.purge, ids },
      });
    await reject(
      () =>
        rpc(clients.student, 'aulify_maintenance', {
          p_action: 'tick',
          p_payload: { jobId: fixture.jobs.purge },
        }),
      /permission denied|42501/,
      'Estudiante no obtiene acceso al reintento privilegiado',
    );
    const restoring = await Promise.all([
      cmd('teacher', 'restoreSubject', fixture.subjects.restore.id),
      tick(fixture.jobs.restore),
    ]);
    equal(restoring[1].files, [], 'Antes del vencimiento el trabajo no reclama archivos');
    check(
      (await rpc(clients.teacher, 'aulify_snapshot')).state.subjects.some(
        (s) => s.id === fixture.subjects.restore.id && s.status === 'active',
      ),
      'Restauración anterior al vencimiento conserva la materia',
    );
    const pending = await Promise.allSettled([
      tick(fixture.jobs.purge),
      cmd('teacher', 'restoreSubject', fixture.subjects.purge.id),
    ]);
    equal(pending[0].status, 'fulfilled', 'Purga elegible confirma su transacción');
    equal(pending[1].status, 'rejected', 'Restauración concurrente al vencer es rechazada');
    assert.match(
      `${pending[1].reason.code}: ${pending[1].reason.message}`,
      /RESTORE_UNAVAILABLE|FORBIDDEN/,
    );
    const files = pending[0].value.files;
    equal(
      files.map((f) => f.id).sort(),
      fixture.files.map((f) => f.id).sort(),
      'Reclama únicamente los dos objetos exclusivos',
    );
    await remove(fixture.files[0], fixture);
    await reject(
      () => confirm(fixture.files.map((f) => f.id)),
      /STORAGE_OBJECT_REMAINS/,
      'Confirmación incompleta conserva los metadatos',
    );
    equal(
      (await tick(fixture.jobs.purge)).files.map((f) => f.id).sort(),
      fixture.files.map((f) => f.id).sort(),
      'Reintento recupera ambos objetos pendientes después del fallo parcial',
    );
    const retained = await admin.storage
      .from(fixture.files[1].bucket)
      .download(fixture.files[1].path);
    if (retained.error) throw retained.error;
    equal(
      Buffer.from(await retained.data.arrayBuffer()).equals(png),
      true,
      'Segundo objeto conserva sus bytes durante la interrupción',
    );
    await remove(fixture.files[1], fixture);
    equal(
      await confirm(fixture.files.map((f) => f.id)),
      { deleted: 2 },
      'Confirmación final retira los dos metadatos',
    );
    equal(
      await confirm(fixture.files.map((f) => f.id)),
      { deleted: 0 },
      'Confirmación repetida es idempotente',
    );
    equal((await tick(fixture.jobs.purge)).files, [], 'Reintento terminado no devuelve objetos');
    const after = (await rpc(clients.teacher, 'aulify_snapshot')).state;
    check(
      !after.subjects.some((s) => s.id === fixture.subjects.purge.id),
      'Materia vencida ya no existe en la proyección',
    );
    equal(
      hash(outside(after, ids)),
      hash(before),
      'Biblioteca y otras materias conservan su contenido',
    );
    for (const f of fixture.files) {
      const read = await admin.storage.from(f.bucket).download(f.path, { cacheNonce: id() });
      check(
        Boolean(read.error),
        'Objeto exclusivo no puede descargarse desde origen después de confirmar',
      );
    }
    await cmd('teacher', 'archiveSubject', fixture.subjects.restore.id);
    report.status = 'passed';
    report.scriptSha256 = hash(await fs.readFile('tools/datos/scoped-purge-remote.mjs', 'utf8'));
    report.completedAt = new Date().toISOString();
    await fs.writeFile(
      'docs/verificacion/purga-acotada-remota.json',
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(`passed: ${report.checks.length} comprobaciones remotas de conservación`);
  } else throw new Error('Usar --prepare o --verify');
} catch (e) {
  report.status = 'failed';
  report.failure = { code: e.code || e.name, message: e.message.slice(0, 500) };
  await fs.writeFile(
    'docs/verificacion/purga-acotada-remota.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(`failed: ${report.failure.code}: ${report.failure.message}`);
  process.exitCode = 1;
} finally {
  for (const c of Object.values(clients)) await c.auth.signOut({ scope: 'local' });
}
