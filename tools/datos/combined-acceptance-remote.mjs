import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID as id, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// Casos nuevos; no vuelve a ejecutar el catálogo remoto histórico ni borra datos ajenos.
const script = 'tools/datos/combined-acceptance-remote.mjs';
const env = Object.fromEntries(
  (await fs.readFile('.env.local', 'utf8'))
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const accounts = JSON.parse(await fs.readFile('.local-private/remote-test-accounts.json', 'utf8'));
assert.equal(accounts.projectRef, 'bnqyyumfmyexsqszglab');
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'https://bnqyyumfmyexsqszglab.supabase.co');
const client = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }) },
  });
const clients = {};
const only = process.argv
  .find((arg) => arg.startsWith('--only='))
  ?.slice(7)
  .split(',');
const subjects = [];
const report = {
  startedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  script: {
    path: script,
    sha256: createHash('sha256')
      .update(await fs.readFile(script))
      .digest('hex'),
  },
  environment:
    'Supabase remoto; cuatro cuentas ficticias, sesiones JWT independientes y reconexión real',
  cases: [],
  limitations: [
    'No evalúa capacidad, correo, presentación visual ni confirmaciones de interfaz.',
    'Las materias creadas se archivan al terminar; no se purgan datos ni se altera el historial previo.',
  ],
};
let active;
const rpc = async (role, name, args = {}) => {
  const { data, error } = await clients[role].rpc(name, args);
  if (error || data?.error) {
    const failure = error || data.error;
    throw Object.assign(new Error(failure.message), { code: failure.code });
  }
  return data;
};
const cmd = (role, action, ...args) =>
  rpc(role, 'aulify_command', { p_action: action, p_payload: { args } });
const snapshot = (role) => rpc(role, 'aulify_snapshot');
const check = (value, label) => {
  assert.ok(value, label);
  active.checks.push({ label, result: 'passed' });
};
const equal = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  active.checks.push({ label, result: 'passed' });
};
const reject = async (fn, expected, label) => {
  let failure;
  try {
    await fn();
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, label);
  assert.match(`${failure.code}: ${failure.message}`, expected, label);
  active.checks.push({ label, result: 'rejected-as-expected', code: failure.code });
};
async function login(role) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({
    email: accounts.users[role].email,
    password: accounts.users[role].password,
  });
  if (error) throw new Error(`No se pudo preparar ${role}: Auth ${error.status}`);
  clients[role] = c;
}
async function scenario(name, fn) {
  if (only && !only.some((prefix) => name.startsWith(prefix))) return;
  active = { name, checks: [] };
  report.cases.push(active);
  try {
    await fn();
    active.status = 'passed';
  } catch (error) {
    active.status = 'failed';
    active.failure = { code: error.code || error.name, message: error.message.slice(0, 500) };
    process.exitCode = 1;
  }
  console.log(`${active.status}: ${name} (${active.checks.length} comprobaciones)`);
}
async function subject(join = true) {
  const row = await cmd('teacher', 'createSubject', {
    name: 'Aceptación combinada · datos ficticios',
    course: '3.º A',
    year: 2026,
    description: 'Materia exclusiva de esta verificación.',
  });
  subjects.push(row.id);
  const code = (await snapshot('teacher')).state.subjects.find((s) => s.id === row.id).code;
  const memberships = {};
  if (join)
    for (const role of ['student', 'studentOther']) {
      const request = await cmd(role, 'requestMembership', code);
      memberships[role] = await cmd('teacher', 'decideMembership', request.id, 'approved');
    }
  return { ...row, code, memberships };
}
const settings = {
  purpose: 'practice',
  pace: 'individual',
  maxGrade: 100,
  weight: 1,
  countsTowardAverage: true,
  maxAttempts: 1,
  opensAt: new Date(Date.now() - 60_000).toISOString(),
  closesAt: new Date(Date.now() + 3_600_000).toISOString(),
  timeLimitMinutes: null,
  timeZone: 'America/La_Paz',
  feedback: 'immediate',
  manualCorrection: false,
  shuffleQuestions: false,
  shuffleOptions: false,
  streaks: false,
  sound: false,
  ranking: false,
  teams: false,
  allowHint: false,
  allowDouble: false,
  bonusAffectsGrade: false,
  reportVisibility: false,
};
async function activity(s, questions, extra = {}) {
  const draft = {
    id: id(),
    ownerId: accounts.users.teacher.id,
    title: 'Recurso combinado de prueba',
    kind: 'quiz',
    revision: 1,
    updatedAt: new Date().toISOString(),
    blocks: [{ id: id(), type: 'quiz', questions }],
  };
  await cmd('teacher', 'saveDraft', draft, 0);
  const version = await cmd('teacher', 'publishResource', draft.id);
  return cmd('teacher', 'createActivity', version.id, s.id, { ...settings, ...extra }, draft.title);
}
const questions = () =>
  [0, 1].map((i) => ({
    id: id(),
    type: 'true-false',
    prompt: `Pregunta ${i + 1}`,
    points: 2,
    correct: true,
    hint: 'Una pista ficticia.',
  }));
try {
  for (const role of ['teacher', 'teacherOther', 'student', 'studentOther']) await login(role);
  await scenario('AP-08 · mezcla y reconexión JWT', async () => {
    const s = await subject(),
      group = id();
    const qs = ['A', 'B', 'C', 'D'].map((label, i) => {
      const options = [
        { id: id(), text: 'Primera opción' },
        { id: id(), text: 'Segunda opción' },
      ];
      return {
        id: id(),
        type: 'single',
        prompt: `Pregunta ${label}`,
        points: 2,
        options,
        correctOptionId: options[0].id,
        explanation: `Explicación ${label}`,
        ...(i < 2 ? { groupId: group } : {}),
      };
    });
    const a = await activity(s, qs, { shuffleQuestions: true, shuffleOptions: true });
    const first = await cmd('student', 'startAttempt', a.id);
    equal(
      [...first.questionOrder].sort(),
      qs.map((q) => q.id).sort(),
      'Mismo conjunto de cuatro preguntas',
    );
    equal(
      first.questionOrder.indexOf(qs[1].id),
      first.questionOrder.indexOf(qs[0].id) + 1,
      'A/B permanecen juntas y ordenadas',
    );
    for (const q of qs)
      equal(
        [...first.optionOrders[q.id]].sort(),
        q.options.map((o) => o.id).sort(),
        'Opciones conservan su conjunto',
      );
    const q = qs.find((q) => q.id === first.questionOrder[0]);
    const value = { type: 'single', optionId: q.correctOptionId };
    const ack = await cmd('student', 'submitAnswer', first.id, q.id, value, id(), false);
    equal(ack.feedback.explanation, q.explanation, 'Explicación asociada a la pregunta mezclada');
    await clients.student.auth.signOut({ scope: 'local' });
    await login('student');
    const recovered = await cmd('student', 'startAttempt', a.id);
    equal(
      [recovered.id, recovered.questionOrder, recovered.optionOrders, recovered.deadline],
      [first.id, first.questionOrder, first.optionOrders, first.deadline],
      'Nueva sesión recupera el mismo intento y plazo',
    );
    equal(
      recovered.answers.map((r) => [r.questionId, r.value]),
      [[q.id, value]],
      'Respuesta conservada sin duplicación',
    );
  });
  await scenario('AP-20 · equipos bloqueados y permisos en una ejecución', async () => {
    const s = await subject(),
      qs = questions();
    const a = await activity(s, qs, { teams: true, ranking: true });
    const teams = ['student', 'studentOther'].map((role, i) => ({
      name: `Equipo ${i + 1}`,
      studentIds: [accounts.users[role].id],
    }));
    await cmd('teacher', 'configureTeams', a.id, teams);
    await cmd('student', 'startAttempt', a.id);
    for (const role of ['teacher', 'teacherOther', 'student', 'studentOther'])
      await reject(
        () => cmd(role, 'configureTeams', a.id, teams.slice().reverse()),
        /TEAMS_LOCKED|FORBIDDEN/,
        `${role} no cambia equipos tras iniciar`,
      );
    await reject(
      () => cmd('teacher', 'autoTeams', a.id, 1),
      /TEAMS_LOCKED/,
      'Reparto automático también queda bloqueado',
    );
    const own = await cmd('teacher', 'ranking', a.id);
    equal(
      own.teams.map((t) => t.name).sort(),
      teams.map((t) => t.name).sort(),
      'Rechazos conservan equipos',
    );
    const view = await cmd('student', 'ranking', a.id);
    check(
      !JSON.stringify(view).includes(accounts.users.studentOther.id) &&
        !JSON.stringify(view).includes('@'),
      'Clasificación estudiantil omite identidades ajenas y correos',
    );
    await reject(
      () => cmd('teacherOther', 'ranking', a.id),
      /FORBIDDEN|MEMBERSHIP_REQUIRED/,
      'Docente ajeno no lee clasificación',
    );
  });
  await scenario('AP-25 · nota manual individual sin entregas inventadas', async () => {
    const s = await subject();
    const manual = await cmd('teacher', 'createManualActivity', {
      subjectId: s.id,
      title: 'Exposición oral',
      description: 'Evaluación presencial ficticia',
      occursAt: new Date().toISOString(),
      maxGrade: 100,
      weight: 1,
      countsTowardAverage: true,
    });
    await cmd(
      'teacher',
      'gradeManual',
      manual.id,
      accounts.users.student.id,
      85,
      'Explicación clara.',
      null,
      true,
    );
    const teacher = (await snapshot('teacher')).state;
    equal(
      teacher.evaluations
        .filter((e) => e.activityId === manual.id)
        .map((e) => [e.studentId, e.grade]),
      [[accounts.users.student.id, 85]],
      'Solo la nota del estudiante evaluado se publica',
    );
    check(!teacher.submissions.some((e) => e.taskId === manual.id), 'No crea entregas de archivos');
    check(!teacher.attempts.some((e) => e.activityId === manual.id), 'No crea intentos de quiz');
    const other = await snapshot('studentOther');
    equal(
      other.state.evaluations.filter((e) => e.activityId === manual.id),
      [],
      'Segundo estudiante sin nota ficticia',
    );
    const result = other.studentResults[s.id].find((r) => r.activityId === manual.id);
    check(result && result.grade == null, 'Resultado pendiente excluido de la nota publicada');
  });
  await scenario('AP-29 · retiro, evaluación/exclusión y reingreso', async () => {
    const s = await subject(),
      qs = questions();
    const a = await activity(s, qs, { feedback: 'hidden', allowHint: true, allowDouble: true });
    const attempts = {};
    for (const role of ['student', 'studentOther']) {
      const attempt = await cmd(role, 'startAttempt', a.id);
      attempts[role] = attempt;
      await cmd(role, 'useHint', attempt.id, qs[0].id);
      await cmd(
        role,
        'submitAnswer',
        attempt.id,
        qs[0].id,
        { type: 'true-false', value: true },
        id(),
        true,
      );
      await cmd(
        'teacher',
        'withdrawMembership',
        s.memberships[role].id,
        'Retiro ficticio de prueba',
      );
      await reject(
        () => cmd(role, 'readAttempt', attempt.id),
        /MEMBERSHIP_REQUIRED/,
        'Retiro revoca lectura',
      );
      await reject(
        () =>
          cmd(
            role,
            'submitAnswer',
            attempt.id,
            qs[1].id,
            { type: 'true-false', value: true },
            id(),
            false,
          ),
        /MEMBERSHIP_REQUIRED/,
        'Retiro revoca respuestas',
      );
    }
    await reject(
      () => cmd('teacher', 'resolveAttempt', attempts.student.id, 'evaluate', ''),
      /resolution_kind|REASON/,
      'Resolución exige motivo',
    );
    await cmd('teacher', 'resolveAttempt', attempts.student.id, 'evaluate', 'Evaluar lo recibido');
    await cmd(
      'teacher',
      'resolveAttempt',
      attempts.studentOther.id,
      'exclude',
      'Excluir esta participación',
    );
    const grade = await cmd('teacher', 'publishGrade', a.id, accounts.users.student.id);
    equal(grade.grade, 50, 'La omisión resuelta equivale a cero y no fabrica respuesta');
    await reject(
      () => cmd('teacher', 'publishGrade', a.id, accounts.users.studentOther.id),
      /REVIEW_PENDING/,
      'Exclusión impide fabricar una nota',
    );
    for (const role of ['student', 'studentOther']) {
      const request = await cmd(role, 'requestMembership', s.code);
      await cmd('teacher', 'decideMembership', request.id, 'approved');
      const recovered = await cmd(role, 'readAttempt', attempts[role].id);
      equal(recovered.status, 'closed', 'Reingreso no reabre el intento');
      equal(recovered.answers.length, 1, 'Solo se conserva la respuesta que existía');
      await reject(
        () => cmd(role, 'startAttempt', a.id),
        /ATTEMPTS_EXHAUSTED/,
        'No devuelve oportunidades consumidas',
      );
    }
    const uses = (await snapshot('teacher')).state.powerups.filter((p) => p.activityId === a.id);
    equal(uses.length, 4, 'Pista y doble consumidos permanecen para ambos estudiantes');
  });
  await scenario('AP-30 · archivo con intento abierto y plazo conservado', async () => {
    const s = await subject(),
      qs = questions(),
      a = await activity(s, qs);
    const attempt = await cmd('student', 'startAttempt', a.id);
    await cmd('teacher', 'archiveSubject', s.id);
    await reject(
      () => cmd('student', 'readAttempt', attempt.id),
      /MEMBERSHIP_REQUIRED/,
      'Archivo revoca el acceso',
    );
    await cmd('teacher', 'restoreSubject', s.id);
    const recovered = await cmd('student', 'readAttempt', attempt.id);
    equal(
      [recovered.status, recovered.closeReason],
      ['closed', 'archived'],
      'Restaurar conserva el cierre por archivo',
    );
    equal(recovered.deadline, attempt.deadline, 'No amplía el plazo del intento');
    const fresh = await cmd('student', 'readActivity', a.id);
    equal(fresh.activity.settings.closesAt, a.settings.closesAt, 'No amplía el cierre general');
    await reject(
      () => cmd('student', 'startAttempt', a.id),
      /ATTEMPTS_EXHAUSTED/,
      'No restituye el intento consumido',
    );
  });
  await scenario('AP-28 · seguimiento desactivado sin eventos', async () => {
    const s = await subject(),
      qs = questions(),
      a = await activity(s, qs, { reportVisibility: false });
    const attempt = await cmd('student', 'startAttempt', a.id);
    const before = (await cmd('teacher', 'readAttempt', attempt.id)).visibilityEvents;
    equal(
      await cmd(
        'student',
        'reportVisibility',
        attempt.id,
        id(),
        new Date().toISOString(),
        new Date().toISOString(),
      ),
      false,
      'Servidor omite la señal desactivada',
    );
    equal(
      (await cmd('teacher', 'readAttempt', attempt.id)).visibilityEvents,
      before,
      'No persiste eventos nuevos',
    );
    active.limitations = [
      'Solo cubre seguimiento desactivado; retención y resolución mínima requieren su prueba separada.',
    ];
  });
  await scenario(
    'AP-37 · diez códigos inválidos y renovación con solicitud pendiente',
    async () => {
      const recordPath = '.local-private/code-limit-account.json';
      let record;
      try {
        record = JSON.parse(await fs.readFile(recordPath, 'utf8'));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const password = id() + 'aA9!',
          email = `aulify-codes-${id()}@example.test`;
        const { data, error: creation } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: 'Códigos · prueba', role: 'student' },
        });
        if (creation) throw creation;
        record = { projectRef: accounts.projectRef, id: data.user.id, email, password };
        await fs.writeFile(recordPath, JSON.stringify(record) + '\n');
      }
      assert.equal(record.projectRef, accounts.projectRef);
      accounts.users.codeCheck = record;
      await login('codeCheck');
      const s = await subject(false);
      const request = await cmd('studentOther', 'requestMembership', s.code);
      for (let i = 0; i < 10; i++)
        await reject(
          () => cmd('codeCheck', 'requestMembership', `INVALIDO-${id()}`),
          /CODE_INVALID/,
          `Código inválido ${i + 1}`,
        );
      await reject(
        () => cmd('codeCheck', 'requestMembership', s.code),
        /RATE_LIMIT/,
        'Undécima comprobación limitada',
      );
      const renewed = await cmd('teacher', 'renewCode', s.id);
      check(renewed.code !== s.code, 'Renovación cambia el código');
      const pending = (await snapshot('teacher')).state.memberships.find(
        (m) => m.id === request.id,
      );
      check(pending && pending.status === 'pending', 'Conserva la solicitud pendiente original');
      await cmd('teacher', 'decideMembership', request.id, 'approved');
      check(
        (await snapshot('studentOther')).state.subjects.some((row) => row.id === s.id),
        'Solicitud anterior puede aprobarse después de renovar',
      );
    },
  );
} catch (error) {
  report.setupFailure = { code: error.code || error.name, message: error.message.slice(0, 500) };
  process.exitCode = 1;
} finally {
  report.cleanup = [];
  for (const subjectId of subjects) {
    try {
      await cmd('teacher', 'archiveSubject', subjectId);
      report.cleanup.push({ result: 'archived' });
    } catch (error) {
      report.cleanup.push({ result: 'failed', code: error.code || error.name });
    }
  }
  for (const c of Object.values(clients)) await c.auth.signOut({ scope: 'local' });
  report.completedAt = new Date().toISOString();
  report.status =
    report.setupFailure || report.cases.some((c) => c.status !== 'passed') ? 'failed' : 'passed';
  const reportName = only
    ? `aceptacion-remota-${only.join('-').toLowerCase()}.json`
    : 'aceptacion-combinada-remota.json';
  await fs.writeFile(`docs/verificacion/${reportName}`, JSON.stringify(report, null, 2) + '\n');
  console.log(
    `Informe: ${report.status}; ${report.cases.length} casos. Credenciales fuera de resultados.`,
  );
}
