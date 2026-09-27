import type {
  Activity,
  ActivitySettings,
  Answer,
  AnswerValue,
  Attempt,
  DemoState,
  Evaluation,
  Id,
  Membership,
  Mutation,
  OperationContext,
  Question,
  Resource,
  ResourceVersion,
  StudentActivity,
  StudentBlock,
  StudentQuestion,
  StudentResult,
  Subject,
  Task,
  TaskSubmission,
  SubmissionFile,
} from './types';
import {
  clone,
  decimal,
  numeric,
  questionsOf,
  requireRule,
  scoreAttempt,
  scoreQuestion,
  validateAnswer,
  validateEditorDocument,
  validateResource,
  validateSettings,
} from './rules';

export function subjectFor(state: DemoState, id: Id): Subject {
  const subject = state.subjects.find((item) => item.id === id);
  requireRule(subject, 'SUBJECT_NOT_FOUND', 'No se encontró la materia.');
  return subject;
}
export function requireTeacher(state: DemoState, subjectId: Id, actorId: Id): Subject {
  const subject = subjectFor(state, subjectId);
  requireRule(
    subject.ownerId === actorId &&
      state.users.some((user) => user.id === actorId && user.role === 'teacher'),
    'NOT_ALLOWED',
    'Esta acción corresponde al docente de la materia.',
  );
  requireRule(
    subject.status === 'active',
    'SUBJECT_ARCHIVED',
    'Restaura la materia antes de modificarla.',
  );
  return subject;
}
export function requireStudent(state: DemoState, subjectId: Id, studentId: Id): void {
  const subject = subjectFor(state, subjectId);
  requireRule(
    subject.status === 'active' &&
      state.users.some((user) => user.id === studentId && user.role === 'student') &&
      state.memberships.some(
        (item) =>
          item.subjectId === subjectId &&
          item.studentId === studentId &&
          item.status === 'approved',
      ),
    'NOT_ALLOWED',
    'Necesitas la aprobación del docente para acceder a esta materia.',
  );
}
function ownResource(state: DemoState, id: Id, actorId: Id): Resource {
  const resource = state.resources.find((item) => item.id === id);
  requireRule(
    resource &&
      resource.ownerId === actorId &&
      state.users.some((user) => user.id === actorId && user.role === 'teacher'),
    'NOT_ALLOWED',
    'Solo el propietario puede modificar este recurso.',
  );
  return resource;
}
export function activityFor(state: DemoState, id: Id): Activity {
  const activity = state.activities.find((item) => item.id === id);
  requireRule(activity, 'ACTIVITY_NOT_FOUND', 'No se encontró la actividad.');
  return activity;
}
function attemptFor(state: DemoState, id: Id): Attempt {
  const attempt = state.attempts.find((item) => item.id === id);
  requireRule(attempt, 'ATTEMPT_NOT_FOUND', 'No se encontró el intento.');
  return attempt;
}
function versionFor(state: DemoState, id: Id): ResourceVersion {
  const version = state.versions.find((item) => item.id === id);
  requireRule(version, 'VERSION_NOT_FOUND', 'No se encontró la versión publicada.');
  return version;
}
function next(state: DemoState): DemoState {
  const copy = clone(state);
  copy.revision++;
  return copy;
}
const byTime = (iso: string) => Date.parse(iso);
const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

export function saveDraft(
  state: DemoState,
  resource: Resource,
  expectedRevision: number,
  ctx: OperationContext,
): Mutation<Resource> {
  const previous = state.resources.find((item) => item.id === resource.id);
  requireRule(
    state.users.some((user) => user.id === ctx.actorId && user.role === 'teacher') &&
      resource.ownerId === ctx.actorId &&
      (!previous || previous.ownerId === ctx.actorId),
    'NOT_ALLOWED',
    'Solo el propietario puede guardar este recurso.',
  );
  requireRule(
    (previous?.revision ?? 0) === expectedRevision,
    'DRAFT_CONFLICT',
    'Este borrador cambió en otra pestaña. Recárgalo o conserva una copia.',
  );
  requireRule(
    resource.title.length <= 120 && resource.blocks.length <= 200,
    'DRAFT_LIMIT',
    'El título o la cantidad de bloques supera el límite.',
  );
  validateEditorDocument(resource.editorDocument);
  const copy = next(state),
    saved = { ...clone(resource), revision: expectedRevision + 1, updatedAt: ctx.now };
  const index = copy.resources.findIndex((item) => item.id === resource.id);
  if (index < 0) copy.resources.push(saved);
  else copy.resources[index] = saved;
  return { state: copy, result: clone(saved) };
}
export function publishResource(
  state: DemoState,
  resourceId: Id,
  ctx: OperationContext,
): Mutation<ResourceVersion> {
  const resource = ownResource(state, resourceId, ctx.actorId);
  validateResource(resource);
  requireRule(
    !state.versions.some((version) => version.id === ctx.id),
    'DUPLICATE_ID',
    'La versión ya existe.',
  );
  validateEditorDocument(resource.editorDocument);
  const version: ResourceVersion = {
    id: ctx.id,
    resourceId,
    ownerId: ctx.actorId,
    number: 1 + state.versions.filter((item) => item.resourceId === resourceId).length,
    title: resource.title,
    blocks: clone(resource.blocks),
    ...(resource.editorDocument ? { editorDocument: clone(resource.editorDocument) } : {}),
    publishedAt: ctx.now,
  };
  const copy = next(state);
  copy.versions.push(version);
  return { state: copy, result: clone(version) };
}
export function createActivity(
  state: DemoState,
  versionId: Id,
  subjectId: Id,
  settings: ActivitySettings,
  ctx: OperationContext,
  title?: string,
): Mutation<Activity> {
  requireTeacher(state, subjectId, ctx.actorId);
  const version = versionFor(state, versionId);
  requireRule(
    version.ownerId === ctx.actorId,
    'NOT_ALLOWED',
    'Utiliza una versión de tu biblioteca.',
  );
  requireRule(
    questionsOf(version).length > 0,
    'READING_ONLY',
    'Este recurso es de lectura y no crea una actividad evaluada.',
  );
  validateSettings(settings);
  const activity: Activity = {
    id: ctx.id,
    subjectId,
    versionId,
    title: title?.trim() || version.title,
    settings: clone(settings),
    createdAt: ctx.now,
    ...(settings.pace === 'guided'
      ? {
          guided: {
            status: 'waiting' as const,
            questionIndex: 0,
            questionOpen: false,
            studentIds: [],
          },
        }
      : {}),
  };
  requireRule(
    !state.activities.some((item) => item.id === ctx.id),
    'DUPLICATE_ID',
    'La actividad ya existe.',
  );
  const copy = next(state);
  copy.activities.push(activity);
  return { state: copy, result: clone(activity) };
}
export function updateActivity(
  state: DemoState,
  activityId: Id,
  settings: ActivitySettings,
  ctx: OperationContext,
): Mutation<Activity> {
  const activity = activityFor(state, activityId);
  requireTeacher(state, activity.subjectId, ctx.actorId);
  requireRule(
    !activity.lockedAt && !state.attempts.some((item) => item.activityId === activityId),
    'ACTIVITY_LOCKED',
    'La actividad ya tiene intentos. Publica otra actividad para cambiar sus reglas.',
  );
  validateSettings(settings);
  const copy = next(state),
    changed = activityFor(copy, activityId);
  changed.settings = clone(settings);
  changed.guided =
    settings.pace === 'guided'
      ? { status: 'waiting', questionIndex: 0, questionOpen: false, studentIds: [] }
      : undefined;
  return { state: copy, result: clone(changed) };
}
export function joinGuidedRoom(
  state: DemoState,
  activityId: Id,
  ctx: OperationContext,
): Mutation<Activity> {
  const activity = activityFor(state, activityId);
  requireStudent(state, activity.subjectId, ctx.actorId);
  requireRule(
    activity.settings.pace === 'guided' && activity.guided,
    'NOT_GUIDED',
    'Esta actividad tiene avance individual.',
  );
  if (activity.guided.studentIds.includes(ctx.actorId)) return { state, result: clone(activity) };
  requireRule(
    activity.guided.status === 'waiting' && byTime(ctx.now) < byTime(activity.settings.closesAt),
    'ROOM_CLOSED',
    'La sala ya comenzó o terminó y no admite nuevos participantes.',
  );
  const copy = next(state),
    changed = activityFor(copy, activityId);
  changed.guided!.studentIds.push(ctx.actorId);
  return { state: copy, result: clone(changed) };
}
export function startGuidedSession(
  state: DemoState,
  activityId: Id,
  ctx: OperationContext,
): Mutation<Activity> {
  const activity = activityFor(state, activityId);
  requireTeacher(state, activity.subjectId, ctx.actorId);
  requireRule(
    activity.settings.pace === 'guided' && activity.guided,
    'NOT_GUIDED',
    'Esta actividad tiene avance individual.',
  );
  if (activity.guided.status === 'running') return { state, result: clone(activity) };
  requireRule(
    activity.guided.status === 'waiting' && activity.guided.studentIds.length > 0,
    'EMPTY_ROOM',
    'La sala necesita al menos un estudiante antes de comenzar.',
  );
  let copy = next(state);
  const changed = activityFor(copy, activityId);
  changed.guided!.status = 'running';
  changed.guided!.questionOpen = true;
  // Starting the entire roster succeeds or fails together; partial mutations never reach persistence.
  for (const studentId of changed.guided!.studentIds)
    copy = startAttempt(copy, activityId, studentId, {
      ...ctx,
      id: `${ctx.id}-${studentId}`,
    }).state;
  return { state: copy, result: clone(activityFor(copy, activityId)) };
}
export function closeGuidedQuestion(
  state: DemoState,
  activityId: Id,
  ctx: OperationContext,
  confirmPending = false,
): Mutation<Activity> {
  const activity = activityFor(state, activityId);
  requireTeacher(state, activity.subjectId, ctx.actorId);
  if (activity.guided?.status === 'closed') return { state, result: clone(activity) };
  requireRule(
    activity.guided?.status === 'running',
    'SESSION_UNAVAILABLE',
    'La sesión guiada no está en curso.',
  );
  if (!activity.guided.questionOpen) return { state, result: clone(activity) };
  const attempts = state.attempts.filter(
    (item) => item.activityId === activityId && item.status === 'in-progress',
  );
  const pending = attempts.filter(
    (attempt) =>
      !attempt.answers.some(
        (answer) => answer.questionId === attempt.questionOrder[activity.guided!.questionIndex],
      ),
  ).length;
  requireRule(
    pending === 0 || confirmPending,
    'RESPONSES_PENDING',
    `Quedan ${pending} respuestas pendientes. Confirma para cerrar esta pregunta.`,
  );
  const copy = next(state),
    changed = activityFor(copy, activityId);
  changed.guided!.questionOpen = false;
  const questions = questionsOf(versionFor(copy, activity.versionId));
  if (changed.guided!.questionIndex === questions.length - 1) {
    changed.guided!.status = 'closed';
    for (const attempt of copy.attempts.filter(
      (item) => item.activityId === activityId && item.status === 'in-progress',
    )) {
      attempt.status = 'closed';
      attempt.closeReason = 'guided-complete';
      attempt.closedAt = ctx.now;
    }
  }
  return { state: copy, result: clone(changed) };
}
export function openNextGuidedQuestion(
  state: DemoState,
  activityId: Id,
  ctx: OperationContext,
): Mutation<Activity> {
  const activity = activityFor(state, activityId);
  requireTeacher(state, activity.subjectId, ctx.actorId);
  requireRule(
    activity.guided?.status === 'running' && !activity.guided.questionOpen,
    'CLOSE_QUESTION_FIRST',
    'Cierra la pregunta actual antes de continuar.',
  );
  requireRule(
    activity.guided.questionIndex + 1 < questionsOf(versionFor(state, activity.versionId)).length &&
      byTime(ctx.now) < byTime(activity.settings.closesAt),
    'SESSION_UNAVAILABLE',
    'La sesión ya llegó a su final.',
  );
  const copy = next(state),
    changed = activityFor(copy, activityId);
  changed.guided!.questionIndex++;
  changed.guided!.questionOpen = true;
  return { state: copy, result: clone(changed) };
}
function shuffled<T>(items: T[], seed: string): T[] {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    const j = (hash >>> 0) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function prepareQuestionOrder(questions: Question[], shuffle: boolean, seed: string): Id[] {
  if (!shuffle) return questions.map((question) => question.id);
  const groups = new Map<string, Id[]>();
  for (const question of questions) {
    const key = question.groupId ? `group:${question.groupId}` : `question:${question.id}`;
    groups.set(key, [...(groups.get(key) ?? []), question.id]);
  }
  return shuffled([...groups.values()], seed).flat();
}
function prepareOptionOrders(
  questions: Question[],
  seed: string,
  shuffle: boolean,
): Record<Id, Id[]> {
  const orders: Record<Id, Id[]> = {};
  for (const question of questions) {
    const list = (key: Id, ids: Id[], always = false) => {
      orders[key] = shuffle || always ? shuffled(ids, `${seed}/${key}`) : ids;
    };
    if (question.type === 'single' || question.type === 'multiple')
      list(
        question.id,
        question.options.map((item) => item.id),
      );
    if (question.type === 'matching') {
      list(
        `${question.id}/left`,
        question.left.map((item) => item.id),
      );
      list(
        `${question.id}/right`,
        question.right.map((item) => item.id),
      );
    }
    if (question.type === 'ordering') {
      list(
        question.id,
        question.items.map((item) => item.id),
        true,
      );
      if (same(orders[question.id], question.correctOrder))
        orders[question.id].push(orders[question.id].shift()!);
    }
    if (question.type === 'fill-options')
      question.blanks.forEach((blank) =>
        list(
          `${question.id}/${blank.id}`,
          blank.options.map((item) => item.id),
        ),
      );
  }
  return orders;
}
export function startAttempt(
  state: DemoState,
  activityId: Id,
  studentId: Id,
  ctx: OperationContext,
): Mutation<Attempt> {
  const activity = activityFor(state, activityId);
  requireStudent(state, activity.subjectId, studentId);
  requireRule(
    ctx.actorId === studentId ||
      (activity.settings.pace === 'guided' &&
        subjectFor(state, activity.subjectId).ownerId === ctx.actorId),
    'NOT_ALLOWED',
    'Solo puedes iniciar tu propio intento.',
  );
  const open = state.attempts.find(
    (item) =>
      item.activityId === activityId &&
      item.studentId === studentId &&
      item.status === 'in-progress',
  );
  if (open) {
    if (byTime(ctx.now) >= byTime(open.deadline))
      return closeExpiredAttempt(state, open.id, ctx.now);
    return { state, result: clone(open) };
  }
  requireRule(
    byTime(ctx.now) >= byTime(activity.settings.opensAt) &&
      byTime(ctx.now) < byTime(activity.settings.closesAt),
    'ACTIVITY_UNAVAILABLE',
    'La actividad no está disponible en este momento.',
  );
  if (activity.settings.pace === 'guided')
    requireRule(
      activity.guided?.status === 'running' && activity.guided.studentIds.includes(studentId),
      'WAIT_FOR_TEACHER',
      'Espera a que el docente inicie la sesión.',
    );
  const count = state.attempts.filter(
    (item) => item.activityId === activityId && item.studentId === studentId,
  ).length;
  requireRule(
    count < activity.settings.maxAttempts,
    'NO_ATTEMPTS',
    'Ya utilizaste los intentos disponibles.',
  );
  requireRule(
    !state.attempts.some((item) => item.id === ctx.id),
    'DUPLICATE_ID',
    'El intento ya existe.',
  );
  const questions = questionsOf(versionFor(state, activity.versionId));
  const deadline = new Date(
    Math.min(
      byTime(activity.settings.closesAt),
      activity.settings.timeLimitMinutes
        ? byTime(ctx.now) + activity.settings.timeLimitMinutes * 60000
        : Infinity,
    ),
  ).toISOString();
  const attempt: Attempt = {
    id: ctx.id,
    activityId,
    studentId,
    versionId: activity.versionId,
    number: count + 1,
    questionOrder: prepareQuestionOrder(questions, activity.settings.shuffleQuestions, ctx.id),
    optionOrders: prepareOptionOrders(questions, ctx.id, activity.settings.shuffleOptions),
    startedAt: ctx.now,
    deadline,
    answers: [],
    status: 'in-progress',
  };
  const copy = next(state);
  copy.attempts.push(attempt);
  activityFor(copy, activityId).lockedAt ??= ctx.now;
  return { state: copy, result: clone(attempt) };
}
export function closeExpiredAttempt(
  state: DemoState,
  attemptId: Id,
  now: string,
): Mutation<Attempt> {
  const attempt = attemptFor(state, attemptId);
  if (attempt.status === 'closed' || byTime(now) < byTime(attempt.deadline))
    return { state, result: clone(attempt) };
  const copy = next(state),
    closed = attemptFor(copy, attemptId);
  closed.status = 'closed';
  closed.closeReason = 'expired';
  closed.closedAt = closed.deadline;
  return { state: copy, result: clone(closed) };
}
function availableQuestion(state: DemoState, attempt: Attempt): Id | undefined {
  const activity = activityFor(state, attempt.activityId);
  if (activity.settings.pace === 'guided')
    return activity.guided?.questionOpen
      ? attempt.questionOrder[activity.guided.questionIndex]
      : undefined;
  return attempt.questionOrder.find(
    (id) => !attempt.answers.some((answer) => answer.questionId === id),
  );
}
export function submitAnswer(
  state: DemoState,
  attemptId: Id,
  questionId: Id,
  value: AnswerValue,
  idempotencyKey: string,
  useDouble: boolean,
  ctx: OperationContext,
): Mutation<Attempt> {
  const attempt = attemptFor(state, attemptId),
    activity = activityFor(state, attempt.activityId);
  requireStudent(state, activity.subjectId, ctx.actorId);
  requireRule(
    attempt.studentId === ctx.actorId,
    'NOT_ALLOWED',
    'Solo puedes responder tu propio intento.',
  );
  requireRule(
    idempotencyKey.trim().length > 0,
    'INVALID_KEY',
    'La respuesta necesita una clave de envío.',
  );
  const replay = attempt.answers.find((answer) => answer.idempotencyKey === idempotencyKey);
  if (replay) {
    requireRule(
      replay.questionId === questionId &&
        replay.usedDouble === useDouble &&
        same(replay.value, value),
      'IDEMPOTENCY_CONFLICT',
      'Esta clave de envío ya se utilizó con otra respuesta.',
    );
    return { state, result: clone(attempt) };
  }
  requireRule(
    attempt.status === 'in-progress' && byTime(ctx.now) < byTime(attempt.deadline),
    'ATTEMPT_CLOSED',
    'El intento terminó. Se conservan tus respuestas confirmadas.',
  );
  requireRule(
    availableQuestion(state, attempt) === questionId &&
      !attempt.answers.some((answer) => answer.questionId === questionId),
    'QUESTION_UNAVAILABLE',
    'Esta pregunta ya se respondió o todavía no está disponible.',
  );
  const question = questionsOf(versionFor(state, attempt.versionId)).find(
    (item) => item.id === questionId,
  );
  requireRule(question, 'QUESTION_NOT_FOUND', 'No se encontró la pregunta del intento.');
  validateAnswer(question, value);
  if (useDouble)
    requireRule(
      activity.settings.allowDouble &&
        !state.powerups.some(
          (item) =>
            item.activityId === activity.id &&
            item.studentId === ctx.actorId &&
            item.kind === 'double',
        ),
      'DOUBLE_UNAVAILABLE',
      'El doble no está disponible para esta actividad.',
    );
  const points = scoreQuestion(question, value, activity.settings.manualCorrection);
  const answer: Answer = {
    questionId,
    value: clone(value),
    idempotencyKey,
    submittedAt: ctx.now,
    usedDouble: useDouble,
    reviews:
      points === null
        ? []
        : [{ revision: 1, points, actorId: 'automatic', at: ctx.now, comment: '' }],
  };
  const copy = next(state),
    changed = attemptFor(copy, attemptId);
  changed.answers.push(answer);
  if (useDouble)
    copy.powerups.push({
      activityId: activity.id,
      studentId: ctx.actorId,
      kind: 'double',
      questionId,
      attemptId,
      at: ctx.now,
    });
  if (
    activity.settings.pace === 'individual' &&
    changed.answers.length === changed.questionOrder.length
  ) {
    changed.status = 'closed';
    changed.closedAt = ctx.now;
    changed.closeReason = 'submitted';
  }
  return { state: copy, result: clone(changed) };
}
export function useHint(
  state: DemoState,
  attemptId: Id,
  questionId: Id,
  ctx: OperationContext,
): Mutation<string> {
  const attempt = attemptFor(state, attemptId),
    activity = activityFor(state, attempt.activityId);
  requireStudent(state, activity.subjectId, ctx.actorId);
  requireRule(
    attempt.studentId === ctx.actorId,
    'NOT_ALLOWED',
    'Solo puedes usar pistas en tu intento.',
  );
  const question = questionsOf(versionFor(state, attempt.versionId)).find(
    (item) => item.id === questionId,
  );
  requireRule(
    question && typeof question.hint === 'string' && question.hint.trim(),
    'NO_HINT',
    'Esta pregunta no tiene una pista preparada.',
  );
  const hint = question.hint;
  const used = state.powerups.find(
    (item) =>
      item.activityId === activity.id && item.studentId === ctx.actorId && item.kind === 'hint',
  );
  if (used) {
    requireRule(
      used.attemptId === attemptId && used.questionId === questionId,
      'HINT_USED',
      'Ya utilizaste la pista de esta actividad.',
    );
    return { state, result: hint };
  }
  requireRule(
    activity.settings.allowHint &&
      attempt.status === 'in-progress' &&
      byTime(ctx.now) < byTime(attempt.deadline) &&
      availableQuestion(state, attempt) === questionId,
    'HINT_UNAVAILABLE',
    'La pista no está disponible ahora.',
  );
  const copy = next(state);
  copy.powerups.push({
    activityId: activity.id,
    studentId: ctx.actorId,
    kind: 'hint',
    questionId,
    attemptId,
    at: ctx.now,
  });
  return { state: copy, result: hint };
}
export function reviewAnswer(
  state: DemoState,
  attemptId: Id,
  questionId: Id,
  points: number,
  comment: string,
  reason: string | undefined,
  ctx: OperationContext,
): Mutation<Answer> {
  const attempt = attemptFor(state, attemptId),
    activity = activityFor(state, attempt.activityId);
  requireTeacher(state, activity.subjectId, ctx.actorId);
  const question = questionsOf(versionFor(state, attempt.versionId)).find(
      (item) => item.id === questionId,
    ),
    answer = attempt.answers.find((item) => item.questionId === questionId);
  requireRule(
    question && answer,
    'ANSWER_NOT_FOUND',
    'No se encontró una respuesta confirmada para corregir.',
  );
  requireRule(
    Number.isFinite(points) && points >= 0 && points <= question.points,
    'INVALID_GRADE',
    `La puntuación debe estar entre 0 y ${question.points}.`,
  );
  requireRule(
    answer.reviews.length === 0 || Boolean(reason?.trim()),
    'REASON_REQUIRED',
    'Explica el motivo de la nueva revisión.',
  );
  const copy = next(state),
    changed = attemptFor(copy, attemptId).answers.find((item) => item.questionId === questionId)!;
  changed.reviews.push({
    revision: changed.reviews.length + 1,
    points: decimal(points),
    actorId: ctx.actorId,
    at: ctx.now,
    comment,
    reason,
  });
  return { state: copy, result: clone(changed) };
}
export function publishGrade(
  state: DemoState,
  activityId: Id,
  studentId: Id,
  ctx: OperationContext,
  comment = '',
  reason?: string,
): Mutation<Evaluation> {
  const activity = activityFor(state, activityId);
  requireTeacher(state, activity.subjectId, ctx.actorId);
  const candidates = state.attempts
    .filter((item) => item.activityId === activityId && item.studentId === studentId)
    .map((attempt) => ({ attempt, score: scoreAttempt(state, attempt) }))
    .filter((item) => item.score.grade !== null)
    .sort(
      (a, b) =>
        b.score.grade! - a.score.grade! ||
        byTime(a.attempt.closedAt!) - byTime(b.attempt.closedAt!),
    );
  const best = candidates[0];
  requireRule(
    best,
    'PENDING_REVIEW',
    'Completa la revisión de un intento cerrado antes de publicar la nota.',
  );
  const previous = state.evaluations
    .filter((item) => item.activityId === activityId && item.studentId === studentId)
    .at(-1);
  const revisions = Object.fromEntries(
    best.attempt.answers.map((answer) => [answer.questionId, answer.reviews.at(-1)!.revision]),
  );
  if (
    previous?.attemptId === best.attempt.id &&
    previous.grade === best.score.grade &&
    same(previous.answerRevisions, revisions) &&
    previous.comment === comment
  )
    return { state, result: clone(previous) };
  requireRule(
    !previous || Boolean(reason?.trim()),
    'REASON_REQUIRED',
    'Explica el motivo de la nueva publicación.',
  );
  const evaluation: Evaluation = {
    id: ctx.id,
    activityId,
    subjectId: activity.subjectId,
    studentId,
    source: 'quiz',
    attemptId: best.attempt.id,
    revision: (previous?.revision ?? 0) + 1,
    grade: best.score.grade!,
    maxGrade: activity.settings.maxGrade,
    weight: activity.settings.weight,
    countsTowardAverage: activity.settings.countsTowardAverage,
    comment,
    reason,
    actorId: ctx.actorId,
    createdAt: ctx.now,
    publishedAt: ctx.now,
    answerRevisions: revisions,
  };
  const copy = next(state);
  copy.evaluations.push(evaluation);
  return { state: copy, result: clone(evaluation) };
}
export function toStudentQuestion(
  question: Question,
  order: Record<Id, Id[]> = {},
): StudentQuestion {
  const safe = clone(question) as unknown as Record<string, unknown>;
  for (const key of [
    'correctOptionId',
    'correctOptionIds',
    'correct',
    'pairs',
    'correctOrder',
    'manualGuide',
    'explanation',
    'hint',
  ])
    delete safe[key];
  const arrange = <T extends { id: string }>(items: T[], key: string): T[] =>
    [...items].sort((a, b) => (order[key]?.indexOf(a.id) ?? 0) - (order[key]?.indexOf(b.id) ?? 0));
  if (question.type === 'single' || question.type === 'multiple')
    safe.options = arrange(question.options, question.id);
  if (question.type === 'ordering') safe.items = arrange(question.items, question.id);
  if (question.type === 'matching') {
    safe.left = arrange(question.left, `${question.id}/left`);
    safe.right = arrange(question.right, `${question.id}/right`);
  }
  if (question.type === 'fill-options')
    safe.blanks = question.blanks.map((blank) => ({
      id: blank.id,
      options: arrange(blank.options, `${question.id}/${blank.id}`),
    }));
  return safe as unknown as StudentQuestion;
}
export function studentActivity(state: DemoState, activityId: Id, studentId: Id): StudentActivity {
  const activity = activityFor(state, activityId);
  requireStudent(state, activity.subjectId, studentId);
  const version = versionFor(state, activity.versionId),
    attempts = state.attempts.filter(
      (item) => item.activityId === activityId && item.studentId === studentId,
    );
  const attempt = attempts.find((item) => item.status === 'in-progress') ?? attempts.at(-1) ?? null;
  const order =
    attempt?.optionOrders ??
    prepareOptionOrders(
      questionsOf(version),
      `${studentId}/${activityId}`,
      activity.settings.shuffleOptions,
    );
  const questions = (attempt?.questionOrder ?? questionsOf(version).map((item) => item.id)).map(
    (id) =>
      toStudentQuestion(
        questionsOf(version).find((item) => item.id === id)!,
        order,
      ),
  );
  const blocks: StudentBlock[] = version.blocks.map((block) =>
    block.type === 'quiz' ? { ...block, questions } : clone(block),
  );
  return {
    activity: clone(activity),
    title: version.title,
    blocks,
    ...(version.editorDocument ? { editorDocument: clone(version.editorDocument) } : {}),
    questions,
    attempt: attempt
      ? {
          ...clone(attempt),
          answers: attempt.answers.map((answer) => ({
            questionId: answer.questionId,
            value: clone(answer.value),
            idempotencyKey: answer.idempotencyKey,
            submittedAt: answer.submittedAt,
            usedDouble: answer.usedDouble,
          })),
        }
      : null,
    attemptsRemaining: Math.max(0, activity.settings.maxAttempts - attempts.length),
    hintUsed: state.powerups.some(
      (item) =>
        item.activityId === activityId && item.studentId === studentId && item.kind === 'hint',
    ),
    doubleUsed: state.powerups.some(
      (item) =>
        item.activityId === activityId && item.studentId === studentId && item.kind === 'double',
    ),
  };
}
export function studentResults(
  state: DemoState,
  subjectId: Id,
  studentId: Id,
  now: string,
): StudentResult[] {
  requireStudent(state, subjectId, studentId);
  return state.activities
    .filter((item) => item.subjectId === subjectId)
    .map((activity) => {
      const evaluation = state.evaluations
        .filter((item) => item.activityId === activity.id && item.studentId === studentId)
        .at(-1);
      const attempts = state.attempts.filter(
        (item) => item.activityId === activity.id && item.studentId === studentId,
      );
      const reviewVisible =
        activity.settings.feedback === 'immediate' ||
        (activity.settings.feedback === 'after-close' &&
          byTime(now) >= byTime(activity.settings.closesAt) &&
          Boolean(evaluation));
      const sourceAttempt = evaluation
        ? attempts.find((item) => item.id === evaluation.attemptId)
        : attempts.at(-1);
      const questions = questionsOf(versionFor(state, activity.versionId));
      const status: StudentResult['status'] = evaluation
        ? 'published'
        : !attempts.length
          ? 'not-started'
          : attempts.some((item) => item.status === 'in-progress')
            ? 'in-progress'
            : attempts.some((item) => !scoreAttempt(state, item).complete)
              ? 'pending-review'
              : 'unpublished';
      return {
        activityId: activity.id,
        title: activity.title,
        grade: evaluation?.grade ?? null,
        maxGrade: activity.settings.maxGrade,
        status,
        publishedAt: evaluation?.publishedAt,
        reviewVisible,
        ...(reviewVisible && sourceAttempt
          ? {
              answers: sourceAttempt.answers.flatMap((answer) => {
                const question = questions.find((item) => item.id === answer.questionId)!;
                const review = evaluation
                  ? answer.reviews.find(
                      (item) => item.revision === evaluation.answerRevisions?.[answer.questionId],
                    )
                  : answer.reviews.at(-1);
                return review
                  ? [
                      {
                        questionId: question.id,
                        points: numeric(review.points),
                        maximum: question.points,
                        explanation: question.explanation,
                        comment: review.comment,
                      },
                    ]
                  : [];
              }),
            }
          : {}),
      };
    });
}

export function createSubject(
  state: DemoState,
  details: Pick<Subject, 'name' | 'course' | 'year' | 'description'>,
  code: string,
  ctx: OperationContext,
): Mutation<Subject> {
  requireRule(
    state.users.some((user) => user.id === ctx.actorId && user.role === 'teacher'),
    'NOT_ALLOWED',
    'El perfil docente permite crear materias.',
  );
  requireRule(
    details.name.trim() && details.course.trim() && Number.isInteger(details.year),
    'INVALID_SUBJECT',
    'Completa nombre, curso y año.',
  );
  requireRule(
    /^[A-HJ-NP-Z2-9]{8}$/.test(code) && !state.subjects.some((item) => item.code === code),
    'INVALID_CODE',
    'El código de invitación no es válido o ya existe.',
  );
  const subject: Subject = { ...details, id: ctx.id, ownerId: ctx.actorId, code, status: 'active' };
  const copy = next(state);
  copy.subjects.push(subject);
  return { state: copy, result: clone(subject) };
}
export function requestMembership(
  state: DemoState,
  code: string,
  ctx: OperationContext,
): Mutation<Membership> {
  requireRule(
    state.users.some((user) => user.id === ctx.actorId && user.role === 'student'),
    'NOT_ALLOWED',
    'Utiliza un perfil de estudiante para solicitar ingreso.',
  );
  const subject = state.subjects.find(
    (item) => item.code === code.trim().toUpperCase() && item.status === 'active',
  );
  requireRule(
    subject,
    'CODE_UNAVAILABLE',
    'El código no está disponible. Compruébalo con tu docente.',
  );
  const existing = state.memberships.find(
    (item) => item.studentId === ctx.actorId && item.subjectId === subject.id,
  );
  if (existing?.status === 'pending' || existing?.status === 'approved')
    return { state, result: clone(existing) };
  const membership: Membership = {
    id: existing?.id ?? ctx.id,
    subjectId: subject.id,
    studentId: ctx.actorId,
    status: 'pending',
    requestedAt: ctx.now,
  };
  const copy = next(state);
  if (existing)
    copy.memberships[copy.memberships.findIndex((item) => item.id === existing.id)] = membership;
  else copy.memberships.push(membership);
  return { state: copy, result: clone(membership) };
}
export function decideMembership(
  state: DemoState,
  membershipId: Id,
  decision: 'approved' | 'rejected',
  ctx: OperationContext,
): Mutation<Membership> {
  const membership = state.memberships.find((item) => item.id === membershipId);
  requireRule(membership, 'MEMBERSHIP_NOT_FOUND', 'No se encontró la solicitud.');
  requireTeacher(state, membership.subjectId, ctx.actorId);
  if (membership.status === decision) return { state, result: clone(membership) };
  requireRule(
    membership.status === 'pending',
    'INVALID_MEMBERSHIP_STATE',
    'Esta solicitud ya fue resuelta.',
  );
  const copy = next(state),
    changed = copy.memberships.find((item) => item.id === membershipId)!;
  changed.status = decision;
  changed.decidedAt = ctx.now;
  return { state: copy, result: clone(changed) };
}
export function createTask(
  state: DemoState,
  details: Omit<Task, 'id'>,
  ctx: OperationContext,
): Mutation<Task> {
  requireTeacher(state, details.subjectId, ctx.actorId);
  requireRule(
    details.title.trim() &&
      details.instructions.trim() &&
      byTime(details.opensAt) < byTime(details.closesAt) &&
      details.maxGrade > 0 &&
      details.weight > 0,
    'INVALID_TASK',
    'Completa la consigna, fechas y valores de la tarea.',
  );
  const task: Task = { ...clone(details), id: ctx.id };
  const copy = next(state);
  copy.tasks.push(task);
  return { state: copy, result: clone(task) };
}
export function submitTask(
  state: DemoState,
  taskId: Id,
  files: SubmissionFile[],
  note: string,
  ctx: OperationContext,
): Mutation<TaskSubmission> {
  const task = state.tasks.find((item) => item.id === taskId);
  requireRule(task, 'TASK_NOT_FOUND', 'No se encontró la tarea.');
  requireStudent(state, task.subjectId, ctx.actorId);
  requireRule(
    byTime(ctx.now) >= byTime(task.opensAt) &&
      (byTime(ctx.now) < byTime(task.closesAt) || task.allowLate),
    'TASK_UNAVAILABLE',
    'La tarea no admite entregas en este momento.',
  );
  const previous = state.submissions
    .filter((item) => item.taskId === taskId && item.studentId === ctx.actorId)
    .at(-1);
  requireRule(
    !previous?.gradedAt,
    'RESUBMISSION_REQUIRED',
    'Solicita al docente una nueva oportunidad de entrega.',
  );
  const allowed: Record<string, string[]> = {
    pdf: ['application/pdf'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    jpg: ['image/jpeg'],
    jpeg: ['image/jpeg'],
    png: ['image/png'],
    webp: ['image/webp'],
  };
  requireRule(
    files.length >= 1 &&
      files.length <= 5 &&
      files.every(
        (file) =>
          file.name.length > 0 &&
          !/[\\/]/.test(file.name) &&
          file.size > 0 &&
          file.size <= 10 * 1024 * 1024 &&
          allowed[file.name.split('.').at(-1)!.toLowerCase()]?.includes(file.mimeType),
      ) &&
      files.reduce((total, file) => total + file.size, 0) <= 20 * 1024 * 1024,
    'INVALID_FILES',
    'Adjunta entre uno y cinco archivos PDF, DOCX o imágenes: hasta 10 MiB por archivo y 20 MiB en total.',
  );
  const submission: TaskSubmission = {
    id: ctx.id,
    taskId,
    studentId: ctx.actorId,
    version: (previous?.version ?? 0) + 1,
    files: clone(files),
    note,
    submittedAt: ctx.now,
    late: byTime(ctx.now) >= byTime(task.closesAt),
  };
  const copy = next(state);
  copy.submissions.push(submission);
  return { state: copy, result: clone(submission) };
}
export function reviewTask(
  state: DemoState,
  submissionId: Id,
  grade: number,
  comment: string,
  ctx: OperationContext,
): Mutation<TaskSubmission> {
  const submission = state.submissions.find((item) => item.id === submissionId);
  requireRule(submission, 'SUBMISSION_NOT_FOUND', 'No se encontró la entrega.');
  const task = state.tasks.find((item) => item.id === submission.taskId)!;
  requireTeacher(state, task.subjectId, ctx.actorId);
  requireRule(
    Number.isFinite(grade) && grade >= 0 && grade <= task.maxGrade,
    'INVALID_GRADE',
    `La nota debe estar entre 0 y ${task.maxGrade}.`,
  );
  const copy = next(state),
    changed = copy.submissions.find((item) => item.id === submissionId)!;
  changed.grade = grade;
  changed.comment = comment;
  changed.gradedAt = ctx.now;
  return { state: copy, result: clone(changed) };
}
export function publishTaskGrade(
  state: DemoState,
  submissionId: Id,
  ctx: OperationContext,
): Mutation<Evaluation> {
  const submission = state.submissions.find((item) => item.id === submissionId);
  requireRule(
    submission && submission.grade !== undefined && submission.gradedAt,
    'PENDING_REVIEW',
    'Revisa la entrega antes de publicar su nota.',
  );
  const task = state.tasks.find((item) => item.id === submission.taskId)!;
  requireTeacher(state, task.subjectId, ctx.actorId);
  const previous = state.evaluations
    .filter((item) => item.activityId === task.id && item.studentId === submission.studentId)
    .at(-1);
  if (
    previous?.submissionId === submissionId &&
    previous.grade === submission.grade &&
    previous.comment === (submission.comment ?? '')
  )
    return { state, result: clone(previous) };
  const evaluation: Evaluation = {
    id: ctx.id,
    activityId: task.id,
    subjectId: task.subjectId,
    studentId: submission.studentId,
    source: 'task',
    submissionId,
    revision: (previous?.revision ?? 0) + 1,
    grade: submission.grade,
    maxGrade: task.maxGrade,
    weight: task.weight,
    countsTowardAverage: task.countsTowardAverage,
    comment: submission.comment ?? '',
    actorId: ctx.actorId,
    createdAt: ctx.now,
    publishedAt: ctx.now,
  };
  const copy = next(state);
  copy.submissions.find((item) => item.id === submissionId)!.publishedAt = ctx.now;
  copy.evaluations.push(evaluation);
  return { state: copy, result: clone(evaluation) };
}
