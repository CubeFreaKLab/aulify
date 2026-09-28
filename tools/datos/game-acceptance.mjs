import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID as id } from 'node:crypto';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// Ejecutar desde la raíz. Sin secretos, red ni escrituras al esquema app durante los casos.
const reportIndex = process.argv.indexOf('--report');
const reportPath =
  reportIndex < 0
    ? 'docs/verificacion/juego-aceptacion-aislada.json'
    : process.argv[reportIndex + 1];
const throughIndex = process.argv.indexOf('--through');
const through = throughIndex < 0 ? null : process.argv[throughIndex + 1];
if (through !== null && !/^\d{14}$/.test(through))
  throw new Error('--through requiere una versión de migración de 14 dígitos.');
const scriptPath = 'tools/datos/game-acceptance.mjs';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const report = {
  startedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  environment: 'PGlite aislado, rol authenticated y Auth/Storage mínimos',
  migrationCutoff: through,
  script: { path: scriptPath, sha256: hash(await fs.readFile(scriptPath)) },
  migrations: [],
  cases: [],
  limitations: [
    'Auth y Storage mínimos; no verifica Supabase remoto, JWT ni transporte HTTP.',
    'No verifica explicación visual de incompatibilidades, sonido, animación ni accesibilidad.',
    'PGlite utiliza una conexión; no acredita carreras concurrentes ni capacidad.',
    'No acredita otros escenarios AP por el número de aserciones.',
  ],
};
const db = new PGlite();
const users = Object.fromEntries(
  ['teacher', 'otherTeacher', 'outsider', 'E1', 'E2', 'E3', 'E4', 'E5'].map((name) => [name, id()]),
);
let currentCase;
const as = async (name) => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [users[name]]);
};
const command = async (action, ...args) => {
  const result = (await db.query('select public.aulify_command($1,$2) result', [action, { args }]))
    .rows[0].result;
  if (result?.error) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
};
const snapshot = async () =>
  (await db.query('select public.aulify_snapshot() result')).rows[0].result;
const scoped = async (activity) =>
  (await db.query('select public.aulify_activity_snapshot($1) result', [activity.id])).rows[0]
    .result;
const equal = (actual, expected, detail) => {
  assert.deepEqual(actual, expected, detail);
  currentCase.checks.push({ detail, result: 'passed' });
  console.log(`PASS ${currentCase.scenario}: ${detail}`);
};
const sync = async (activity) =>
  (await db.query('select public.aulify_sync($1) result', [activity.id])).rows[0].result;
const content = (snapshot) => {
  const copy = structuredClone(snapshot);
  // revision del snapshot es hora de lectura, no la huella opaca de aulify_sync.
  delete copy.state.revision;
  return copy;
};
const reject = async (fn, expected, detail) => {
  let rejected;
  try {
    await fn();
  } catch (error) {
    rejected = error;
  }
  assert.ok(rejected, `${detail}: la operación no fue rechazada`);
  assert.match(rejected.message, expected, `${detail}: rechazo inesperado`);
  currentCase.checks.push({ detail, result: 'rejected-as-expected', code: rejected.code });
  console.log(`PASS ${currentCase.scenario}: ${detail}`);
};
const scenario = async (name, fixture, fn) => {
  currentCase = { scenario: name, fixture, checks: [] };
  report.cases.push(currentCase);
  try {
    await fn();
    currentCase.status = 'passed';
  } catch (error) {
    currentCase.status = 'failed';
    currentCase.failure = String(error.message).slice(0, 600);
    console.error(`FAIL ${name}: ${currentCase.failure}`);
    process.exitCode = 1;
  }
};
const settings = {
  purpose: 'practice',
  pace: 'individual',
  maxGrade: 20,
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
  ranking: true,
  teams: false,
  allowHint: false,
  allowDouble: false,
  bonusAffectsGrade: false,
  reportVisibility: false,
};
const closedQuestion = (points = 2) => ({
  id: id(),
  type: 'true-false',
  prompt: 'Afirmación de prueba.',
  points,
  correct: true,
  explanation: 'Explicación reservada de prueba.',
  hint: 'Pista reservada de prueba.',
});
const openQuestion = (points) => ({
  id: id(),
  type: 'open',
  prompt: 'Explica tu respuesta.',
  points,
  manual: true,
  explanation: 'Explicación manual reservada.',
  manualGuide: 'Guía privada de prueba.',
});
const reply = (question, correct = true) =>
  question.type === 'open'
    ? { type: 'open', text: 'Respuesta ficticia para revisión.' }
    : { type: 'true-false', value: correct };
let subject;
async function version(title, questions) {
  await as('teacher');
  const resource = {
    id: id(),
    ownerId: users.teacher,
    title,
    kind: 'quiz',
    revision: 1,
    updatedAt: new Date().toISOString(),
    blocks: [{ id: id(), type: 'quiz', questions }],
  };
  await command('saveDraft', resource, 0);
  return command('publishResource', resource.id);
}
async function activity(title, questions, overrides = {}) {
  const published = await version(title, questions);
  return command('createActivity', published.id, subject.id, { ...settings, ...overrides }, title);
}
async function guided(title, questions, names, overrides = {}) {
  const result = await activity(title, questions, { pace: 'guided', ...overrides });
  if (overrides.teams)
    await command('configureTeams', result.id, [
      { name: 'Equipo de prueba', studentIds: names.map((name) => users[name]) },
    ]);
  for (const name of names) {
    await as(name);
    await command('joinGuidedRoom', result.id);
  }
  await as('teacher');
  await command('startGuidedSession', result.id);
  const attempts = {};
  for (const name of names) {
    await as(name);
    attempts[name] = await command('startAttempt', result.id);
  }
  return { activity: result, attempts };
}
async function answerGroup(run, question, names, correct = true) {
  for (const name of names) {
    await as(name);
    await command(
      'submitAnswer',
      run.attempts[name].id,
      question.id,
      reply(question, correct),
      id(),
      false,
    );
  }
}
async function finishQuestion(run, confirm = false) {
  await as('teacher');
  return command('closeGuidedQuestion', run.activity.id, confirm);
}
function privateQuestionFieldsAbsent(view, detail) {
  const questionSets = [
    view.questions,
    ...(view.blocks ?? []).filter((b) => b.type === 'quiz').map((b) => b.questions),
  ].filter(Boolean);
  equal(
    questionSets
      .flat()
      .some((q) =>
        [
          'correct',
          'correctOptionId',
          'correctOptionIds',
          'manualGuide',
          'explanation',
          'hint',
        ].some((key) => q[key] !== undefined && q[key] !== null),
      ),
    false,
    detail,
  );
}
function answerReviewsAbsent(attempt, detail) {
  equal(
    attempt.answers.every((answer) => answer.reviews.length === 0),
    true,
    detail,
  );
}

try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
    alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
  for (const name of (await fs.readdir('supabase/migrations'))
    .filter((f) => f.endsWith('.sql') && (through === null || f.slice(0, 14) <= through))
    .sort()) {
    const source = await fs.readFile(`supabase/migrations/${name}`, 'utf8');
    await db.exec(source);
    report.migrations.push({ name, sha256: hash(source) });
  }
  for (const [name, userId] of Object.entries(users)) {
    await db.query('insert into auth.users values($1,$2,now(),$3)', [
      userId,
      `${name}@example.test`,
      {
        name: `Cuenta ficticia ${name}`,
        role: name.toLowerCase().includes('teacher') ? 'teacher' : 'student',
      },
    ]);
  }
  await db.exec('set role authenticated');
  await as('teacher');
  subject = await command('createSubject', {
    name: 'Aceptación de juego y publicación',
    course: '3.º A',
    year: 2026,
    description: 'Datos ficticios.',
  });
  const code = (await snapshot()).state.subjects.find((s) => s.id === subject.id).code;
  for (const name of ['E1', 'E2', 'E3', 'E4', 'E5']) {
    await as(name);
    const request = await command('requestMembership', code);
    await as('teacher');
    await command('decideMembership', request.id, 'approved');
  }

  await scenario(
    'AP-08',
    'Dos preguntas dependientes A/B y dos independientes C/D; mezcla de preguntas/opciones; recuperación del mismo intento.',
    async () => {
      const groupId = id();
      const qs = ['A', 'B', 'C', 'D'].map((label, i) => {
        const options = [
          { id: id(), text: 'Primera opción.' },
          { id: id(), text: 'Segunda opción.' },
        ];
        return {
          id: id(),
          type: 'single',
          prompt: `Pregunta ${label}.`,
          points: 2,
          ...(i < 2 ? { groupId } : {}),
          options,
          correctOptionId: options[0].id,
          explanation: `Explicación asociada ${label}.`,
        };
      });
      const a = await activity('AP-08 mezcla', qs, {
        shuffleQuestions: true,
        shuffleOptions: true,
      });
      await as('E1');
      const first = await command('startAttempt', a.id);
      const order = first.questionOrder;
      equal(
        [...order].sort(),
        qs.map((q) => q.id).sort(),
        'El orden contiene el mismo conjunto de cuatro preguntas',
      );
      equal(
        order.indexOf(qs[1].id),
        order.indexOf(qs[0].id) + 1,
        'A y B permanecen consecutivas y en orden interno',
      );
      const q = qs.find((item) => item.id === order[0]);
      const answer = { type: 'single', optionId: q.correctOptionId };
      const ack = await command('submitAnswer', first.id, q.id, answer, id(), false);
      equal(
        ack.feedback.explanation,
        q.explanation,
        'La explicación viaja con el identificador de la pregunta mezclada',
      );
      await as('teacher');
      await as('E1');
      const recovered = await command('startAttempt', a.id);
      equal(
        [recovered.id, recovered.questionOrder, recovered.optionOrders, recovered.deadline],
        [first.id, first.questionOrder, first.optionOrders, first.deadline],
        'Nueva entrada conserva intento, preguntas, opciones y plazo',
      );
      equal(
        recovered.answers.map((r) => [r.questionId, r.value]),
        [[q.id, answer]],
        'Recupera la respuesta confirmada',
      );
      const view = await command('readActivity', a.id);
      equal(
        view.questions.map((item) => item.id),
        order,
        'La proyección respeta el orden persistido',
      );
      for (const questionId of order.slice(1)) {
        const next = qs.find((item) => item.id === questionId);
        const confirmed = await command(
          'submitAnswer',
          first.id,
          next.id,
          { type: 'single', optionId: next.correctOptionId },
          id(),
          false,
        );
        equal(
          confirmed.feedback.explanation,
          next.explanation,
          'Explicación correcta para otra pregunta del orden mezclado',
        );
        equal(
          confirmed.feedback.correct,
          true,
          'Corregir por identificador conserva el acierto con opciones mezcladas',
        );
      }
      await as('E2');
      const peer = await command('startAttempt', a.id);
      equal(
        [...peer.questionOrder].sort(),
        [...order].sort(),
        'E2 recibe el mismo conjunto sin exigir orden exclusivo',
      );
      equal(
        peer.questionOrder.indexOf(qs[1].id),
        peer.questionOrder.indexOf(qs[0].id) + 1,
        'El grupo dependiente también conserva el orden para E2',
      );
    },
  );

  await scenario(
    'AP-09',
    'E1/E2 en sala, doble inicio, E1 responde y E2 omite automática de 2; última escrita de 3 pendiente en ambos.',
    async () => {
      const qs = [closedQuestion(2), openQuestion(3)];
      const a = await activity('AP-09 sesión', qs, { pace: 'guided' });
      for (const name of ['E1', 'E2']) {
        await as(name);
        await command('joinGuidedRoom', a.id);
        const room = await scoped(a);
        equal(
          [room.state.attempts.length, room.studentActivities[a.id].attemptsRemaining],
          [0, 1],
          `${name}: entrar a sala no consume intento`,
        );
      }
      await as('teacher');
      await command('startGuidedSession', a.id);
      await command('startGuidedSession', a.id);
      const teacher = await scoped(a);
      equal(
        teacher.state.attempts.map((t) => [t.studentId, t.number]).sort(),
        [
          [users.E1, 1],
          [users.E2, 1],
        ].sort(),
        'Dos inicios crean exactamente un intento por inscrito',
      );
      const attempts = Object.fromEntries(
        ['E1', 'E2'].map((name) => [
          name,
          teacher.state.attempts.find((t) => t.studentId === users[name]),
        ]),
      );
      const run = { activity: a, attempts };
      await answerGroup(run, qs[0], ['E1']);
      await as('E1');
      await reject(
        () => command('submitAnswer', attempts.E1.id, qs[1].id, reply(qs[1]), id(), false),
        /QUESTION_CLOSED/,
        'E1 espera apertura docente de la segunda pregunta',
      );
      await as('teacher');
      await reject(
        () => command('closeGuidedQuestion', a.id, false),
        /CONFIRM_PENDING/,
        'Cerrar omisión de E2 requiere confirmación',
      );
      await command('closeGuidedQuestion', a.id, true);
      await as('E2');
      await reject(
        () => command('submitAnswer', attempts.E2.id, qs[0].id, reply(qs[0]), id(), false),
        /QUESTION_CLOSED/,
        'E2 no responde la pregunta ya cerrada',
      );
      await as('teacher');
      await command('openNextGuidedQuestion', a.id);
      await answerGroup(run, qs[1], ['E1', 'E2']);
      const closed = await finishQuestion(run);
      equal(closed.guided.status, 'closed', 'Cerrar la última pregunta finaliza la sesión');
      for (const name of ['E1', 'E2']) {
        const attempt = await command('readAttempt', attempts[name].id);
        equal(
          [
            attempt.status,
            attempt.closeReason,
            attempt.answers.find((r) => r.questionId === qs[1].id).reviews.length,
          ],
          ['closed', 'guided-complete', 0],
          `${name}: cierre normal conserva escritura pendiente`,
        );
        await reject(
          () => command('publishGrade', a.id, users[name]),
          /REVIEW_PENDING/,
          `${name}: no publica nota incompleta`,
        );
      }
      const ranking = await command('ranking', a.id);
      equal(
        ['E1', 'E2'].map(
          (name) => ranking.individual.find((r) => r.studentId === users[name]).points,
        ),
        [2, 0],
        'Omisión aporta cero solo a E2; conserva los 2 puntos de E1',
      );
      await command('reviewAnswer', attempts.E1.id, qs[1].id, 3, 'Corrección ficticia.');
      await command('reviewAnswer', attempts.E2.id, qs[1].id, 3, 'Corrección ficticia.');
      equal(
        (await command('publishGrade', a.id, users.E1)).grade,
        20,
        'E1 termina con 5/5 y nota 20',
      );
      equal(
        (await command('publishGrade', a.id, users.E2)).grade,
        12,
        'E2 conserva cero por omisión: 3/5 y nota 12',
      );
    },
  );

  await scenario(
    'AP-11',
    'Pista y doble en intento 1; reenvío idéntico; intento 2 no recupera ninguno de los usos.',
    async () => {
      const q = closedQuestion(2);
      const a = await activity('AP-11 potenciadores', [q], {
        maxAttempts: 2,
        allowHint: true,
        allowDouble: true,
      });
      await as('E1');
      const first = await command('startAttempt', a.id);
      equal(await command('useHint', first.id, q.id), q.hint, 'Primera petición autoriza la pista');
      equal(
        await command('useHint', first.id, q.id),
        q.hint,
        'Repetir petición recupera la misma pista',
      );
      const key = id();
      await command('submitAnswer', first.id, q.id, reply(q), key, true);
      const replay = await command('submitAnswer', first.id, q.id, reply(q), key, true);
      equal(replay.attempt.answers.length, 1, 'Reenvío de respuesta cerrada no crea duplicado');
      const second = await command('startAttempt', a.id);
      equal([second.number, second.id !== first.id], [2, true], 'Se inicia la segunda oportunidad');
      const view = await command('readActivity', a.id);
      equal(
        [view.hintUsed, view.doubleUsed],
        [true, true],
        'Segundo intento conserva ambos usos consumidos',
      );
      await reject(
        () => command('useHint', second.id, q.id),
        /HINT_USED/,
        'Segunda oportunidad no recupera pista',
      );
      await reject(
        () => command('submitAnswer', second.id, q.id, reply(q), id(), true),
        /POWERUP_USED/,
        'Segunda oportunidad no recupera doble',
      );
      equal(
        (await command('readAttempt', second.id)).answers.length,
        0,
        'Doble rechazado no confirma la respuesta',
      );
      await command('submitAnswer', second.id, q.id, reply(q), id(), false);
      const student = await scoped(a);
      equal(
        student.state.powerups.map((p) => p.kind).sort(),
        ['double', 'hint'],
        'Un único consumo de cada potenciador en toda la actividad',
      );
      await as('teacher');
      equal(
        (await command('ranking', a.id)).individual[0].points,
        4,
        'Mejor juego conserva 4 puntos; no suma reenvíos ni oportunidades',
      );
    },
  );

  await scenario(
    'AP-15',
    'Ocultar siempre; rechazos separados de racha y clasificación; nota agregada 20/20.',
    async () => {
      const q = closedQuestion();
      const published = await version('AP-15', [q]);
      for (const option of ['ranking', 'streaks']) {
        await reject(
          () =>
            command(
              'createActivity',
              published.id,
              subject.id,
              { ...settings, feedback: 'hidden', ranking: false, [option]: true },
              'AP-15 incompatible',
            ),
          /quiz_rules/,
          `La configuración oculta rechaza ${option}`,
        );
      }
      const a = await command(
        'createActivity',
        published.id,
        subject.id,
        { ...settings, feedback: 'hidden', ranking: false },
        'AP-15 oculto',
      );
      await as('E1');
      const at = await command('startAttempt', a.id);
      const ack = await command('submitAnswer', at.id, q.id, reply(q), id(), false);
      equal(ack.feedback, null, 'ACK sin puntos, acierto ni explicación');
      answerReviewsAbsent(ack.attempt, 'ACK sin revisiones privadas');
      const read = await command('readActivity', a.id);
      privateQuestionFieldsAbsent(read, 'readActivity sin soluciones, explicación, guía ni pista');
      answerReviewsAbsent(await command('readAttempt', at.id), 'readAttempt sin revisiones');
      const before = await snapshot();
      equal(
        before.studentResults[subject.id].find((x) => x.activityId === a.id).grade,
        null,
        'Sin nota antes de publicación',
      );
      equal(before.state.versions.length, 0, 'Snapshot estudiantil sin versiones privadas');
      const local = await scoped(a);
      privateQuestionFieldsAbsent(
        local.studentActivities[a.id],
        'Snapshot acotado sin campos reservados',
      );
      answerReviewsAbsent(local.state.attempts[0], 'Snapshot acotado sin correcciones');
      equal(
        (await command('ranking', a.id)).available,
        false,
        'Clasificación no disponible al estudiante',
      );
      await as('teacher');
      equal(
        (await command('ranking', a.id)).individual[0].points,
        2,
        'Docente conserva puntos del juego',
      );
      await command('publishGrade', a.id, users.E1);
      await as('E1');
      const result = (await snapshot()).studentResults[subject.id].find(
        (x) => x.activityId === a.id,
      );
      equal(
        [result.grade, result.reviewVisible, result.answers],
        [20, false, undefined],
        'Nota 20 publicada sin desglose reservado',
      );
      equal(
        (await command('ranking', a.id)).available,
        false,
        'Publicar agregado no habilita clasificación oculta',
      );
    },
  );

  await scenario(
    'AP-16',
    'Guiada diferida: dos participantes, pregunta automática 8 y manual 2; cerrar, corregir y publicar uno por uno.',
    async () => {
      const qs = [closedQuestion(8), openQuestion(2)];
      const run = await guided('AP-16 diferida', qs, ['E1', 'E2'], {
        feedback: 'after-close',
        teams: true,
      });
      await answerGroup(run, qs[0], ['E1', 'E2']);
      await finishQuestion(run);
      await command('openNextGuidedQuestion', run.activity.id);
      await answerGroup(run, qs[1], ['E1', 'E2']);
      await finishQuestion(run);
      await as('E1');
      equal(
        (await command('readActivity', run.activity.id)).activity.guided.status,
        'closed',
        'Sesión cerrada normalmente',
      );
      equal(
        (await command('ranking', run.activity.id)).available,
        false,
        'Cierre sin publicaciones no libera clasificación',
      );
      privateQuestionFieldsAbsent(
        await command('readActivity', run.activity.id),
        'Cierre sin publicaciones no libera soluciones',
      );
      await as('teacher');
      for (const name of ['E1', 'E2'])
        await command('reviewAnswer', run.attempts[name].id, qs[1].id, 2, 'Revisión ficticia.');
      await as('E2');
      const unpub = (await snapshot()).studentResults[subject.id].find(
        (x) => x.activityId === run.activity.id,
      );
      equal(
        [unpub.grade, unpub.reviewVisible, unpub.answers],
        [null, false, undefined],
        'Corrección completa sin publicar conserva nota y revisión privadas',
      );
      equal(
        (await command('ranking', run.activity.id)).available,
        false,
        'Completar corrección no equivale a publicar clasificación',
      );
      await as('teacher');
      await command('publishGrade', run.activity.id, users.E1);
      for (const name of ['E1', 'E2']) {
        await as(name);
        equal(
          (await command('ranking', run.activity.id)).available,
          false,
          `Una publicación pendiente bloquea clasificación para ${name}`,
        );
      }
      const pending = await scoped(run.activity);
      privateQuestionFieldsAbsent(
        pending.studentActivities[run.activity.id],
        'E2 conserva soluciones privadas tras publicar E1',
      );
      answerReviewsAbsent(
        pending.state.attempts[0],
        'E2 conserva revisiones privadas tras publicar E1',
      );
      await as('teacher');
      await command('publishGrade', run.activity.id, users.E2);
      await as('E2');
      const ranked = await command('ranking', run.activity.id);
      equal(
        [ranked.available, ranked.provisional, ranked.individual.map((r) => r.points)],
        [true, false, [10, 10]],
        'Cierre y todas las publicaciones habilitan clasificación definitiva',
      );
      const result = (await snapshot()).studentResults[subject.id].find(
        (x) => x.activityId === run.activity.id,
      );
      equal(
        [result.grade, result.reviewVisible, result.answers.length],
        [20, true, 2],
        'E2 obtiene su revisión después de publicar',
      );
      const beforePrivateReview = {};
      for (const name of ['E1', 'E2']) {
        await as(name);
        beforePrivateReview[name] = {
          snapshot: await scoped(run.activity),
          sync: await sync(run.activity),
        };
      }
      await as('teacher');
      await command(
        'reviewAnswer',
        run.attempts.E2.id,
        qs[1].id,
        0,
        'Corrección revisada.',
        'Ajuste ficticio antes de republicar.',
      );
      await as('E1');
      const revised = await command('ranking', run.activity.id);
      currentCase.privateRevisionObservation = {
        publishedPoints: ranked.individual.map((row) => row.points),
        afterUnpublishedCorrection: {
          available: revised.available,
          points: revised.individual?.map((row) => row.points) ?? null,
        },
      };
      equal(
        !revised.available || revised.individual.every((row) => row.points === 10),
        true,
        'Una corrección posterior sin republicar no revela sus puntos mediante clasificación diferida',
      );
      equal(
        revised,
        ranked,
        'La corrección privada conserva la clasificación completa, incluidos equipos y estado',
      );
      for (const name of ['E1', 'E2']) {
        await as(name);
        equal(
          content(await scoped(run.activity)),
          content(beforePrivateReview[name].snapshot),
          `${name}: proyección idéntica después de la revisión privada`,
        );
        equal(
          (await sync(run.activity)).revision,
          beforePrivateReview[name].sync.revision,
          `${name}: huella de sincronización idéntica después de la revisión privada`,
        );
      }
      await as('E2');
      const previous = (await snapshot()).studentResults[subject.id].find(
        (x) => x.activityId === run.activity.id,
      );
      equal(
        [previous.grade, previous.answers.find((answer) => answer.questionId === qs[1].id).points],
        [20, 2],
        'E2 conserva la nota y el desglose publicados hasta republicar',
      );
      await as('teacher');
      equal(
        (await command('ranking', run.activity.id)).individual.map((row) => row.points),
        [10, 8],
        'El docente conserva acceso a los puntos revisados todavía privados',
      );
      await command(
        'publishGrade',
        run.activity.id,
        users.E2,
        '',
        'Republicación de la revisión ficticia.',
      );
      await as('E1');
      const republished = await command('ranking', run.activity.id);
      equal(
        [
          republished.available,
          republished.provisional,
          republished.individual.map((row) => row.points),
        ],
        [true, false, [10, 8]],
        'La republicación explícita libera la clasificación revisada',
      );
      equal(
        republished.teams.map((team) => team.points),
        [9],
        'El equipo se actualiza a promedio 9 solo al republicar',
      );
    },
  );

  await scenario(
    'AP-16 historial',
    'Mejor nota y mejor juego pertenecen a intentos distintos: base 6 con doble frente a base 10 sin doble.',
    async () => {
      const q = openQuestion(10);
      const closesAt = new Date(Date.now() + 5000).toISOString();
      const a = await activity('AP-16 historial de juego', [q], {
        feedback: 'after-close',
        maxAttempts: 2,
        allowDouble: true,
        closesAt,
      });
      const attempts = [];
      for (const points of [6, 10]) {
        await as('E4');
        const at = await command('startAttempt', a.id);
        attempts.push(at);
        await command('submitAnswer', at.id, q.id, reply(q), id(), points === 6);
        await as('teacher');
        await command('reviewAnswer', at.id, q.id, points, 'Corrección ficticia.');
      }
      const publication = await command('publishGrade', a.id, users.E4);
      equal(
        [publication.attemptId, publication.grade],
        [attempts[1].id, 20],
        'Se publica la mejor nota del segundo intento, sin premiar el doble del primero',
      );
      // Cierre real del reloj del servidor aislado: no se modifican tablas para forzarlo.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, Date.parse(closesAt) - Date.now() + 30)),
      );
      await as('E4');
      const published = await command('ranking', a.id);
      equal(
        [published.provisional, published.individual[0].points],
        [false, 12],
        'La clasificación conserva el mejor juego 12 del primer intento, distinto de la mejor nota',
      );
      const fingerprint = (await sync(a)).revision;
      await as('teacher');
      await command(
        'reviewAnswer',
        attempts[0].id,
        q.id,
        8,
        'Nueva revisión privada.',
        'Ajuste ficticio del otro intento.',
      );
      await as('E4');
      equal(
        await command('ranking', a.id),
        published,
        'Corregir otro intento sin publicar conserva juego histórico 12',
      );
      equal(
        (await sync(a)).revision,
        fingerprint,
        'Corrección del otro intento no cambia la huella estudiantil',
      );
      await as('teacher');
      equal(
        (await command('ranking', a.id)).individual[0].points,
        16,
        'Docente ve el nuevo mejor juego 16',
      );
      await command(
        'publishGrade',
        a.id,
        users.E4,
        '',
        'Republicación con correcciones de los intentos.',
      );
      await as('E4');
      equal(
        (await command('ranking', a.id)).individual[0].points,
        16,
        'Republicar permite el mejor juego revisado 16 sin sustituirlo por la nota',
      );
    },
  );

  await scenario(
    'AP-18',
    'Tres participantes con puntos 10, 10, 8; actividad cerrada; segunda clasificación con revisión pendiente.',
    async () => {
      const q = openQuestion(10);
      const run = await guided('AP-18 empate', [q], ['E1', 'E2', 'E3']);
      await answerGroup(run, q, ['E1', 'E2', 'E3']);
      await finishQuestion(run);
      for (const [name, points] of [
        ['E1', 10],
        ['E2', 10],
        ['E3', 8],
      ])
        await command('reviewAnswer', run.attempts[name].id, q.id, points, 'Corrección ficticia.');
      const rank = await command('ranking', run.activity.id);
      equal(
        rank.individual.map((r) => [r.points, r.rank]),
        [
          [10, 1],
          [10, 1],
          [8, 3],
        ],
        '10, 10, 8 producen puestos 1, 1, 3',
      );
      equal(rank.provisional, false, 'Clasificación cerrada y corregida es definitiva');
      const pendingQ = openQuestion(10);
      const pendingRun = await guided('AP-18 pendiente', [pendingQ], ['E1', 'E2']);
      await answerGroup(pendingRun, pendingQ, ['E1', 'E2']);
      await finishQuestion(pendingRun);
      await command(
        'reviewAnswer',
        pendingRun.attempts.E1.id,
        pendingQ.id,
        10,
        'Corrección ficticia.',
      );
      equal(
        (await command('ranking', pendingRun.activity.id)).provisional,
        true,
        'Manual pendiente mantiene clasificación provisional después del cierre',
      );
      await command(
        'reviewAnswer',
        pendingRun.attempts.E2.id,
        pendingQ.id,
        8,
        'Corrección ficticia.',
      );
      equal(
        (await command('ranking', pendingRun.activity.id)).provisional,
        false,
        'Resolver la última corrección retira el estado provisional',
      );
    },
  );

  let teamRun;
  await scenario(
    'AP-19',
    'Equipo de dos: 10+6; equipo de tres: 12+12+0, E5 no inicia. Promedios esperados 8 y 8.',
    async () => {
      const q = openQuestion(12);
      const a = await activity('AP-19 equipos', [q], { pace: 'guided', teams: true });
      const teams = [
        { name: 'Dos integrantes', studentIds: [users.E1, users.E2] },
        { name: 'Tres integrantes', studentIds: [users.E3, users.E4, users.E5] },
      ];
      await command('configureTeams', a.id, teams);
      const names = ['E1', 'E2', 'E3', 'E4'];
      for (const name of names) {
        await as(name);
        await command('joinGuidedRoom', a.id);
      }
      await as('teacher');
      await command('startGuidedSession', a.id);
      const attempts = {};
      for (const name of names) {
        await as(name);
        attempts[name] = await command('startAttempt', a.id);
      }
      teamRun = { activity: a, attempts, teams };
      await answerGroup(teamRun, q, names);
      await finishQuestion(teamRun);
      for (const [name, points] of [
        ['E1', 10],
        ['E2', 6],
        ['E3', 12],
        ['E4', 12],
      ])
        await command('reviewAnswer', attempts[name].id, q.id, points, 'Corrección ficticia.');
      const rank = await command('ranking', a.id);
      equal(
        rank.teams.map((t) => [t.name, t.points, t.rank]),
        [
          ['Dos integrantes', 8, 1],
          ['Tres integrantes', 8, 1],
        ],
        'Promedios 8/8 empatan pese a tamaños 2/3',
      );
      equal(
        rank.individual.find((r) => r.studentId === users.E5).points,
        0,
        'E5 aporta cero a clasificación',
      );
      equal(rank.provisional, false, 'Ausencia de intento no crea corrección pendiente');
      const teacher = await scoped(a);
      equal(teacher.state.attempts.length, 4, 'Solo existen los cuatro intentos iniciados');
      equal(
        teacher.state.evaluations.filter((e) => e.studentId === users.E5).length,
        0,
        'No se publica nota cero para E5',
      );
      await as('E5');
      const student = await snapshot();
      const result = student.studentResults[subject.id].find((x) => x.activityId === a.id);
      equal(
        [result.grade, result.status],
        [null, 'not-started'],
        'E5 sigue sin iniciar y sin nota personal',
      );
      equal(
        student.state.attempts.some((t) => t.activityId === a.id),
        false,
        'E5 no recibe intento ficticio',
      );
    },
  );

  await scenario(
    'AP-20',
    'Equipos iniciados; docente propietario, E1, estudiante ajeno, docente ajeno y rol anónimo.',
    async () => {
      assert.ok(teamRun, 'El fixture de equipos no se creó');
      const a = teamRun.activity;
      await as('teacher');
      await reject(
        () => command('configureTeams', a.id, [{ name: 'Cambio', studentIds: [users.E1] }]),
        /TEAMS_LOCKED/,
        'Rechaza cambiar lista congelada',
      );
      await reject(
        () => command('autoTeams', a.id, 2),
        /TEAMS_LOCKED/,
        'Rechaza volver a repartir equipos después del inicio',
      );
      const teacher = await scoped(a);
      equal(
        teacher.teams.map((t) => t.studentIds.length).sort(),
        [2, 3],
        'Rechazos conservan listas originales',
      );
      const owner = await command('ranking', a.id);
      equal(
        owner.individual.map((r) => r.studentId).sort(),
        ['E1', 'E2', 'E3', 'E4', 'E5'].map((name) => users[name]).sort(),
        'Docente relaciona cada alias con la cuenta',
      );
      equal(
        owner.individual.every((r) => teacher.state.users.some((u) => u.id === r.studentId)),
        true,
        'Proyección docente identifica a sus integrantes',
      );
      await as('E1');
      const student = await command('ranking', a.id);
      equal(
        student.individual.map((r) => [r.alias, r.team, r.points, r.rank]),
        owner.individual.map((r) => [r.alias, r.team, r.points, r.rank]),
        'Estudiante recibe mismos alias estables, equipos y puntos permitidos',
      );
      equal(
        student.individual.every(
          (r) => Object.keys(r).sort().join(',') === 'alias,points,rank,team',
        ),
        true,
        'Clasificación estudiantil contiene solo alias, equipo, puntos y puesto',
      );
      equal(
        Object.values(users).some((userId) => JSON.stringify(student).includes(userId)),
        false,
        'Clasificación estudiantil sin UUID de cuentas',
      );
      equal(JSON.stringify(student).includes('@'), false, 'Clasificación estudiantil sin correos');
      equal(
        (await command('ranking', a.id)).individual.map((r) => r.alias),
        student.individual.map((r) => r.alias),
        'Nueva consulta conserva alias',
      );
      for (const name of ['outsider', 'otherTeacher']) {
        await as(name);
        await reject(
          () => command('ranking', a.id),
          /FORBIDDEN|MEMBERSHIP_REQUIRED/,
          `${name} no accede a clasificación ajena`,
        );
      }
      await db.exec('set role anon');
      try {
        await reject(
          () => command('ranking', a.id),
          /permission denied/,
          'Rol anónimo no ejecuta el contrato',
        );
      } finally {
        await db.exec('set role authenticated');
      }
    },
  );
  report.status = report.cases.every((c) => c.status === 'passed') ? 'passed' : 'failed';
} catch (error) {
  report.status = 'failed';
  report.failure = String(error.message).slice(0, 600);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await db.close();
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: report.status,
      cases: report.cases.length,
      checks: report.cases.reduce((sum, c) => sum + c.checks.length, 0),
      report: reportPath,
    }),
  );
}
