import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// Ensayo explícito sobre datos ficticios nuevos. No ejecuta mantenimiento global.
const phase = process.argv[2];
assert.ok(['prepare', 'race', 'finish'].includes(phase), 'Usar prepare, race o finish.');
const file = '.local-private/hint-concurrency-fixture.json';
const output = 'docs/verificacion/pistas-concurrentes-remotas.json';
const script = 'tools/datos/hint-concurrency-remote.mjs';
const accounts = JSON.parse(await fs.readFile('.local-private/remote-test-accounts.json', 'utf8'));
const env = Object.fromEntries(
  (await fs.readFile('.env.local', 'utf8'))
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const project = 'bnqyyumfmyexsqszglab';
assert.equal(accounts.projectRef, project);
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, `https://${project}.supabase.co`);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const make = (token) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
const rpc = async (client, action, args) => {
  const result = await client.rpc('aulify_command', { p_action: action, p_payload: { args } });
  if (result.error)
    throw Object.assign(new Error(result.error.message), { code: result.error.code });
  if (result.data?.error) throw new Error(result.data.error.code);
  return result.data;
};
let state, report;
if (phase === 'prepare') {
  assert.equal(
    await fs.stat(file).then(
      () => true,
      () => false,
    ),
    false,
    'No sobrescribir un ensayo.',
  );
  state = {
    project,
    runId: randomUUID(),
    phase: 'preparing',
    sessions: {},
    createdAt: new Date().toISOString(),
  };
  const migrations = (await fs.readdir('supabase/migrations'))
    .filter((n) => n.endsWith('.sql'))
    .sort();
  report = {
    status: 'preparing',
    runId: state.runId,
    startedAt: state.createdAt,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    script: { path: script, sha256: hash(await fs.readFile(script)) },
    migrations: await Promise.all(
      migrations.map(async (n) => ({
        name: n,
        sha256: hash(await fs.readFile(`supabase/migrations/${n}`)),
      })),
    ),
    environment:
      'Supabase remoto; tres sesiones reales de cuentas ficticias; dos solicitudes HTTP independientes del mismo estudiante',
    checks: [],
    limitations: [
      'Comprueba el contrato remoto, no interacción visual de dos pestañas ni carga sostenida.',
      'Las solicitudes apuntan a preguntas distintas: sólo la primera sin responder es elegible en avance individual.',
      'La barrera SQL, cuando se observa, retiene únicamente el intento nuevo y termina con ROLLBACK.',
    ],
  };
} else {
  state = JSON.parse(await fs.readFile(file, 'utf8'));
  report = JSON.parse(await fs.readFile(output, 'utf8'));
  assert.equal(state.project, project);
  assert.equal(state.runId, report.runId);
}
const save = async () => {
  await fs.writeFile(file, JSON.stringify(state, null, 2) + '\n');
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
};
const pass = (detail) => {
  report.checks.push({ detail, result: 'passed' });
  console.log(`PASS ${detail}`);
};
async function rejected(client, args, code, detail) {
  await assert.rejects(
    () => rpc(client, 'useHint', args),
    (e) => e.message.includes(code),
  );
  pass(detail);
}
const snapshot = async (client) => {
  const result = await client.rpc('aulify_activity_snapshot', { p_activity_id: state.activity });
  assert.equal(result.error, null);
  return result.data;
};
const client = (name) => {
  const session = state.sessions[name];
  assert.ok(session?.expiresAt * 1000 > Date.now() + 60000, 'La sesión del ensayo venció.');
  return make(session.token);
};
try {
  if (phase === 'prepare') {
    await save();
    for (const [name, role] of [
      ['teacher', 'teacher'],
      ['tabA', 'student'],
      ['tabB', 'student'],
    ]) {
      const c = make();
      const a = accounts.users[role];
      const response = await c.auth.signInWithPassword({ email: a.email, password: a.password });
      assert.equal(response.error, null);
      assert.equal(response.data.user.id, a.id);
      state.sessions[name] = {
        userId: a.id,
        token: response.data.session.access_token,
        expiresAt: response.data.session.expires_at,
      };
      await save();
    }
    const teacher = client('teacher'),
      student = client('tabA');
    state.subject = (
      await rpc(teacher, 'createSubject', [
        {
          name: `Pistas · ${state.runId.slice(0, 8)}`,
          course: 'Prueba ficticia',
          year: 2026,
          description: 'Comprobación de un uso de pista por actividad.',
        },
      ])
    ).id;
    await save();
    const overview = await teacher.rpc('aulify_workspace_overview');
    assert.equal(overview.error, null);
    const code = overview.data.state.subjects.find((s) => s.id === state.subject).code;
    const request = await rpc(student, 'requestMembership', [code]);
    await rpc(teacher, 'decideMembership', [request.id, 'approved']);
    state.questions = [0, 1, 2].map((i) => ({
      id: randomUUID(),
      type: 'true-false',
      prompt: `Pregunta ficticia ${i + 1}`,
      points: 1,
      correct: true,
      ...(i ? { hint: `PISTA_${state.runId}_${i}` } : {}),
    }));
    const resource = {
      id: randomUUID(),
      ownerId: accounts.users.teacher.id,
      title: 'Uso único de pista',
      kind: 'quiz',
      revision: 1,
      updatedAt: new Date().toISOString(),
      blocks: [{ id: randomUUID(), type: 'quiz', questions: state.questions }],
    };
    state.resource = resource.id;
    await save();
    await rpc(teacher, 'saveDraft', [resource, 0]);
    state.version = (await rpc(teacher, 'publishResource', [resource.id])).id;
    const settings = {
      purpose: 'practice',
      pace: 'individual',
      maxGrade: 100,
      weight: 1,
      countsTowardAverage: false,
      maxAttempts: 1,
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 1800000).toISOString(),
      timeLimitMinutes: null,
      timeZone: 'America/La_Paz',
      feedback: 'hidden',
      manualCorrection: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      streaks: false,
      sound: false,
      ranking: false,
      teams: false,
      allowHint: true,
      allowDouble: false,
      bonusAffectsGrade: false,
      reportVisibility: false,
    };
    state.activity = (
      await rpc(teacher, 'createActivity', [state.version, state.subject, settings])
    ).id;
    state.attempt = (await rpc(student, 'startAttempt', [state.activity])).id;
    await save();
    await rejected(
      student,
      [state.attempt, state.questions[0].id],
      'HINT_UNAVAILABLE',
      'Pregunta sin pista: rechazo sin consumir',
    );
    await rejected(
      student,
      [state.attempt, randomUUID()],
      'HINT_UNAVAILABLE',
      'Pregunta inexistente: rechazo sin consumir',
    );
    const before = await snapshot(student);
    assert.ok(!JSON.stringify(before).includes(`PISTA_${state.runId}`));
    pass('La proyección inicial no revela ninguna pista');
    report.beforeSnapshotHash = hash(JSON.stringify(before));
    await rpc(student, 'submitAnswer', [
      state.attempt,
      state.questions[0].id,
      { type: 'true-false', value: true },
      randomUUID(),
      false,
    ]);
    state.phase = 'prepared';
    report.status = 'prepared';
    report.fixture = { subject: state.subject, activity: state.activity, attempt: state.attempt };
    console.log(JSON.stringify({ phase: state.phase, ...report.fixture }));
  } else if (phase === 'race') {
    assert.equal(state.phase, 'prepared');
    if (report.failure) {
      report.preparationFailures ??= [];
      report.preparationFailures.push(report.failure);
      delete report.failure;
    }
    const requestedTime = process.argv[3] ?? '';
    const requestAt = /^\+\d+$/.test(requestedTime)
      ? Date.now() + Number(requestedTime.slice(1))
      : Date.parse(requestedTime);
    const delay = requestAt - Date.now();
    assert.ok(delay > 0 && delay < 45000, 'Horario de coordinación inválido.');
    const pair = [client('tabA'), client('tabB')];
    const identity = await Promise.all(pair.map((c) => c.auth.getUser()));
    assert.ok(
      identity.every((x) => !x.error && x.data.user?.id === accounts.users.student.id),
      'Sesiones no verificadas.',
    );
    console.log(JSON.stringify({ ready: true, requestAt: new Date(requestAt).toISOString() }));
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, requestAt - Date.now())));
    report.race = await Promise.all(
      pair.map(async (c, i) => {
        const sentAt = new Date().toISOString();
        const began = performance.now();
        const res = await c
          .rpc('aulify_command', {
            p_action: 'useHint',
            p_payload: { args: [state.attempt, state.questions[i + 1].id] },
          })
          .abortSignal(AbortSignal.timeout(15000));
        return {
          tab: i ? 'B' : 'A',
          sentAt,
          endedAt: new Date().toISOString(),
          durationMs: performance.now() - began,
          status: res.status,
          revealed: res.data === state.questions[i + 1].hint,
          hasData: res.data !== null,
          error: res.error ? { code: res.error.code, message: res.error.message } : null,
        };
      }),
    );
    await save();
    assert.equal(report.race.filter((x) => x.revealed).length, 1);
    pass('Dos solicitudes: una sola pista revelada');
    assert.ok(report.race[0].revealed);
    pass('La pregunta elegible conserva la pista correcta');
    assert.ok(
      !report.race[1].hasData && /HINT_USED|QUESTION_ORDER/.test(report.race[1].error?.message),
    );
    pass('La otra pregunta no revela una pista adicional');
    assert.ok(
      Math.max(...report.race.map((x) => Date.parse(x.sentAt))) <
        Math.min(...report.race.map((x) => Date.parse(x.endedAt))),
    );
    pass('Solicitudes HTTP superpuestas');
    state.phase = 'raced';
    report.status = 'race-contract-passed';
  } else {
    assert.equal(state.phase, 'raced');
    const student = client('tabA'),
      teacher = client('teacher');
    assert.equal(
      await rpc(student, 'useHint', [state.attempt, state.questions[1].id]),
      state.questions[1].hint,
    );
    pass('Reenvío de la pista ganadora devuelve la misma');
    await rejected(
      student,
      [state.attempt, state.questions[2].id],
      'HINT_USED',
      'Otra pista permanece rechazada después de la carrera',
    );
    const after = JSON.stringify(await snapshot(student));
    assert.ok(!after.includes(state.questions[2].hint));
    pass('La proyección posterior no expone la pista perdedora');
    report.afterSnapshotHash = hash(after);
    await rpc(teacher, 'archiveSubject', [state.subject]);
    pass('Se archiva únicamente la materia del ensayo y se cierra su intento');
    for (const session of Object.values(state.sessions)) {
      const res = await fetch(`${url}/auth/v1/logout?scope=local`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${session.token}` },
      });
      assert.ok(res.ok, `No se cerró una sesión del ensayo: ${res.status}`);
    }
    state.sessions = {};
    state.phase = 'finished';
    report.status = 'contract-passed-awaiting-sql-audit';
    report.finishedAt = new Date().toISOString();
    pass('Se cierran las tres sesiones creadas sin cerrar otras sesiones de las cuentas');
  }
} catch (error) {
  report.status = 'failed';
  report.failure = String(error.message).slice(0, 600);
  process.exitCode = 1;
  console.error(report.failure);
} finally {
  await save();
}
