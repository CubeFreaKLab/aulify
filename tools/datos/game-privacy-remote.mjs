import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID as id } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';

// Sin --run solo valida archivos locales. No crea clientes ni inicia sesiones.
const run = process.argv.includes('--run');
const accountPath = '.local-private/remote-test-accounts.json';
const scriptPath = 'tools/datos/game-privacy-remote.mjs';
const migrationIndex = process.argv.indexOf('--migration');
const migrationName = migrationIndex < 0
  ? '20260929221908_aulify_deferred_ranking_publication.sql'
  : process.argv[migrationIndex + 1];
if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(migrationName ?? ''))
  throw new Error('--migration requiere el nombre de una migración SQL local.');
const migrationPath = `supabase/migrations/${migrationName}`;
const reportIndex = process.argv.indexOf('--report');
const reportPath =
  reportIndex < 0
    ? 'docs/verificacion/juego-privacidad-remota.json'
    : process.argv[reportIndex + 1];
const roles = {
  teacher: 'teacher',
  teacherOther: 'teacher',
  student: 'student',
  studentOther: 'student',
};
const learners = ['student', 'studentOther'];
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function preflight() {
  const accounts = JSON.parse(await fs.readFile(accountPath, 'utf8'));
  const env = Object.fromEntries(
    (await fs.readFile('.env.local', 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')];
      }),
  );
  if (
    accounts.projectRef !== 'bnqyyumfmyexsqszglab' ||
    env.NEXT_PUBLIC_SUPABASE_URL !== `https://${accounts.projectRef}.supabase.co` ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new Error('El entorno y las cuentas no identifican el mismo proyecto de prueba.');
  for (const role of Object.keys(roles)) {
    const account = accounts.users?.[role];
    if (!account?.id || !account.email || !account.password)
      throw new Error(`Falta una cuenta ficticia completa para ${role}.`);
  }
  if (new Set(Object.keys(roles).map((role) => accounts.users[role].id)).size !== 4)
    throw new Error(
      'Se requieren cuatro cuentas diferentes; no se reutilizan identidades entre roles.',
    );
  await fs.access(migrationPath);
  return { accounts, env };
}

async function execute({ accounts, env }) {
  const report = {
    startedAt: new Date().toISOString(),
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: 'Supabase remoto, JWT de cuatro cuentas ficticias existentes y cliente anónimo',
    script: { path: scriptPath, sha256: hash(await fs.readFile(scriptPath)) },
    expectedMigration: { path: migrationPath, sha256: hash(await fs.readFile(migrationPath)) },
    fixture:
      'AP-16: dos estudiantes, una actividad guiada, automática 8 y manual 2, un equipo de dos.',
    checks: [],
    rpcCalls: 0,
    limitations: [
      'No aplica migraciones ni consulta su historial remoto; comprobar aplicación antes de ejecutar.',
      'No mide capacidad, SMTP, interfaz, accesibilidad ni concurrencia.',
      'Compara snapshots excluyendo solo state.revision, que representa la hora de lectura; compara aparte aulify_sync.revision.',
      'Los archivos privados, credenciales, JWT e identidades no se incluyen en este informe.',
    ],
  };
  const clients = {};
  const authenticated = [];
  let subject;
  const users = accounts.users;
  const safeError = (error) => (error instanceof Error ? error.message : 'Fallo no identificado.');
  const equal = (actual, expected, detail) => {
    if (!isDeepStrictEqual(actual, expected)) throw new Error(`ASSERT: ${detail}`);
    report.checks.push({ detail, result: 'passed' });
    console.log(`PASS ${detail}`);
  };
  const rpc = async (role, name, args) => {
    report.rpcCalls += 1;
    const { data, error } = await clients[role].rpc(name, args);
    if (error || data?.error) {
      const failure = error ?? data.error;
      const marker = String(failure.message ?? '').match(/^[A-Z][A-Z_0-9]+(?=:|$)/)?.[0];
      const code = String(failure.code ?? 'UNKNOWN');
      const sanitized = new Error(`RPC ${name}: ${marker ?? code}`);
      sanitized.code = code;
      sanitized.domainCode = marker;
      throw sanitized;
    }
    return data;
  };
  const command = (role, action, ...args) =>
    rpc(role, 'aulify_command', { p_action: action, p_payload: { args } });
  const scoped = (role, activity) =>
    rpc(role, 'aulify_activity_snapshot', { p_activity_id: activity.id });
  const sync = (role, activity) => rpc(role, 'aulify_sync', { p_activity_id: activity.id });
  const content = (snapshot) => {
    const result = structuredClone(snapshot);
    delete result.state.revision;
    return result;
  };
  const reject = async (fn, expectedCodes, detail) => {
    let failure;
    try {
      await fn();
    } catch (error) {
      failure = error;
    }
    if (
      !failure ||
      !expectedCodes.some((code) => code === failure.code || code === failure.domainCode)
    )
      throw new Error(`ASSERT: ${detail}`);
    report.checks.push({
      detail,
      result: 'rejected-as-expected',
      code: failure.domainCode ?? failure.code,
    });
    console.log(`PASS ${detail}`);
  };

  try {
    for (const role of [...Object.keys(roles), 'anonymous']) {
      clients[role] = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
      );
      if (role === 'anonymous') continue;
      const { data, error } = await clients[role].auth.signInWithPassword({
        email: users[role].email,
        password: users[role].password,
      });
      if (error) throw new Error(`Auth ${role}: HTTP ${error.status ?? 'desconocido'}`);
      authenticated.push(role);
      equal(data.user?.id, users[role].id, `JWT de ${role} corresponde a la cuenta preparada`);
      const initial = await rpc(role, 'aulify_snapshot');
      equal(
        initial.state.users.find((user) => user.id === initial.userId)?.role,
        roles[role],
        `El perfil persistido de ${role} coincide con su función`,
      );
    }
    subject = await command('teacher', 'createSubject', {
      name: 'Aceptación remota de publicación',
      course: '3.º A',
      year: 2026,
      description: 'Actividad con cuentas ficticias para comprobar privacidad de correcciones.',
    });
    const code = (await rpc('teacher', 'aulify_snapshot')).state.subjects.find(
      (item) => item.id === subject.id,
    ).code;
    for (const role of learners) {
      const request = await command(role, 'requestMembership', code);
      await command('teacher', 'decideMembership', request.id, 'approved');
    }
    const questions = [
      {
        id: id(),
        type: 'true-false',
        prompt: 'Afirmación ficticia.',
        points: 8,
        correct: true,
        explanation: 'Explicación automática reservada.',
      },
      {
        id: id(),
        type: 'open',
        prompt: 'Explicación ficticia.',
        points: 2,
        manual: true,
        manualGuide: 'Guía privada para valorar la respuesta.',
        explanation: 'Explicación manual reservada.',
      },
    ];
    const resource = {
      id: id(),
      ownerId: users.teacher.id,
      title: 'AP-16 publicación y revisión privada',
      kind: 'quiz',
      revision: 1,
      updatedAt: new Date().toISOString(),
      blocks: [{ id: id(), type: 'quiz', questions }],
    };
    await command('teacher', 'saveDraft', resource, 0);
    const version = await command('teacher', 'publishResource', resource.id);
    const settings = {
      purpose: 'practice',
      pace: 'guided',
      maxGrade: 20,
      weight: 1,
      countsTowardAverage: true,
      maxAttempts: 1,
      opensAt: new Date(Date.now() - 60_000).toISOString(),
      closesAt: new Date(Date.now() + 900_000).toISOString(),
      timeLimitMinutes: null,
      timeZone: 'America/La_Paz',
      feedback: 'after-close',
      manualCorrection: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      streaks: false,
      sound: false,
      ranking: true,
      teams: true,
      allowHint: false,
      allowDouble: false,
      bonusAffectsGrade: false,
      reportVisibility: false,
    };
    const activity = await command(
      'teacher',
      'createActivity',
      version.id,
      subject.id,
      settings,
      resource.title,
    );
    await command('teacher', 'configureTeams', activity.id, [
      { name: 'Equipo de prueba', studentIds: learners.map((role) => users[role].id) },
    ]);
    await reject(
      () => command('teacherOther', 'ranking', activity.id),
      ['MEMBERSHIP_REQUIRED', 'FORBIDDEN', '42501'],
      'Docente ajeno no consulta clasificación',
    );
    await reject(
      () => command('anonymous', 'ranking', activity.id),
      ['42501', 'PGRST202'],
      'Cliente anónimo no ejecuta el contrato de clasificación',
    );
    for (const role of learners) await command(role, 'joinGuidedRoom', activity.id);
    await command('teacher', 'startGuidedSession', activity.id);
    const attempts = {};
    for (const role of learners) attempts[role] = await command(role, 'startAttempt', activity.id);
    for (const role of learners) {
      const ack = await command(
        role,
        'submitAnswer',
        attempts[role].id,
        questions[0].id,
        { type: 'true-false', value: true },
        id(),
        false,
      );
      equal(
        ack.feedback,
        null,
        `${role}: respuesta automática diferida no revela retroalimentación`,
      );
    }
    await command('teacher', 'closeGuidedQuestion', activity.id, false);
    await command('teacher', 'openNextGuidedQuestion', activity.id);
    for (const role of learners)
      await command(
        role,
        'submitAnswer',
        attempts[role].id,
        questions[1].id,
        { type: 'open', text: 'Respuesta ficticia para corregir.' },
        id(),
        false,
      );
    const closed = await command('teacher', 'closeGuidedQuestion', activity.id, false);
    equal(
      closed.guided.status,
      'closed',
      'La sesión finaliza normalmente al cerrar la última pregunta',
    );
    equal(
      (await command('student', 'ranking', activity.id)).available,
      false,
      'Cerrar sin publicar conserva clasificación reservada',
    );
    for (const role of learners)
      await command(
        'teacher',
        'reviewAnswer',
        attempts[role].id,
        questions[1].id,
        2,
        'Corrección ficticia.',
      );
    await command('teacher', 'publishGrade', activity.id, users.student.id);
    equal(
      (await command('student', 'ranking', activity.id)).available,
      false,
      'Una publicación pendiente impide liberar la clasificación',
    );
    await command('teacher', 'publishGrade', activity.id, users.studentOther.id);
    const before = {};
    for (const role of learners) {
      before[role] = {
        ranking: await command(role, 'ranking', activity.id),
        snapshot: await scoped(role, activity),
        sync: await sync(role, activity),
      };
      equal(
        [
          before[role].ranking.available,
          before[role].ranking.provisional,
          before[role].ranking.individual.map((row) => row.points),
        ],
        [true, false, [10, 10]],
        `${role}: ambas publicaciones liberan 10/10 definitivo`,
      );
      equal(
        before[role].ranking.teams.map((team) => team.points),
        [10],
        `${role}: equipo publicado con promedio 10`,
      );
      equal(
        before[role].ranking.individual.every(
          (row) => Object.keys(row).sort().join(',') === 'alias,points,rank,team',
        ),
        true,
        `${role}: clasificación con alias, sin identidad de compañeros`,
      );
    }
    await command(
      'teacher',
      'reviewAnswer',
      attempts.studentOther.id,
      questions[1].id,
      0,
      'Revisión privada ficticia.',
      'Ajuste de comprobación antes de republicar.',
    );
    for (const role of learners) {
      equal(
        await command(role, 'ranking', activity.id),
        before[role].ranking,
        `${role}: revisión privada conserva exactamente clasificación y equipos publicados`,
      );
      equal(
        content(await scoped(role, activity)),
        content(before[role].snapshot),
        `${role}: revisión privada conserva contenido de la proyección`,
      );
      equal(
        (await sync(role, activity)).revision,
        before[role].sync.revision,
        `${role}: revisión privada no cambia huella de sincronización`,
      );
    }
    const owner = await command('teacher', 'ranking', activity.id);
    equal(
      owner.individual.map((row) => row.points),
      [10, 8],
      'Docente consulta los nuevos puntos 10/8 todavía privados',
    );
    equal(
      owner.individual.map((row) => row.studentId).sort(),
      learners.map((role) => users[role].id).sort(),
      'Docente identifica las cuentas de su clasificación',
    );
    const publication = await command(
      'teacher',
      'publishGrade',
      activity.id,
      users.studentOther.id,
      '',
      'Republicación explícita de la revisión ficticia.',
    );
    equal(publication.grade, 16, 'La republicación cambia la nota individual a 16/20');
    for (const role of learners) {
      const updated = await command(role, 'ranking', activity.id);
      equal(
        [
          updated.available,
          updated.provisional,
          updated.individual.map((row) => row.points),
          updated.teams.map((team) => team.points),
        ],
        [true, false, [10, 8], [9]],
        `${role}: republicación libera 10/8 y promedio de equipo 9`,
      );
    }
    equal(
      (await sync('studentOther', activity)).revision !== before.studentOther.sync.revision,
      true,
      'Republicar cambia la huella del estudiante evaluado',
    );
    report.observation = {
      publishedPoints: [10, 10],
      afterPrivateReview: [10, 10],
      teacherAfterPrivateReview: [10, 8],
      republishedPoints: [10, 8],
      republishedTeamAverage: 9,
    };
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.failure = safeError(error).slice(0, 240);
    process.exitCode = 1;
    console.error(report.failure);
  } finally {
    if (subject) {
      try {
        await command('teacher', 'archiveSubject', subject.id);
        report.cleanup = 'Materia ficticia archivada; biblioteca ficticia conservada.';
      } catch {
        report.cleanup = 'No se pudo archivar la materia ficticia; requiere revisión.';
        report.status = 'failed';
        process.exitCode = 1;
      }
    }
    for (const role of authenticated) {
      try {
        await clients[role].auth.signOut({ scope: 'local' });
      } catch {
        report.sessionCleanupWarning = 'No se confirmó el cierre de una sesión local del ensayo.';
      }
    }
    report.completedAt = new Date().toISOString();
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(
      JSON.stringify({
        status: report.status,
        checks: report.checks.length,
        rpcCalls: report.rpcCalls,
        report: reportPath,
      }),
    );
  }
}

try {
  const prepared = await preflight();
  if (run) await execute(prepared);
  else
    console.log(
      JSON.stringify({
        status: 'prepared-only',
        accounts: Object.keys(roles),
        remoteRequests: 0,
        instruction:
          'Aplicar y verificar la migración esperada, coordinar una ventana sin carga y ejecutar con --run.',
      }),
    );
} catch {
  console.error(
    'No se completó la preparación local: revisa las cuentas ficticias, el entorno y la migración esperada.',
  );
  process.exitCode = 1;
}
