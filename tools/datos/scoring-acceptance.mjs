import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID as id } from 'node:crypto';

const remote = process.argv.includes('--remote');
const report = {
  startedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  environment: remote
    ? 'Supabase remoto, RPC con JWT de dos cuentas ficticias'
    : 'PGlite aislado con Auth y Storage mínimos',
  checks: [],
};
let db, clients, users, command, snapshot, current;
const as = async (name) => {
  current = name;
  if (db) await db.query("select set_config('request.jwt.claim.sub',$1,false)", [users[name].id]);
};
const check = (condition, scenario, detail) => {
  if (!condition) throw new Error(`ASSERT ${scenario}: ${detail}`);
  report.checks.push({ scenario, detail, result: 'passed' });
  console.log(`PASS ${scenario}: ${detail}`);
};
async function reject(fn, expected, scenario, detail) {
  let rejected = false;
  try {
    await fn();
  } catch (error) {
    rejected = String(error.message).includes(expected);
  }
  check(rejected, scenario, detail);
}
try {
  if (remote) {
    const { createClient } = await import('@supabase/supabase-js');
    const env = Object.fromEntries(
      (await fs.readFile('.env.local', 'utf8'))
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')];
        }),
    );
    const accounts = JSON.parse(
      await fs.readFile('.local-private/remote-test-accounts.json', 'utf8'),
    );
    if (
      accounts.projectRef !== 'bnqyyumfmyexsqszglab' ||
      env.NEXT_PUBLIC_SUPABASE_URL !== 'https://bnqyyumfmyexsqszglab.supabase.co'
    )
      throw new Error('Proyecto de prueba inesperado.');
    users = accounts.users;
    clients = {};
    for (const role of ['teacher', 'student']) {
      clients[role] = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
      );
      const { error } = await clients[role].auth.signInWithPassword({
        email: users[role].email,
        password: users[role].password,
      });
      if (error) throw new Error(`Auth ${error.status ?? ''}`);
    }
    const rpc = async (name, args) => {
      const { data, error } = await clients[current].rpc(name, args);
      if (error || data?.error) throw new Error((error || data.error).message);
      return data;
    };
    command = (action, ...args) => rpc('aulify_command', { p_action: action, p_payload: { args } });
    snapshot = () => rpc('aulify_snapshot');
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
      alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
    report.migrations = (await fs.readdir('supabase/migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const name of report.migrations)
      await db.exec(await fs.readFile(`supabase/migrations/${name}`, 'utf8'));
    users = { teacher: { id: id() }, student: { id: id() } };
    for (const [role, user] of Object.entries(users))
      await db.query('insert into auth.users values($1,$2,now(),$3)', [
        user.id,
        `${role}@example.test`,
        { name: role, role },
      ]);
    await db.exec('set role authenticated');
    command = async (action, ...args) =>
      (await db.query('select public.aulify_command($1,$2) result', [action, { args }])).rows[0]
        .result;
    snapshot = async () =>
      (await db.query('select public.aulify_snapshot() result')).rows[0].result;
  }
  await as('teacher');
  const subject = await command('createSubject', {
    name: 'Aceptación de puntuaciones · prueba',
    course: '3.º A',
    year: 2026,
    description: 'Datos ficticios para reglas de calificación.',
  });
  const code = (await snapshot()).state.subjects.find((x) => x.id === subject.id).code;
  await as('student');
  const membership = await command('requestMembership', code);
  await as('teacher');
  await command('decideMembership', membership.id, 'approved');
  const options = (count) =>
    Array.from({ length: count }, (_, i) => ({ id: id(), text: `Opción ${i + 1}` }));
  const baseSettings = {
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
    allowDouble: true,
    bonusAffectsGrade: false,
    reportVisibility: false,
  };
  async function run(title, questions, answers, settings = {}, doubleIndex = -1) {
    await as('teacher');
    const resource = {
      id: id(),
      ownerId: users.teacher.id,
      title,
      kind: 'quiz',
      blocks: [{ id: id(), type: 'quiz', questions }],
      revision: 1,
      updatedAt: new Date().toISOString(),
    };
    await command('saveDraft', resource, 0);
    const version = await command('publishResource', resource.id);
    const activity = await command(
      'createActivity',
      version.id,
      subject.id,
      { ...baseSettings, ...settings },
      title,
    );
    await as('student');
    const attempt = await command('startAttempt', activity.id);
    for (let i = 0; i < questions.length; i++)
      await command(
        'submitAnswer',
        attempt.id,
        questions[i].id,
        answers[i],
        id(),
        i === doubleIndex,
      );
    await as('teacher');
    return { activity, attempt, questions };
  }
  async function points(run, index = 0) {
    const attempt = await command('readAttempt', run.attempt.id);
    const review = attempt.answers
      .find((a) => a.questionId === run.questions[index].id)
      ?.reviews.at(-1);
    return review ? review.points.numerator / review.points.denominator : null;
  }
  const game = async (run) =>
    (await command('ranking', run.activity.id)).individual.find(
      (x) => x.studentId === users.student.id,
    ).points;
  const grade = async (run) =>
    (await command('publishGrade', run.activity.id, users.student.id)).grade;
  const multipleOptions = options(3);
  for (const [indices, expected, label] of [
    [[0, 1], 4, 'conjunto exacto'],
    [[0], 0, 'correcta omitida'],
    [[0, 1, 2], 0, 'incorrecta añadida'],
  ]) {
    const q = {
      id: id(),
      type: 'multiple',
      prompt: 'Selecciona dos opciones.',
      points: 4,
      options: multipleOptions,
      correctOptionIds: multipleOptions.slice(0, 2).map((x) => x.id),
    };
    const runResult = await run(
      'AP-03',
      [q],
      [{ type: 'multiple', optionIds: indices.map((i) => multipleOptions[i].id) }],
    );
    check((await points(runResult)) === expected, 'AP-03', `${label} → ${expected}`);
  }
  const left = options(4),
    right = options(4),
    pairs = Object.fromEntries(left.map((x, i) => [x.id, right[i].id]));
  const matching = await run(
    'AP-04',
    [{ id: id(), type: 'matching', prompt: 'Relaciona elementos.', points: 8, left, right, pairs }],
    [{ type: 'matching', pairs: { ...pairs, [left[3].id]: right[0].id } }],
  );
  check((await points(matching)) === 6, 'AP-04', 'tres pares de cuatro, valor 8 → 6');
  const items = options(4);
  const ordering = await run(
    'AP-05',
    [
      {
        id: id(),
        type: 'ordering',
        prompt: 'Ordena elementos.',
        points: 5,
        items,
        correctOrder: items.map((x) => x.id),
      },
    ],
    [{ type: 'ordering', itemIds: [items[0].id, items[1].id, items[3].id, items[2].id] }],
  );
  check((await points(ordering)) === 2.5, 'AP-05', 'dos posiciones de cuatro, valor 5 → 2,5');
  const blanks = Array.from({ length: 3 }, () => {
    const o = options(2);
    return { id: id(), options: o, correctOptionId: o[0].id };
  });
  const template = blanks.map((b) => `{${b.id}}`).join(' ');
  const filling = await run(
    'AP-06 opciones',
    [
      {
        id: id(),
        type: 'fill-options',
        prompt: 'Completa tres espacios.',
        points: 6,
        template,
        blanks,
      },
    ],
    [
      {
        type: 'fill-options',
        choices: Object.fromEntries(blanks.map((b, i) => [b.id, b.options[i === 2 ? 1 : 0].id])),
      },
    ],
  );
  check((await points(filling)) === 4, 'AP-06', 'dos espacios correctos de tres, valor 6 → 4');
  const written = await run(
    'AP-06 escritura',
    [
      {
        id: id(),
        type: 'fill-text',
        prompt: 'Escribe las mismas palabras.',
        points: 6,
        template,
        blanks: blanks.map((b) => ({ id: b.id, label: 'concepto' })),
        manual: true,
        manualGuide: 'Valorar la explicación según la consigna.',
      },
    ],
    [
      {
        type: 'fill-text',
        texts: Object.fromEntries(blanks.map((b, i) => [b.id, b.options[i === 2 ? 1 : 0].text])),
      },
    ],
  );
  check((await points(written)) === null, 'AP-06', 'mismas palabras escritas → pendiente manual');
  await reject(
    () => grade(written),
    'REVIEW_PENDING',
    'AP-06',
    'pendiente manual impide publicar nota completa',
  );
  const closedManual = await run(
    'AP-07',
    [{ id: id(), type: 'true-false', prompt: 'Afirmación.', points: 5, correct: true }],
    [{ type: 'true-false', value: true }],
    { manualCorrection: true },
  );
  check(
    (await points(closedManual)) === null,
    'AP-07',
    'cerrada con corrección manual permanece pendiente',
  );
  await reject(
    () => command('reviewAnswer', closedManual.attempt.id, closedManual.questions[0].id, 6, ''),
    'GRADE_RANGE',
    'AP-07',
    'valor 6 fuera de [0,5] rechazado',
  );
  check((await points(closedManual)) === null, 'AP-07', 'rechazo conserva el estado pendiente');
  await command(
    'reviewAnswer',
    closedManual.attempt.id,
    closedManual.questions[0].id,
    3,
    'Corrección de prueba',
  );
  await reject(
    () =>
      command(
        'reviewAnswer',
        closedManual.attempt.id,
        closedManual.questions[0].id,
        -1,
        '',
        'Revisión de prueba',
      ),
    'GRADE_RANGE',
    'AP-07',
    'valor negativo rechazado después de revisión',
  );
  check((await points(closedManual)) === 3, 'AP-07', 'rechazo conserva revisión previa de 3');
  for (const correct of [true, false]) {
    const result = await run(
      'AP-13 doble',
      [{ id: id(), type: 'true-false', prompt: 'Afirmación.', points: 2, correct: true }],
      [{ type: 'true-false', value: correct }],
      {},
      0,
    );
    check(
      (await game(result)) - (await points(result)) === (correct ? 2 : 0),
      'AP-13',
      `adicional de doble ${correct ? 'correcto → 2' : 'erróneo → 0'}`,
    );
  }
  const manualDouble = await run(
    'AP-13 manual',
    [
      {
        id: id(),
        type: 'open',
        prompt: 'Explica.',
        points: 5,
        manual: true,
        manualGuide: 'Valorar la explicación según la consigna.',
      },
    ],
    [{ type: 'open', text: 'Explicación de prueba.' }],
    {},
    0,
  );
  check(
    (await points(manualDouble)) === null && (await game(manualDouble)) === 0,
    'AP-13',
    'manual pendiente no asigna adicional anticipado',
  );
  await command(
    'reviewAnswer',
    manualDouble.attempt.id,
    manualDouble.questions[0].id,
    3,
    'Corrección de prueba',
  );
  check(
    (await game(manualDouble)) - (await points(manualDouble)) === 3,
    'AP-13',
    'manual corregida con 3 → adicional 3',
  );
  for (const bonusAffectsGrade of [false, true]) {
    const qs = [
      { id: id(), type: 'true-false', prompt: 'Primera.', points: 2, correct: true },
      { id: id(), type: 'true-false', prompt: 'Segunda.', points: 3, correct: true },
      {
        id: id(),
        type: 'open',
        prompt: 'Explica.',
        points: 5,
        manual: true,
        manualGuide: 'Valorar la explicación según la consigna.',
      },
    ];
    const result = await run(
      'AP-14',
      qs,
      [
        { type: 'true-false', value: true },
        { type: 'true-false', value: false },
        { type: 'open', text: 'Explicación de prueba.' },
      ],
      { bonusAffectsGrade },
      0,
    );
    await command('reviewAnswer', result.attempt.id, qs[2].id, 4, 'Corrección de prueba');
    check(
      (await game(result)) === 8 && (await grade(result)) === (bonusAffectsGrade ? 16 : 12),
      'AP-14',
      `B=6 Q=10 D=2 M=20 → juego 8 y nota ${bonusAffectsGrade ? 16 : 12}`,
    );
  }
  const capped = await run(
    'AP-14 máximo',
    [{ id: id(), type: 'true-false', prompt: 'Afirmación.', points: 2, correct: true }],
    [{ type: 'true-false', value: true }],
    { bonusAffectsGrade: true },
    0,
  );
  check(
    (await game(capped)) === 4 && (await grade(capped)) === 20,
    'AP-14',
    'B+D mayor que Q no supera nota máxima 20',
  );
  await command('archiveSubject', subject.id);
  report.completedAt = new Date().toISOString();
  report.status = 'passed';
} catch (error) {
  report.completedAt = new Date().toISOString();
  report.status = 'failed';
  report.failure = String(error.message).slice(0, 240);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  if (db) await db.close();
  if (clients)
    for (const client of Object.values(clients)) await client.auth.signOut({ scope: 'local' });
  report.limitations = [
    remote
      ? 'No prueba interfaz, SMTP ni concurrencia.'
      : 'Auth y Storage simulados; no sustituye ensayo remoto.',
    'No constituye cobertura del resto de escenarios AC/AP.',
  ];
  await fs.writeFile(
    `docs/verificacion/puntuacion-${remote ? 'remota' : 'aislada'}.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      status: report.status,
      passed: report.checks.length,
      environment: report.environment,
    }),
  );
}
