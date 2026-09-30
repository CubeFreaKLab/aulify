import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// La base se fija explícitamente: otras candidatas locales no son el control.
const cutoff = '20260930000631';
const suffix = '_aulify_student_activity_projection.sql';
const reportArg = process.argv.indexOf('--report');
const reportPath = reportArg < 0 ? 'docs/verificacion/datos-proyeccion-actividad-estudiante-local.json' : process.argv[reportArg + 1];
const report = { startedAt: new Date().toISOString(), environment: 'PGlite en memoria; datos ficticios; sin red, credenciales ni DDL remoto.', baselineCutoff: cutoff, checks: [] };
const db = new PGlite();
const id = () => crypto.randomUUID();
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const admin = () => db.exec('reset role');
const actor = async (user, role = 'authenticated') => {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
};
const command = async (action, ...args) => (await rows('select public.aulify_command($1,$2) value', [action, { args }]))[0].value;
const check = (condition, name) => { assert.ok(condition, name); report.checks.push({ name, result: 'passed' }); };
const projection = value => { const copy = structuredClone(value); if (copy?.state) delete copy.state.revision; return copy; };

try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
    alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
  const files = (await fs.readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
  const baseline = files.filter(name => name.slice(0, 14) <= cutoff);
  const candidates = files.filter(name => name.endsWith(suffix));
  assert.equal(baseline.length, 18, 'El control debe contener exactamente las 18 migraciones históricas.');
  assert.equal(candidates.length, 1, 'Debe existir una sola candidata con el sufijo estable.');
  report.baselineMigrations = baseline;
  report.excludedMigrations = files.filter(name => !baseline.includes(name) && !candidates.includes(name));
  report.migration = candidates[0];
  for (const name of baseline) await db.exec(await fs.readFile(`supabase/migrations/${name}`, 'utf8'));
  const beforeSql = (await rows("select pg_get_functiondef('app.student_activity(uuid)'::regprocedure) value"))[0].value;
  const catalogSql = `select p.oid, p.prosecdef, p.provolatile, p.proconfig, p.proacl::text,
    has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,
    has_function_privilege('anon',p.oid,'EXECUTE') anon
    from pg_proc p where p.oid='app.student_activity(uuid)'::regprocedure`;
  const catalogBefore = await rows(catalogSql);
  const candidateSql = await fs.readFile(`supabase/migrations/${report.migration}`, 'utf8');
  report.migrationSha256 = crypto.createHash('sha256').update(candidateSql).digest('hex');
  await db.exec(candidateSql);
  assert.deepEqual(await rows(catalogSql), catalogBefore);
  check(catalogBefore[0].prosecdef && catalogBefore[0].provolatile === 'v' && catalogBefore[0].proconfig.includes('search_path=""') && !catalogBefore[0].authenticated && !catalogBefore[0].anon, 'OID, ACL, volatilidad, SECURITY DEFINER y search_path privado conservados');

  const users = Object.fromEntries(['teacher', 'otherTeacher', 'a', 'b', 'outside', 'unconfirmed'].map(name => [name, id()]));
  for (const [name, uuid] of Object.entries(users)) await db.query('insert into auth.users values($1,$2,case when $3 then now() else null end,$4)', [uuid, `${name}@example.test`, name !== 'unconfirmed', { name, role: name.toLowerCase().includes('teacher') ? 'teacher' : 'student' }]);
  await actor(users.teacher);
  const subject = await command('createSubject', { name: 'Proyección estudiantil aislada', course: '3.º', year: 2026, description: 'Datos ficticios' });
  await admin();
  for (const name of ['a', 'b', 'unconfirmed']) await db.query("insert into app.memberships(subject_id,student_id,status) values($1,$2,'approved')", [subject.id, users[name]]);
  const opts = () => [{ id: id(), text: 'Primera' }, { id: id(), text: 'Segunda' }, { id: id(), text: 'Tercera' }];
  const single = opts(), multiple = opts(), left = opts(), right = opts(), order = opts(), gap = opts(), blank = id(), textBlank = id(), questionGroup = id();
  const questions = [
    { id: id(), type: 'single', prompt: 'Selección simple', points: 2, options: single, correctOptionId: single[0].id },
    { id: id(), type: 'multiple', prompt: 'Selección múltiple', points: 3, options: multiple, correctOptionIds: multiple.slice(0, 2).map(x => x.id) },
    { id: id(), type: 'true-false', prompt: 'Verdadero o falso', points: 2, correct: true },
    { id: id(), type: 'matching', prompt: 'Relaciones', points: 2, left, right, pairs: Object.fromEntries(left.map((x, i) => [x.id, right[i].id])) },
    { id: id(), type: 'ordering', prompt: 'Secuencia', points: 2, items: order, correctOrder: order.map(x => x.id) },
    { id: id(), type: 'fill-options', prompt: 'Espacios con opciones', points: 2, template: `Es {${blank}}`, blanks: [{ id: blank, options: gap, correctOptionId: gap[0].id }] },
    { id: id(), type: 'fill-text', prompt: 'Espacios escritos', points: 2, template: `Es {${textBlank}}`, blanks: [{ id: textBlank, label: 'concepto' }], manual: true, manualGuide: 'RESERVADO_GUIA' },
    { id: id(), type: 'open', prompt: 'Explicación', points: 5, manual: true, manualGuide: 'RESERVADO_GUIA' },
  ].map(q => ({ ...q, groupId: questionGroup, hint: 'RESERVADO_PISTA', explanation: 'RESERVADO_EXPLICACION' }));
  const editorDocument = [{ id: id(), type: 'paragraph', props: { textAlignment: 'left' }, content: [{ type: 'text', text: 'Documento del editor', styles: { bold: true } }], children: [] }];
  const quizBlock = id();
  const draft = { id: id(), title: 'Ocho variantes de pregunta', kind: 'quiz', blocks: [{ id: quizBlock, type: 'quiz', questions }], editorDocument, revision: 1 };
  await actor(users.teacher);
  await command('saveDraft', draft, 0);
  const version = await command('publishResource', draft.id);
  const settings = { purpose: 'practice', pace: 'individual', maxGrade: 20, weight: 2, countsTowardAverage: true, maxAttempts: 3, opensAt: new Date(Date.now() - 60000).toISOString(), closesAt: new Date(Date.now() + 3600000).toISOString(), timeLimitMinutes: null, timeZone: 'America/La_Paz', feedback: 'hidden', manualCorrection: false, shuffleQuestions: false, shuffleOptions: true, streaks: false, sound: false, ranking: false, teams: false, allowHint: true, allowDouble: true, bonusAffectsGrade: true, reportVisibility: true };
  const activity = await command('createActivity', version.id, subject.id, settings, 'Actividad completa');
  const guided = await command('createActivity', version.id, subject.id, { ...settings, pace: 'guided', maxAttempts: 1 }, 'Actividad guiada');
  const readingDraft = { id: id(), title: 'Contenido sin preguntas', kind: 'resource', blocks: [{ id: id(), type: 'text', text: 'Lectura' }], revision: 1 };
  await command('saveDraft', readingDraft, 0);
  const emptyVersion = await command('publishResource', readingDraft.id);
  await admin();
  const readingId = id(), manualId = id();
  await db.query("insert into app.activities(id,subject_id,kind,version_id,title,timezone,counts_for_average,published_at) values($1,$2,'reading',$3,'Lectura','America/La_Paz',false,now())", [readingId, subject.id, emptyVersion.id]);
  await db.query("insert into app.activities(id,subject_id,kind,title,timezone,max_grade,weight,counts_for_average,published_at) values($1,$2,'manual','Manual','America/La_Paz',20,1,true,now())", [manualId, subject.id]);

  const start = async () => { await actor(users.a); const attempt = await command('startAttempt', activity.id); await admin(); return attempt; };
  const effects = async aid => (await rows(`select jsonb_build_object(
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',at.id,'number',at.attempt_no,'closedAt',at.closed_at,'reason',at.close_reason) order by at.id) from app.attempts at join app.participants p on p.id=at.participant_id where p.activity_id=$1),'[]'),
    'grades',coalesce((select jsonb_agg(jsonb_build_object('attempt',aq.attempt_id,'question',aq.question_key,'revision',g.revision_no,'num',g.points_num,'den',g.points_den,'method',g.method,'actor',g.actor_id,'comment',g.comment,'reason',g.reason,'engine',g.engine_version,'createdAt',g.created_at) order by aq.attempt_id,aq.position,g.revision_no) from app.question_grades g join app.attempt_questions aq on aq.id=g.attempt_question_id join app.attempts at on at.id=aq.attempt_id join app.participants p on p.id=at.participant_id where p.activity_id=$1),'[]'),
    'activityCounters',(select to_jsonb(v) from app.activity_sync_versions v where v.activity_id=$1),
    'participantCounters',coalesce((select jsonb_agg(to_jsonb(v) order by v.participant_id) from app.participant_sync_versions v join app.participants p on p.id=v.participant_id where p.activity_id=$1),'[]')
    ) value`, [aid]))[0].value;

  async function scenario(name, { aid = activity.id, user = users.a, mode = 'helper', role, setup, verify, errorCode } = {}) {
    report.currentCase = name;
    await admin();
    await db.exec('begin');
    try {
      if (setup) await setup();
      await admin();
      await db.exec('set constraints all immediate; savepoint comparison');
      const run = async legacy => {
        if (legacy) await db.exec(beforeSql);
        await db.exec('savepoint invocation');
        let outcome;
        try {
          if (mode === 'helper') {
            await admin();
            await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
          } else await actor(user, role);
          const query = mode === 'snapshot' ? 'select public.aulify_activity_snapshot($1) value' : mode === 'command' ? "select public.aulify_command('readActivity',jsonb_build_object('args',jsonb_build_array($1::uuid))) value" : 'select app.student_activity($1) value';
          outcome = { value: projection((await rows(query, [aid]))[0].value) };
        } catch (error) {
          outcome = { error: { code: error.code, message: error.message } };
          await db.exec('rollback to savepoint invocation');
        }
        await admin();
        return { ...outcome, effects: await effects(aid) };
      };
      const before = await run(true);
      await db.exec('rollback to savepoint comparison');
      const after = await run(false);
      assert.deepEqual(after, before, `${name}: payload/error y efectos equivalentes`);
      if (errorCode) assert.equal(after.error?.code, errorCode, name);
      else {
        assert.ok(!after.error, `${name}: ${JSON.stringify(after.error)}`);
        if (user !== users.teacher) assert.ok(!JSON.stringify(after.value).includes('RESERVADO_'), `${name}: sin contenido privado`);
      }
      if (verify) verify(after.value, after.effects);
      check(true, name);
    } finally { await db.exec('rollback'); await admin(); }
  }
  const allQuestions = value => {
    assert.equal(value.questions.length, 8);
    assert.deepEqual(value.questions.map(q => q.id), questions.map(q => q.id));
    assert.deepEqual(value.blocks[0].questions, value.questions);
    for (const key of ['correctOptionId', 'correctOptionIds', 'correctOrder', 'correct', 'manualGuide', 'explanation', 'hint', 'pairs']) assert.ok(!JSON.stringify(value.questions).includes(`"${key}":`), `No filtra ${key}`);
  };
  await scenario('Sin participante: ocho variantes y preguntas seguras', { verify: value => { allQuestions(value); assert.equal(value.attempt, null); assert.equal(value.attemptsRemaining, 3); assert.deepEqual(value.editorDocument, editorDocument); } });
  await scenario('Orden de opciones sin intento depende del estudiante B', { user: users.b, verify: allQuestions });
  await scenario('Snapshot público completo sin participante', { mode: 'snapshot' });
  await scenario('Comando público readActivity conserva el contrato', { mode: 'command' });
  await scenario('Participante sin intento', { setup: () => rows('select app.ensure_participant($1,(select id from app.memberships where subject_id=$2 and student_id=$3)) value', [activity.id, subject.id, users.a]), verify: value => assert.equal(value.attempt, null) });
  await scenario('Intento activo con opciones mezcladas y pregunta ordenada', { setup: start, verify: value => { allQuestions(value); assert.equal(value.attemptsRemaining, 2); assert.equal(value.attempt.status, 'in-progress'); } });
  await scenario('Orden explícito inverso de preguntas y opciones del intento', { setup: async () => {
    const attempt = await start();
    await db.query('update app.attempt_questions set position=position+100 where attempt_id=$1', [attempt.id]);
    await db.query('update app.attempt_questions set position=109-position where attempt_id=$1', [attempt.id]);
    await db.query("update app.attempt_questions aq set item_order=jsonb_build_object('items',(select jsonb_agg(i.item_key order by i.position desc) from app.question_items i where i.version_id=aq.version_id and i.question_key=aq.question_key)) where attempt_id=$1", [attempt.id]);
  }, verify: value => assert.deepEqual(value.questions.map(q => q.id), questions.map(q => q.id).reverse()) });
  await scenario('item_order sin items usa orden por estudiante', { setup: async () => { const attempt = await start(); await db.query("update app.attempt_questions set item_order='{}' where attempt_id=$1", [attempt.id]); } });
  await scenario('item_order con items vacío conserva arrays y orden legado', { setup: async () => { const attempt = await start(); await db.query('update app.attempt_questions set item_order=$2 where attempt_id=$1', [attempt.id, { items: [] }]); } });
  await scenario('Último intento de varios, respuesta y ambos potenciadores', { setup: async () => {
    const first = await start(); await db.query("select app.close_attempt($1,'deadline')", [first.id]);
    const second = await start(); await actor(users.a);
    await command('useHint', second.id, questions[0].id);
    await command('submitAnswer', second.id, questions[0].id, { type: 'single', optionId: single[0].id }, id(), true);
  }, verify: value => { assert.equal(value.attempt.number, 2); assert.equal(value.attempt.answers.length, 1); assert.equal(value.hintUsed, true); assert.equal(value.doubleUsed, true); assert.equal(value.attemptsRemaining, 1); } });
  await scenario('Intento cerrado y límite agotado no alteran proyección', { setup: async () => { const attempt = await start(); await db.query("select app.close_attempt($1,'deadline')", [attempt.id]); await db.query('update app.quiz_settings set attempt_limit=1 where activity_id=$1', [activity.id]); }, verify: value => { assert.equal(value.attempt.status, 'closed'); assert.equal(value.attemptsRemaining, 0); } });
  const expire = async () => { await start(); await db.query("update app.activities set opens_at=now()-interval '2 hours',closes_at=now()-interval '1 hour' where id=$1", [activity.id]); };
  await scenario('Plazo global cierra intento y genera ocho omisiones iguales', { setup: expire, verify: (value, state) => { assert.equal(value.attempt.closeReason, 'expired'); assert.equal(state.grades.length, 8); } });
  await scenario('Snapshot público al vencer conserva payload y efectos', { mode: 'snapshot', setup: expire });
  await scenario('Tiempo individual vencido cierra intento', { setup: async () => { const attempt = await start(); await db.query('update app.quiz_settings set duration_seconds=60 where activity_id=$1', [activity.id]); await db.query("update app.attempts set started_at=now()-interval '2 minutes' where id=$1", [attempt.id]); }, verify: value => assert.equal(value.attempt.closeReason, 'expired') });
  await scenario('Ampliación personal mantiene abierto el intento', { setup: async () => {
    const attempt = await start(); await db.query('update app.quiz_settings set duration_seconds=60 where activity_id=$1', [activity.id]); await db.query("update app.attempts set started_at=now()-interval '2 minutes' where id=$1", [attempt.id]);
    await db.query("insert into app.deadline_extensions(activity_id,participant_id,new_deadline,actor_id,reason) select $1,participant_id,now()+interval '20 minutes',$2,'Fixture' from app.attempts where id=$3", [activity.id, users.teacher, attempt.id]);
  }, verify: value => assert.equal(value.attempt.status, 'in-progress') });
  await scenario('Sala guiada sin intento', { aid: guided.id, setup: async () => { await actor(users.a); await command('joinGuidedRoom', guided.id); } });
  await scenario('Sala guiada iniciada con intento y pregunta abierta', { aid: guided.id, mode: 'snapshot', setup: async () => { await actor(users.a); await command('joinGuidedRoom', guided.id); await actor(users.teacher); await command('startGuidedSession', guided.id); } });

  const addBlock = (kind, body, position, extra = {}) => db.query('insert into app.content_blocks(version_id,block_key,position,kind,body,external_url,alt_text) values($1,$2,$3,$4,$5,$6,$7)', [version.id, id(), position, kind, body, extra.url ?? null, extra.alt ?? null]);
  await scenario('Varios bloques quiz, dos grupos y merges de propiedades', { setup: async () => {
    const group = id();
    await db.query('insert into app.question_groups(version_id,group_key,position) values($1,$2,2)', [version.id, group]);
    await db.query('update app.questions set group_key=$2,position=position-4 where version_id=$1 and position>4', [version.id, group]);
    await addBlock('quiz', { id: 'se-reemplaza', type: 'se-reemplaza', questions: [], caption: 'Segundo cuestionario', keepNull: null }, 10);
  }, verify: value => { assert.equal(value.blocks.length, 2); for (const block of value.blocks) assert.deepEqual(block.questions, value.questions); } });
  await scenario('Bloques heading/text/list/video/image y editorDocument conservados', { setup: async () => {
    await addBlock('heading', { text: 'Título', level: 2 }, 2);
    await addBlock('text', { text: 'Contenido', questions: null }, 3);
    await addBlock('list', { items: ['Uno', 'Dos'], ordered: true }, 4);
    await addBlock('video_link', { url: 'sobrescrito', caption: 'Vídeo' }, 5, { url: 'https://example.test/video' });
    await addBlock('image', { url: 'sobrescrito', alt: 'sobrescrito' }, 6);
  }, verify: value => { assert.deepEqual(value.editorDocument, editorDocument); assert.equal(value.blocks[4].url, 'https://example.test/video'); assert.equal(value.blocks[5].fileId, null); assert.equal(value.blocks[5].url, null); assert.equal(value.blocks[5].alt, null); } });
  await scenario('Sin bloque quiz pero con preguntas persistidas', { setup: async () => { await db.query("update app.content_blocks set kind='text',body=$2 where version_id=$1", [version.id, { text: 'Sólo texto' }]); }, verify: value => { assert.equal(value.questions.length, 8); assert.equal(value.blocks[0].questions, undefined); } });
  await scenario('Cero bloques conserva title/blocks/editorDocument null', { setup: () => db.query('delete from app.content_blocks where version_id=$1', [version.id]), verify: value => { assert.equal(value.title, null); assert.equal(value.blocks, null); assert.equal(value.editorDocument, null); assert.equal(value.questions.length, 8); } });
  await scenario('Quiz sin preguntas conserva questions vacío en raíz y bloque', { setup: async () => { await db.query('update app.activities set version_id=$2 where id=$1', [activity.id, emptyVersion.id]); await db.query("update app.content_blocks set kind='quiz',body='{}' where version_id=$1", [emptyVersion.id]); }, verify: value => { assert.deepEqual(value.questions, []); assert.deepEqual(value.blocks[0].questions, []); } });
  await scenario('Lectura sin quiz, intentos ni configuración', { aid: readingId, verify: value => { assert.deepEqual(value.questions, []); assert.equal(value.attemptsRemaining, 0); assert.equal(value.activity, null); assert.equal(value.attempt, null); } });
  await scenario('Versión nula mantiene proyección nula y array vacío', { aid: manualId, verify: value => { assert.equal(value.title, null); assert.equal(value.blocks, null); assert.equal(value.editorDocument, null); assert.deepEqual(value.questions, []); } });
  await scenario('Documento del editor SQL null', { setup: () => db.query('update app.resource_versions set editor_document=null where id=$1', [version.id]), verify: value => assert.equal(value.editorDocument, null) });
  for (const body of [null, [], ['legado'], 'legado', 7, true]) await scenario(`Cuerpo quiz JSON no objeto (${JSON.stringify(body)}) conserva forma legada`, { setup: () => db.query('update app.content_blocks set body=$2::jsonb where version_id=$1', [version.id, JSON.stringify(body)]), verify: value => assert.ok(Array.isArray(value.blocks[0])) });
  await scenario('Cuerpo quiz null y cero preguntas mantiene null interno legado', { setup: async () => { await db.query('update app.activities set version_id=$2 where id=$1', [activity.id, emptyVersion.id]); await db.query("update app.content_blocks set kind='quiz',body='null'::jsonb where version_id=$1", [emptyVersion.id]); }, verify: value => { assert.deepEqual(value.questions, []); assert.equal(value.blocks[0].at(-1).questions, null); } });

  await scenario('Actividad no publicada: mismo error privado', { setup: () => db.query('update app.activities set published_at=null where id=$1', [activity.id]), errorCode: 'P0001' });
  await scenario('Actividad no publicada: mismo rechazo público', { mode: 'snapshot', setup: () => db.query('update app.activities set published_at=null where id=$1', [activity.id]), errorCode: '42501' });
  for (const mode of ['helper', 'snapshot']) {
    await scenario(`Materia archivada denegada (${mode})`, { mode, setup: () => db.query('update app.subjects set archived_at=now() where id=$1', [subject.id]), errorCode: '42501' });
    await scenario(`Materia en purga denegada (${mode})`, { mode, setup: () => db.query('update app.subjects set purge_started_at=now() where id=$1', [subject.id]), errorCode: '42501' });
    await scenario(`Membresía retirada denegada (${mode})`, { mode, setup: () => db.query("update app.memberships set status='withdrawn' where subject_id=$1 and student_id=$2", [subject.id, users.a]), errorCode: '42501' });
    await scenario(`Sin membresía denegado (${mode})`, { mode, user: users.outside, errorCode: '42501' });
    await scenario(`Actividad ausente denegada (${mode})`, { mode, aid: id(), errorCode: '42501' });
    await scenario(`Identificador nulo denegado (${mode})`, { mode, aid: null, errorCode: '42501' });
  }
  await scenario('Docente ajeno no accede al snapshot', { mode: 'snapshot', user: users.otherTeacher, errorCode: '42501' });
  await scenario('Correo no confirmado no accede al snapshot', { mode: 'snapshot', user: users.unconfirmed, errorCode: '42501' });
  await scenario('Cliente autenticado sin UID no accede al snapshot', { mode: 'snapshot', user: null, errorCode: '42501' });
  await scenario('Rol anónimo no accede al snapshot', { mode: 'snapshot', user: null, role: 'anon', errorCode: '42501' });
  await scenario('Estudiante no puede invocar helper privado directamente', { mode: 'private-client', errorCode: '42501' });
  await scenario('Docente no puede invocar helper privado directamente', { mode: 'private-client', user: users.teacher, errorCode: '42501' });
  await scenario('Snapshot docente no cambia', { mode: 'snapshot', user: users.teacher });

  // Cuenta trabajo real en una llamada aislada. No es prueba de latencia/capacidad.
  await admin();
  await db.exec('begin');
  const questionDefinition = (await rows("select pg_get_functiondef('app.question_json(uuid,uuid,boolean)'::regprocedure) value"))[0].value;
  await db.exec(questionDefinition.replace('FUNCTION app.question_json(', 'FUNCTION app.student_projection_original_question('));
  await db.exec(`create sequence app.student_projection_question_calls;
    create or replace function app.question_json(v uuid,k uuid,secret boolean default false) returns jsonb
    language plpgsql stable security definer set search_path='' as $$begin
      perform nextval('app.student_projection_question_calls');
      return app.student_projection_original_question(v,k,secret);
    end $$;`);
  const countCalls = async sql => {
    await db.exec(sql);
    await db.query("select setval('app.student_projection_question_calls',1,false)");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [users.a]);
    await rows('select app.student_activity($1)', [activity.id]);
    return Number((await rows('select last_value from app.student_projection_question_calls'))[0].last_value);
  };
  const baselineCalls = await countCalls(beforeSql);
  const candidateCalls = await countCalls(candidateSql);
  assert.equal(baselineCalls, 16);
  assert.equal(candidateCalls, 8);
  report.questionJsonCalls = { questionCount: 8, quizBlockCount: 1, baseline: baselineCalls, candidate: candidateCalls, method: 'Wrapper contador sobre question_json sólo en la base de prueba, transacción revertida.' };
  check(true, 'Una llamada ordinaria elimina ocho serializaciones duplicadas de question_json (16 → 8)');
  await db.exec('rollback');
  delete report.currentCase;
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { code: error.code ?? error.name, message: error.message, where: error.where };
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.limitations = [
    'PGlite y stubs mínimos de Auth/Storage: no verifica JWT reales, concurrencia, HTTP, ACK ni capacidad Q-06.',
    'La proyección privada se compara completa sin normalización. En el snapshot público sólo se excluye state.revision, reloj wall-clock ajeno al cambio; todos los arrays conservan su orden.',
    'Los cierres se comparan bajo el mismo now() y desde un savepoint idéntico; los UUID nuevos de question_grades se omiten únicamente al comparar efectos internos, sin omitir payload.',
    'Fixtures SQL de múltiples quizzes y cuerpos JSON no objeto cubren formas admitidas por el esquema aunque el publicador actual no las produce.',
    'El contador prueba eliminación de trabajo duplicado en el caso ordinario; no mide ni atribuye reducción de latencia.'
  ];
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, questionJsonCalls: report.questionJsonCalls, failure: report.failure }));
  await db.close();
}
