import { describe, expect, it } from 'vitest';
import {
  calculateAverage,
  createDemoRepository,
  createDemoState,
  decodeDemoState,
  DEMO_IDS,
  DEMO_STORAGE_KEY,
  MemoryStorage,
  publishGrade,
  publishResource,
  reviewAnswer,
  saveDraft,
  scoreAttempt,
  scoreQuestion,
  startAttempt,
  studentActivity,
  studentResults,
  submitAnswer,
  updateActivity,
  useHint,
  validateEditorDocument,
} from '../../src/domain';
import type {
  ActivitySettings,
  AnswerValue,
  DemoState,
  Evaluation,
  OperationContext,
  Question,
} from '../../src/domain';

const NOW = '2026-09-27T16:00:00.000Z';
const teacher = (id = 'new-id', now = NOW): OperationContext => ({
  id,
  now,
  actorId: DEMO_IDS.teacher,
});
const student = (id = 'attempt-camila', now = NOW): OperationContext => ({
  id,
  now,
  actorId: DEMO_IDS.student,
});
const single: Question = {
  id: 'q1',
  type: 'single',
  prompt: '¿Cuál produce alimento?',
  points: 2,
  options: [
    { id: 'plant', text: 'Planta' },
    { id: 'rabbit', text: 'Conejo' },
  ],
  correctOptionId: 'plant',
  hint: 'Utiliza la luz solar.',
  explanation: 'Las plantas realizan fotosíntesis.',
};
const open: Question = {
  id: 'q2',
  type: 'open',
  prompt: 'Explica por qué.',
  points: 3,
  manual: true,
  manualGuide: 'Explica la transformación de energía.',
};
const correct: AnswerValue = { type: 'single', optionId: 'plant' };
function fixture(
  questions: Question[] = [single, open],
  settings: Partial<ActivitySettings> = {},
): DemoState {
  const state = createDemoState(NOW);
  state.attempts = [];
  state.powerups = [];
  state.evaluations = [];
  state.versions[0].blocks = [{ id: 'quiz', type: 'quiz', questions: structuredClone(questions) }];
  state.resources[0].blocks = structuredClone(state.versions[0].blocks);
  delete state.activities[0].lockedAt;
  state.activities[0].settings = { ...state.activities[0].settings, ...settings };
  return state;
}
function completed(state: DemoState): DemoState {
  let result = startAttempt(state, DEMO_IDS.activity, DEMO_IDS.student, student()).state;
  result = submitAnswer(result, 'attempt-camila', 'q1', correct, 'key-1', false, student()).state;
  if (
    result.versions[0].blocks.some((block) => block.type === 'quiz' && block.questions.length > 1)
  )
    result = submitAnswer(
      result,
      'attempt-camila',
      'q2',
      { type: 'open', text: 'Transforma la energía de la luz.' },
      'key-2',
      false,
      student(),
    ).state;
  return result;
}

describe('corrección por identificadores y precisión', () => {
  it('no concede puntos por una selección múltiple incompleta o con extras', () => {
    const q: Question = {
      id: 'multi',
      type: 'multiple',
      prompt: 'Marca dos',
      points: 3,
      options: [
        { id: 'a', text: 'Agua' },
        { id: 'b', text: 'Sol' },
        { id: 'c', text: 'Ave' },
      ],
      correctOptionIds: ['a', 'b'],
    };
    expect(scoreQuestion(q, { type: 'multiple', optionIds: ['b', 'a'] })).toEqual({
      numerator: 3,
      denominator: 1,
    });
    expect(scoreQuestion(q, { type: 'multiple', optionIds: ['a'] })).toEqual({
      numerator: 0,
      denominator: 1,
    });
    expect(scoreQuestion(q, { type: 'multiple', optionIds: ['a', 'b', 'c'] })).toEqual({
      numerator: 0,
      denominator: 1,
    });
    expect(() => scoreQuestion(q, { type: 'multiple', optionIds: ['a', 'a'] })).toThrow();
  });
  it('conserva la fracción de puntos parciales sin redondear cada pregunta', () => {
    const q: Question = {
      id: 'order',
      type: 'ordering',
      prompt: 'Ordena',
      points: 1,
      items: [
        { id: 'a', text: 'Uno' },
        { id: 'b', text: 'Dos' },
        { id: 'c', text: 'Tres' },
      ],
      correctOrder: ['a', 'b', 'c'],
    };
    expect(scoreQuestion(q, { type: 'ordering', itemIds: ['a', 'c', 'b'] })).toEqual({
      numerator: 1,
      denominator: 3,
    });
    let state = fixture([q], { maxGrade: 20 });
    state = startAttempt(state, DEMO_IDS.activity, DEMO_IDS.student, student()).state;
    state = submitAnswer(
      state,
      'attempt-camila',
      'order',
      { type: 'ordering', itemIds: ['a', 'c', 'b'] },
      'fraction',
      false,
      student(),
    ).state;
    expect(scoreAttempt(state, state.attempts[0]).grade).toBe(6.67);
  });
  it('escritura y corrección manual configurada nunca se corrigen por coincidencia', () => {
    expect(
      scoreQuestion(open, { type: 'open', text: 'Transforma la energía de la luz.' }),
    ).toBeNull();
    const q: Question = {
      id: 'blank',
      type: 'fill-text',
      prompt: 'Completa',
      points: 2,
      manual: true,
      template: 'El {b} produce alimento',
      blanks: [{ id: 'b', label: 'Ser vivo' }],
    };
    expect(scoreQuestion(q, { type: 'fill-text', texts: { b: 'árbol' } })).toBeNull();
    expect(scoreQuestion(single, correct, true)).toBeNull();
  });
  it('puntúa relaciones, espacios con opciones y verdadero/falso', () => {
    const q: Question = {
      id: 'match',
      type: 'matching',
      prompt: 'Relaciona',
      points: 3,
      left: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ],
      right: [
        { id: 'x', text: 'X' },
        { id: 'y', text: 'Y' },
        { id: 'z', text: 'Z' },
      ],
      pairs: { a: 'x', b: 'y', c: 'z' },
    };
    expect(scoreQuestion(q, { type: 'matching', pairs: { a: 'x', b: 'z', c: 'y' } })).toEqual({
      numerator: 1,
      denominator: 1,
    });
    expect(
      scoreQuestion(
        { id: 'tf', type: 'true-false', prompt: '¿Sí?', points: 0.5, correct: true },
        { type: 'true-false', value: false },
      ),
    ).toEqual({ numerator: 0, denominator: 1 });
    const fill: Question = {
      id: 'fill',
      type: 'fill-options',
      prompt: 'Completa',
      points: 3,
      template: '{a} y {b}',
      blanks: [
        {
          id: 'a',
          options: [
            { id: 'x', text: 'X' },
            { id: 'y', text: 'Y' },
          ],
          correctOptionId: 'x',
        },
        {
          id: 'b',
          options: [
            { id: 'x', text: 'X' },
            { id: 'y', text: 'Y' },
          ],
          correctOptionId: 'y',
        },
      ],
    };
    expect(scoreQuestion(fill, { type: 'fill-options', choices: { a: 'x', b: 'x' } })).toEqual({
      numerator: 3,
      denominator: 2,
    });
  });
});

describe('borradores, publicación y versiones', () => {
  it('clona contenido enriquecido y semántico sin alterar la versión al editar después', () => {
    const state = fixture();
    state.resources[0].editorDocument = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Importante', styles: { bold: true } }],
      },
    ];
    const published = publishResource(state, DEMO_IDS.resource, teacher('version-new'));
    const resource = structuredClone(published.state.resources[0]);
    resource.title = 'Editado';
    resource.blocks = [{ id: 'text-new', type: 'text', text: 'Otra explicación' }];
    resource.editorDocument = [];
    const saved = saveDraft(published.state, resource, 1, teacher());
    expect(published.result.title).toBe('Ecosistemas: todo está conectado');
    expect(
      saved.state.versions.find((version) => version.id === 'version-new')?.editorDocument,
    ).toEqual(state.resources[0].editorDocument);
    expect(saved.state.versions.find((version) => version.id === 'version-new')?.blocks).toEqual(
      state.resources[0].blocks,
    );
    expect(state.resources[0].revision).toBe(1);
    expect(saved.result.revision).toBe(2);
  });
  it('detecta conflicto del borrador y bloquea reglas al iniciar el primer intento', () => {
    const state = fixture();
    const updated = saveDraft(
      state,
      { ...state.resources[0], title: 'Nueva versión' },
      1,
      teacher(),
    );
    expect(() => saveDraft(updated.state, state.resources[0], 1, teacher())).toThrow(
      /otra pestaña/,
    );
    const started = startAttempt(state, DEMO_IDS.activity, DEMO_IDS.student, student()).state;
    expect(() =>
      updateActivity(
        started,
        DEMO_IDS.activity,
        { ...started.activities[0].settings, maxGrade: 20 },
        teacher(),
      ),
    ).toThrow(/ya tiene intentos/);
  });
  it('guarda y publica bloques con propiedades compartidas sin confundirlas con ciclos', () => {
    const props = { textColor: 'default', backgroundColor: 'default' };
    const styles = { bold: true };
    const editorDocument = ['Introducción', 'Observación'].map((text, index) => ({
      id: `paragraph-${index}`,
      type: 'paragraph',
      props,
      content: [{ type: 'text', text, styles }],
    }));
    expect(editorDocument[0].props).toBe(editorDocument[1].props);
    expect(() => validateEditorDocument(editorDocument)).not.toThrow();

    const storage = new MemoryStorage();
    const repository = createDemoRepository(storage, { now: () => NOW, id: () => 'shared-doc' });
    const resource = repository.load().resources[0];
    repository.saveDraft({ ...resource, editorDocument }, resource.revision);
    const restored = createDemoRepository(storage, { now: () => NOW, id: () => 'published-doc' });
    expect(restored.load().resources[0].editorDocument).toEqual(editorDocument);
    expect(restored.publishResource(resource.id).editorDocument).toEqual(editorDocument);
  });
  it('rechaza soluciones privadas y JSON no serializable en el documento público', () => {
    expect(() => validateEditorDocument([{ correctOptionId: 'secret' }])).toThrow();
    expect(() => validateEditorDocument([{ value: Number.NaN }])).toThrow();
    expect(() => validateEditorDocument([{ content: undefined }])).toThrow(
      /valor no compatible con JSON/,
    );
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(() => validateEditorDocument(cyclic)).toThrow(/circulares/);
    const ancestor: { styles?: unknown } = {};
    ancestor.styles = { parent: ancestor };
    expect(() => validateEditorDocument([ancestor])).toThrow(/circulares/);
  });
});

describe('intento, orden e idempotencia', () => {
  it('reconecta al mismo intento sin otra oportunidad ni nuevo orden', () => {
    const state = fixture(undefined, { shuffleQuestions: true, shuffleOptions: true });
    const first = startAttempt(state, DEMO_IDS.activity, DEMO_IDS.student, student());
    const second = startAttempt(
      first.state,
      DEMO_IDS.activity,
      DEMO_IDS.student,
      student('different-id'),
    );
    expect(second.result).toEqual(first.result);
    expect(second.state.attempts).toHaveLength(1);
  });
  it('no duplica puntos/doble al reenviar y rechaza la misma clave con otro contenido', () => {
    const started = startAttempt(
      fixture([single]),
      DEMO_IDS.activity,
      DEMO_IDS.student,
      student(),
    ).state;
    const first = submitAnswer(
      started,
      'attempt-camila',
      'q1',
      correct,
      'repeat-key',
      true,
      student(),
    );
    const replay = submitAnswer(
      first.state,
      'attempt-camila',
      'q1',
      correct,
      'repeat-key',
      true,
      student('ignored', '2026-10-30T00:00:00.000Z'),
    );
    expect(replay.state).toBe(first.state);
    expect(replay.result.answers).toHaveLength(1);
    expect(replay.state.powerups).toHaveLength(1);
    expect(scoreAttempt(replay.state, replay.result)).toMatchObject({ gamePoints: 4, grade: 100 });
    expect(() =>
      submitAnswer(
        first.state,
        'attempt-camila',
        'q1',
        { type: 'single', optionId: 'rabbit' },
        'repeat-key',
        true,
        student(),
      ),
    ).toThrow(/otra respuesta/);
  });
  it('comprueba pertenencia incluso en replay y no permite editar respuesta confirmada', () => {
    const answered = completed(fixture([single]));
    expect(() =>
      submitAnswer(answered, 'attempt-camila', 'q1', correct, 'key-1', false, {
        ...student(),
        actorId: DEMO_IDS.pendingStudent,
      }),
    ).toThrow(/aprobación/);
    expect(() =>
      submitAnswer(answered, 'attempt-camila', 'q1', correct, 'new-key', false, student()),
    ).toThrow(/terminó/);
    answered.memberships[0].status = 'removed';
    expect(() =>
      submitAnswer(answered, 'attempt-camila', 'q1', correct, 'key-1', false, student()),
    ).toThrow(/aprobación/);
  });
  it('un envío rechazado no consume doble y los usos se comparten entre intentos', () => {
    let state = startAttempt(
      fixture([single]),
      DEMO_IDS.activity,
      DEMO_IDS.student,
      student(),
    ).state;
    expect(() =>
      submitAnswer(
        state,
        'attempt-camila',
        'q1',
        { type: 'single', optionId: 'unknown' },
        'bad',
        true,
        student(),
      ),
    ).toThrow();
    expect(state.powerups).toHaveLength(0);
    state = useHint(state, 'attempt-camila', 'q1', student()).state;
    const repeatHint = useHint(state, 'attempt-camila', 'q1', student());
    expect(repeatHint.state).toBe(state);
    state = submitAnswer(
      state,
      'attempt-camila',
      'q1',
      { type: 'single', optionId: 'rabbit' },
      'wrong-but-valid',
      true,
      student(),
    ).state;
    expect(scoreAttempt(state, state.attempts[0]).gamePoints).toBe(0);
    state = startAttempt(
      state,
      DEMO_IDS.activity,
      DEMO_IDS.student,
      student('second-attempt'),
    ).state;
    expect(() => useHint(state, 'second-attempt', 'q1', student())).toThrow(/Ya utilizaste/);
    expect(() =>
      submitAnswer(state, 'second-attempt', 'q1', correct, 'second-double', true, student()),
    ).toThrow(/no está disponible/);
  });
});

describe('revisión, publicación y visibilidad', () => {
  it('mantiene pendientes fuera de la nota; una revisión privada no reemplaza la publicada', () => {
    let state = completed(fixture());
    expect(scoreAttempt(state, state.attempts[0])).toMatchObject({
      pending: 1,
      complete: false,
      grade: null,
    });
    expect(() =>
      publishGrade(state, DEMO_IDS.activity, DEMO_IDS.student, teacher('eval1')),
    ).toThrow(/Completa la revisión/);
    state = reviewAnswer(
      state,
      'attempt-camila',
      'q2',
      2,
      'Buena relación',
      undefined,
      teacher(),
    ).state;
    expect(scoreAttempt(state, state.attempts[0]).grade).toBe(80);
    expect(studentResults(state, DEMO_IDS.subject, DEMO_IDS.student, NOW)[0]).toMatchObject({
      grade: null,
      status: 'unpublished',
    });
    state = publishGrade(state, DEMO_IDS.activity, DEMO_IDS.student, teacher('eval1')).state;
    state = reviewAnswer(
      state,
      'attempt-camila',
      'q2',
      3,
      'Explicación completa',
      'Se reconoció la relación causal',
      teacher(),
    ).state;
    expect(scoreAttempt(state, state.attempts[0]).grade).toBe(100);
    expect(studentResults(state, DEMO_IDS.subject, DEMO_IDS.student, NOW)[0].grade).toBe(80);
    state = publishGrade(
      state,
      DEMO_IDS.activity,
      DEMO_IDS.student,
      teacher('eval2'),
      '',
      'Revisión de la explicación',
    ).state;
    expect(state.evaluations.map((evaluation) => evaluation.grade)).toEqual([80, 100]);
  });
  it('oculta soluciones, puntos y explicaciones incluso tras publicar nota agregada', () => {
    let state = completed(
      fixture([single], { feedback: 'hidden', streaks: false, ranking: false }),
    );
    state = publishGrade(state, DEMO_IDS.activity, DEMO_IDS.student, teacher()).state;
    const projection = JSON.stringify(studentActivity(state, DEMO_IDS.activity, DEMO_IDS.student));
    for (const hidden of [
      'correctOptionId',
      'manualGuide',
      'reviews',
      'Las plantas realizan fotosíntesis',
      'Utiliza la luz solar.',
    ])
      expect(projection).not.toContain(hidden);
    expect(studentResults(state, DEMO_IDS.subject, DEMO_IDS.student, NOW)[0]).toMatchObject({
      grade: 100,
      reviewVisible: false,
    });
    expect(
      studentResults(state, DEMO_IDS.subject, DEMO_IDS.student, NOW)[0].answers,
    ).toBeUndefined();
  });
  it('la revisión diferida exige cierre y publicación; muestra las revisiones efectivamente publicadas', () => {
    let state = completed(fixture([single], { feedback: 'after-close' }));
    expect(
      studentResults(state, DEMO_IDS.subject, DEMO_IDS.student, '2026-10-10T00:00:00.000Z')[0]
        .reviewVisible,
    ).toBe(false);
    state = publishGrade(state, DEMO_IDS.activity, DEMO_IDS.student, teacher()).state;
    expect(studentResults(state, DEMO_IDS.subject, DEMO_IDS.student, NOW)[0].reviewVisible).toBe(
      false,
    );
    state = reviewAnswer(
      state,
      'attempt-camila',
      'q1',
      1,
      'Cambio privado',
      'Revisión pendiente de publicar',
      teacher(),
    ).state;
    const result = studentResults(
      state,
      DEMO_IDS.subject,
      DEMO_IDS.student,
      '2026-10-10T00:00:00.000Z',
    )[0];
    expect(result.reviewVisible).toBe(true);
    expect(result.answers?.[0].points).toBe(2);
    expect(result.answers?.[0].comment).not.toBe('Cambio privado');
  });
  it('calcula el promedio ponderado, conserva ceros explícitos y evita duplicar revisiones', () => {
    const base: Evaluation = {
      id: 'e1',
      activityId: 'a1',
      subjectId: DEMO_IDS.subject,
      studentId: DEMO_IDS.student,
      source: 'manual',
      revision: 1,
      grade: 12,
      maxGrade: 20,
      weight: 2,
      countsTowardAverage: true,
      comment: '',
      actorId: DEMO_IDS.teacher,
      createdAt: NOW,
      publishedAt: NOW,
    };
    const other = { ...base, id: 'e2', activityId: 'a2', grade: 90, maxGrade: 100, weight: 1 };
    expect(calculateAverage([base, other])).toBe(70);
    expect(
      calculateAverage([base, other, { ...other, id: 'revision', revision: 2, grade: 0 }]),
    ).toBe(40);
    expect(calculateAverage([])).toBeNull();
    expect(calculateAverage([{ ...base, countsTowardAverage: false }])).toBeNull();
  });
});

describe('adaptador de demostración y restauración', () => {
  it('persiste y restaura un borrador nuevo, detecta conflicto y reinicia datos ficticios', () => {
    const storage = new MemoryStorage(),
      options = { now: () => NOW, id: () => 'fixed-id' };
    const first = createDemoRepository(storage, options),
      initial = first.load();
    const resource = {
      ...initial.resources[0],
      id: 'new-resource',
      title: 'Otro ecosistema',
      revision: 0,
    };
    first.saveDraft(resource, 0);
    const second = createDemoRepository(storage, options);
    expect(second.load().resources.find((item) => item.id === 'new-resource')?.revision).toBe(1);
    expect(() => second.saveDraft(resource, 0)).toThrow(/otra pestaña/);
    expect(second.reset().resources).toHaveLength(1);
    expect(
      second.load().attempts.find((item) => item.id === DEMO_IDS.pendingAttempt)?.answers,
    ).toHaveLength(8);
  });
  it('no sobrescribe almacenamiento corrupto al leer; exige reinicio explícito', () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, '{ broken');
    const repository = createDemoRepository(storage, { now: () => NOW });
    expect(() => repository.load()).toThrow(/no se pudieron restaurar/);
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBe('{ broken');
    expect(repository.restoreProblem).not.toBeNull();
    repository.reset();
    expect(repository.restoreProblem).toBeNull();
    expect(repository.load().schemaVersion).toBe(1);
  });
  it('detecta datos bien formados en JSON pero con respuestas/puntuaciones inválidas', () => {
    const state = createDemoState(NOW);
    state.attempts[0].answers[0].reviews[0].points.denominator = 0;
    expect(() => decodeDemoState(JSON.stringify(state))).toThrow(/puntuación inválida/);
    const duplicate = createDemoState(NOW);
    duplicate.attempts[0].answers.push(structuredClone(duplicate.attempts[0].answers[0]));
    expect(() => decodeDemoState(JSON.stringify(duplicate))).toThrow(/duplicados/);
  });
  it('un fallo de escritura no confirma el cambio ni pierde el último borrador persistido', () => {
    const backing = new MemoryStorage();
    let fail = false;
    const repository = createDemoRepository(
      {
        getItem: (key) => backing.getItem(key),
        removeItem: (key) => backing.removeItem(key),
        setItem: (key, value) => {
          if (fail) throw new Error('quota');
          backing.setItem(key, value);
        },
      },
      { now: () => NOW },
    );
    const state = repository.load();
    fail = true;
    expect(() => repository.saveDraft({ ...state.resources[0], title: 'No se guardó' }, 1)).toThrow(
      /No se pudo guardar/,
    );
    fail = false;
    expect(repository.load().resources[0].title).toBe(state.resources[0].title);
  });
  it('materializa el vencimiento al recargar, conserva escritura pendiente y no consume otro intento', () => {
    let time = NOW,
      seq = 0;
    const storage = new MemoryStorage();
    const state = fixture([open], { timeLimitMinutes: 1 });
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    const repository = createDemoRepository(storage, { now: () => time, id: () => `id-${++seq}` });
    const attempt = repository.startAttempt(DEMO_IDS.activity, DEMO_IDS.student);
    time = '2026-09-27T16:01:00.000Z';
    expect(repository.load().attempts.find((item) => item.id === attempt.id)).toMatchObject({
      status: 'closed',
      closeReason: 'expired',
      answers: [],
    });
    expect(repository.load().attempts).toHaveLength(1);
    expect(() =>
      repository.submitAnswer(attempt.id, 'q2', { type: 'open', text: 'Tarde' }, 'late'),
    ).toThrow(/terminó/);
  });
  it('requiere aprobación para entrar y permite decidir solicitudes idempotentemente', () => {
    let seq = 0;
    const repository = createDemoRepository(new MemoryStorage(), {
      now: () => NOW,
      id: () => `id-${++seq}`,
    });
    expect(() => repository.studentActivity(DEMO_IDS.activity, DEMO_IDS.pendingStudent)).toThrow(
      /aprobación/,
    );
    repository.decideMembership('membership-lucia', 'approved');
    repository.decideMembership('membership-lucia', 'approved');
    expect(
      repository.load().memberships.filter((item) => item.studentId === DEMO_IDS.pendingStudent),
    ).toHaveLength(1);
    expect(
      repository.studentActivity(DEMO_IDS.activity, DEMO_IDS.pendingStudent).attempt,
    ).toBeNull();
  });
  it('publica la nota de una entrega solo después de revisión y preserva versiones', () => {
    let seq = 0;
    const repository = createDemoRepository(new MemoryStorage(), {
      now: () => NOW,
      id: () => `id-${++seq}`,
    });
    const file = { id: 'file-1', name: 'ecosistema.pdf', size: 2300, mimeType: 'application/pdf' };
    const first = repository.submitTask(DEMO_IDS.task, [file], 'Mi observación');
    const second = repository.submitTask(
      DEMO_IDS.task,
      [{ ...file, id: 'file-2' }],
      'Versión ampliada',
    );
    expect(second.version).toBe(2);
    expect(repository.load().submissions.some((item) => item.id === first.id)).toBe(true);
    expect(() => repository.publishTaskGrade(second.id)).toThrow(/Revisa la entrega/);
    repository.reviewTask(second.id, 16, 'Observación clara');
    expect(repository.publishTaskGrade(second.id).grade).toBe(16);
    expect(() => repository.submitTask(DEMO_IDS.task, [file], 'Otra vez')).toThrow(
      /nueva oportunidad/,
    );
  });
  it('la sala guiada no consume intento hasta comenzar y espera el avance docente', () => {
    let seq = 0;
    const storage = new MemoryStorage();
    const state = fixture([single, open], {
      pace: 'guided',
      maxAttempts: 1,
      shuffleQuestions: false,
    });
    state.activities[0].guided = {
      status: 'waiting',
      questionIndex: 0,
      questionOpen: false,
      studentIds: [],
    };
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    const repository = createDemoRepository(storage, {
      now: () => NOW,
      id: () => `guided-${++seq}`,
    });
    repository.joinGuidedRoom(DEMO_IDS.activity);
    expect(repository.load().attempts).toHaveLength(0);
    repository.startGuidedSession(DEMO_IDS.activity);
    repository.startGuidedSession(DEMO_IDS.activity);
    expect(repository.load().attempts).toHaveLength(1);
    const attempt = repository.load().attempts[0];
    repository.submitAnswer(attempt.id, 'q1', correct, 'guided-q1');
    expect(repository.load().attempts[0].status).toBe('in-progress');
    expect(() =>
      repository.submitAnswer(attempt.id, 'q2', { type: 'open', text: 'Todavía no' }, 'too-soon'),
    ).toThrow(/no está disponible/);
    repository.closeGuidedQuestion(DEMO_IDS.activity);
    repository.openNextGuidedQuestion(DEMO_IDS.activity);
    expect(() => repository.closeGuidedQuestion(DEMO_IDS.activity)).toThrow(/pendientes/);
    repository.submitAnswer(
      attempt.id,
      'q2',
      { type: 'open', text: 'La luz se transforma en energía química.' },
      'guided-q2',
    );
    repository.closeGuidedQuestion(DEMO_IDS.activity);
    expect(repository.load().attempts[0]).toMatchObject({
      status: 'closed',
      closeReason: 'guided-complete',
    });
    expect(scoreAttempt(repository.load(), repository.load().attempts[0]).pending).toBe(1);
  });
});
