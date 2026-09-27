import type { ActivitySettings, AnswerValue, DemoState, Id, Mutation, Resource, StoragePort, Subject, SubmissionFile, Task } from "./types";
import { createDemoState, DEMO_IDS } from "./demo-data";
import * as operations from "./operations";
import { clone, DomainError, numeric, questionsOf, requireRule, validateAnswer, validateBlocks, validateEditorDocument, validateSettings } from "./rules";

export const DEMO_STORAGE_KEY = "aulify.demo.v1";
export class MemoryStorage implements StoragePort {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
function rows(value: unknown, label: string, needsId = true): asserts value is Record<string, unknown>[] {
  requireRule(Array.isArray(value) && value.every(item => object(item) && (!needsId || (text(item.id) && item.id.length > 0))), "CORRUPT_STORAGE", `Los datos guardados de ${label} no son válidos.`);
  if (needsId) requireRule(new Set(value.map(item => item.id)).size === value.length, "CORRUPT_STORAGE", `Los datos de ${label} contienen identificadores repetidos.`);
}
/** Validates persisted domain shape and references, not trust or identity. Browser storage remains editable by its owner. */
export function decodeDemoState(raw: string): DemoState {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new DomainError("CORRUPT_STORAGE", "No se pudieron leer los datos de demostración. Puedes reiniciar la muestra."); }
  requireRule(object(value) && value.schemaVersion === 1 && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0, "CORRUPT_STORAGE", "La versión de los datos guardados no es compatible.");
  for (const key of ["users", "subjects", "memberships", "resources", "versions", "activities", "attempts", "evaluations", "tasks", "submissions", "manualActivities"]) rows(value[key], key);
  rows(value.powerups, "potenciadores", false); rows(value.helpPreferences, "ayuda", false);
  const state = value as unknown as DemoState;
  const hasUser = (id: Id) => state.users.some(user => user.id === id);
  const hasSubject = (id: Id) => state.subjects.some(subject => subject.id === id);
  for (const user of state.users) requireRule(text(user.name) && text(user.email) && ["teacher", "student"].includes(user.role), "CORRUPT_STORAGE", "Hay un perfil inválido en la muestra.");
  for (const subject of state.subjects) requireRule(hasUser(subject.ownerId) && text(subject.name) && text(subject.course) && text(subject.description) && Number.isInteger(subject.year) && ["active", "archived"].includes(subject.status) && (subject.code === null || text(subject.code)), "CORRUPT_STORAGE", "Hay una materia inválida en la muestra.");
  for (const membership of state.memberships) requireRule(hasSubject(membership.subjectId) && hasUser(membership.studentId) && ["pending", "approved", "rejected", "removed"].includes(membership.status) && date(membership.requestedAt), "CORRUPT_STORAGE", "Hay una pertenencia inválida en la muestra.");
  for (const resource of state.resources) {
    validateEditorDocument(resource.editorDocument);
    requireRule(hasUser(resource.ownerId) && text(resource.title) && ["resource", "quiz"].includes(resource.kind) && Number.isInteger(resource.revision) && resource.revision >= 1 && date(resource.updatedAt), "CORRUPT_STORAGE", "Hay un borrador inválido en la muestra.");
    // Drafts may contain incomplete content; publication performs the stricter semantic validation.
    rows(resource.blocks, "bloques de borrador");
    for (const block of resource.blocks) {
      requireRule(["heading", "text", "list", "image", "video", "quiz"].includes(block.type), "CORRUPT_STORAGE", "Hay un tipo de bloque inválido.");
      if (block.type === "text" || block.type === "heading") requireRule(text(block.text), "CORRUPT_STORAGE", "El texto guardado no es válido.");
      if (block.type === "list") requireRule(Array.isArray(block.items) && block.items.every(text) && typeof block.ordered === "boolean", "CORRUPT_STORAGE", "La lista guardada no es válida.");
      if (block.type === "image") requireRule(text(block.url) && text(block.alt), "CORRUPT_STORAGE", "La imagen guardada no es válida.");
      if (block.type === "video") requireRule(text(block.url) && text(block.title), "CORRUPT_STORAGE", "El video guardado no es válido.");
      if (block.type === "quiz") {
        rows(block.questions, "preguntas de borrador");
        for (const question of block.questions) {
          requireRule(text(question.prompt) && finite(question.points) && ["single", "multiple", "true-false", "matching", "ordering", "fill-options", "fill-text", "open"].includes(question.type), "CORRUPT_STORAGE", "La pregunta guardada no es válida.");
          const choices = (items: unknown) => { rows(items, "opciones"); requireRule(items.every(item => text(item.text)), "CORRUPT_STORAGE", "Las opciones guardadas no son válidas."); };
          if (question.type === "single" || question.type === "multiple") choices(question.options);
          if (question.type === "single") requireRule(text(question.correctOptionId), "CORRUPT_STORAGE", "Falta la solución de selección.");
          if (question.type === "multiple") requireRule(Array.isArray(question.correctOptionIds) && question.correctOptionIds.every(text), "CORRUPT_STORAGE", "Faltan las soluciones de selección.");
          if (question.type === "matching") { choices(question.left); choices(question.right); requireRule(object(question.pairs) && Object.values(question.pairs).every(text), "CORRUPT_STORAGE", "Faltan las correspondencias."); }
          if (question.type === "ordering") { choices(question.items); requireRule(Array.isArray(question.correctOrder) && question.correctOrder.every(text), "CORRUPT_STORAGE", "Falta la secuencia."); }
          if (question.type === "fill-options" || question.type === "fill-text") { requireRule(text(question.template), "CORRUPT_STORAGE", "Falta la frase."); rows(question.blanks, "espacios"); if (question.type === "fill-options") question.blanks.forEach(blank => choices(blank.options)); }
        }
      }
    }
  }
  for (const version of state.versions) { requireRule(state.resources.some(item => item.id === version.resourceId) && hasUser(version.ownerId) && text(version.title) && Number.isInteger(version.number) && version.number > 0 && date(version.publishedAt), "CORRUPT_STORAGE", "Hay una versión inválida en la muestra."); validateBlocks(version.blocks); validateEditorDocument(version.editorDocument); }
  for (const activity of state.activities) { requireRule(hasSubject(activity.subjectId) && state.versions.some(item => item.id === activity.versionId) && text(activity.title) && date(activity.createdAt) && object(activity.settings), "CORRUPT_STORAGE", "Hay una actividad inválida en la muestra."); validateSettings(activity.settings); }
  const openKeys = new Set<string>();
  for (const attempt of state.attempts) {
    const activity = state.activities.find(item => item.id === attempt.activityId), version = state.versions.find(item => item.id === attempt.versionId);
    requireRule(activity && version && activity.versionId === attempt.versionId && hasUser(attempt.studentId) && Number.isInteger(attempt.number) && attempt.number > 0 && date(attempt.startedAt) && date(attempt.deadline) && ["in-progress", "closed"].includes(attempt.status) && object(attempt.optionOrders), "CORRUPT_STORAGE", "Hay un intento inválido en la muestra.");
    const questions = questionsOf(version);
    requireRule(Array.isArray(attempt.questionOrder) && attempt.questionOrder.length === questions.length && new Set(attempt.questionOrder).size === questions.length && attempt.questionOrder.every(id => questions.some(question => question.id === id)), "CORRUPT_STORAGE", "El orden de preguntas no corresponde a la versión.");
    rows(attempt.answers, "respuestas", false);
    requireRule(new Set(attempt.answers.map(answer => answer.questionId)).size === attempt.answers.length && new Set(attempt.answers.map(answer => answer.idempotencyKey)).size === attempt.answers.length, "CORRUPT_STORAGE", "Las respuestas guardadas contienen duplicados.");
    if (attempt.status === "closed") requireRule(date(attempt.closedAt) && ["submitted", "expired", "guided-complete", "removed", "archived", "teacher-ended"].includes(attempt.closeReason ?? ""), "CORRUPT_STORAGE", "El cierre del intento no es válido.");
    else { const key = `${attempt.activityId}/${attempt.studentId}`; requireRule(!openKeys.has(key), "CORRUPT_STORAGE", "Hay dos intentos abiertos para la misma actividad."); openKeys.add(key); }
    for (const answer of attempt.answers) {
      const question = questions.find(item => item.id === answer.questionId);
      requireRule(question && text(answer.idempotencyKey) && date(answer.submittedAt) && typeof answer.usedDouble === "boolean" && object(answer.value), "CORRUPT_STORAGE", "Hay una respuesta inválida en la muestra."); validateAnswer(question, answer.value); rows(answer.reviews, "revisiones", false);
      answer.reviews.forEach((review, index) => requireRule(object(review.points) && Number.isSafeInteger(review.points.numerator) && Number.isSafeInteger(review.points.denominator) && review.points.denominator > 0 && numeric(review.points) >= 0 && numeric(review.points) <= question.points && review.revision === index + 1 && date(review.at) && text(review.comment), "CORRUPT_STORAGE", "Hay una puntuación inválida en la muestra."));
    }
  }
  const powerupKeys = new Set<string>();
  for (const use of state.powerups) { const key = `${use.activityId}/${use.studentId}/${use.kind}`; requireRule(!powerupKeys.has(key) && ["hint", "double"].includes(use.kind) && date(use.at) && state.attempts.some(item => item.id === use.attemptId && item.activityId === use.activityId && item.studentId === use.studentId && item.questionOrder.includes(use.questionId)), "CORRUPT_STORAGE", "Hay un potenciador inválido en la muestra."); powerupKeys.add(key); }
  for (const task of state.tasks) requireRule(hasSubject(task.subjectId) && text(task.title) && text(task.instructions) && date(task.opensAt) && date(task.closesAt) && finite(task.maxGrade) && task.maxGrade > 0 && finite(task.weight) && task.weight > 0, "CORRUPT_STORAGE", "Hay una tarea inválida en la muestra.");
  for (const submission of state.submissions) { requireRule(state.tasks.some(task => task.id === submission.taskId) && hasUser(submission.studentId) && Number.isInteger(submission.version) && submission.version > 0 && text(submission.note) && date(submission.submittedAt) && typeof submission.late === "boolean", "CORRUPT_STORAGE", "Hay una entrega inválida en la muestra."); rows(submission.files, "archivos"); requireRule(submission.files.every(file => text(file.name) && finite(file.size) && file.size > 0 && text(file.mimeType)), "CORRUPT_STORAGE", "Los archivos guardados no son válidos."); }
  for (const evaluation of state.evaluations) requireRule(hasSubject(evaluation.subjectId) && hasUser(evaluation.studentId) && ["quiz", "task", "manual"].includes(evaluation.source) && (state.activities.some(item => item.id === evaluation.activityId) || state.tasks.some(item => item.id === evaluation.activityId) || state.manualActivities.some(item => item.id === evaluation.activityId)) && finite(evaluation.grade) && finite(evaluation.maxGrade) && evaluation.maxGrade > 0 && evaluation.grade >= 0 && evaluation.grade <= evaluation.maxGrade && finite(evaluation.weight) && evaluation.weight > 0 && Number.isInteger(evaluation.revision) && evaluation.revision > 0 && date(evaluation.publishedAt), "CORRUPT_STORAGE", "Hay una calificación inválida en la muestra.");
  for (const preference of state.helpPreferences) requireRule(hasUser(preference.userId) && Number.isInteger(preference.version) && ["offered", "skipped", "completed"].includes(preference.status), "CORRUPT_STORAGE", "La preferencia de ayuda no es válida.");
  return state;
}

export interface RepositoryOptions { now?: () => string; id?: () => string; key?: string }
/** Replace this adapter with server operations for production. Local roles, time and storage are demonstration controls. */
export function createDemoRepository(storage: StoragePort = new MemoryStorage(), options: RepositoryOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => globalThis.crypto.randomUUID());
  const key = options.key ?? DEMO_STORAGE_KEY;
  let restoreProblem: string | null = null;
  const context = (actorId: Id) => ({ now: now(), id: id(), actorId });
  function persist(state: DemoState) {
    try { storage.setItem(key, JSON.stringify(state)); } catch { throw new DomainError("STORAGE_UNAVAILABLE", "No se pudo guardar. Revisa el espacio o los permisos del navegador; tus cambios siguen en pantalla."); }
  }
  function load(): DemoState {
    let raw: string | null;
    try { raw = storage.getItem(key); } catch { throw new DomainError("STORAGE_UNAVAILABLE", "El navegador no permite leer los datos de la demostración."); }
    if (raw === null) { const initial = createDemoState(now()); persist(initial); restoreProblem = null; return clone(initial); }
    let state: DemoState;
    try { state = decodeDemoState(raw); restoreProblem = null; }
    catch (error) { restoreProblem = error instanceof Error ? error.message : "No se pudieron restaurar los datos."; throw new DomainError("CORRUPT_STORAGE", "Los datos de demostración no se pudieron restaurar. Reinicia la muestra para continuar."); }
    const beforeRevision = state.revision;
    for (const attempt of state.attempts) if (attempt.status === "in-progress") state = operations.closeExpiredAttempt(state, attempt.id, now()).state;
    if (beforeRevision !== state.revision) persist(state);
    return clone(state);
  }
  function apply<T>(operation: (state: DemoState) => Mutation<T>): T {
    const state = load(), result = operation(state);
    if (result.state !== state) persist(result.state);
    return clone(result.result);
  }
  return {
    load,
    reset(): DemoState { const state = createDemoState(now()); persist(state); restoreProblem = null; return clone(state); },
    get restoreProblem() { return restoreProblem; },
    saveDraft: (resource: Resource, expectedRevision: number, actorId = resource.ownerId) => apply(state => operations.saveDraft(state, resource, expectedRevision, context(actorId))),
    publishResource: (resourceId: Id, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.publishResource(state, resourceId, context(actorId))),
    createActivity: (versionId: Id, subjectId: Id, settings: ActivitySettings, title?: string, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.createActivity(state, versionId, subjectId, settings, context(actorId), title)),
    updateActivity: (activityId: Id, settings: ActivitySettings, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.updateActivity(state, activityId, settings, context(actorId))),
    joinGuidedRoom: (activityId: Id, studentId: Id = DEMO_IDS.student) => apply(state => operations.joinGuidedRoom(state, activityId, context(studentId))),
    startGuidedSession: (activityId: Id, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.startGuidedSession(state, activityId, context(actorId))),
    closeGuidedQuestion: (activityId: Id, confirmPending = false, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.closeGuidedQuestion(state, activityId, context(actorId), confirmPending)),
    openNextGuidedQuestion: (activityId: Id, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.openNextGuidedQuestion(state, activityId, context(actorId))),
    startAttempt: (activityId: Id, studentId: Id) => apply(state => operations.startAttempt(state, activityId, studentId, context(studentId))),
    submitAnswer: (attemptId: Id, questionId: Id, value: AnswerValue, idempotencyKey: string, useDouble = false, studentId?: Id) => apply(state => operations.submitAnswer(state, attemptId, questionId, value, idempotencyKey, useDouble, context(studentId ?? state.attempts.find(attempt => attempt.id === attemptId)?.studentId ?? ""))),
    useHint: (attemptId: Id, questionId: Id, studentId?: Id) => apply(state => operations.useHint(state, attemptId, questionId, context(studentId ?? state.attempts.find(attempt => attempt.id === attemptId)?.studentId ?? ""))),
    reviewAnswer: (attemptId: Id, questionId: Id, points: number, comment = "", reason?: string, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.reviewAnswer(state, attemptId, questionId, points, comment, reason, context(actorId))),
    publishGrade: (activityId: Id, studentId: Id, comment = "", reason?: string, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.publishGrade(state, activityId, studentId, context(actorId), comment, reason)),
    studentActivity: (activityId: Id, studentId: Id) => operations.studentActivity(load(), activityId, studentId),
    studentResults: (subjectId: Id, studentId: Id) => operations.studentResults(load(), subjectId, studentId, now()),
    createSubject: (details: Pick<Subject, "name" | "course" | "year" | "description">, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.createSubject(state, details, id().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").padEnd(8, "K").slice(0, 8), context(actorId))),
    requestMembership: (code: string, studentId: Id = DEMO_IDS.student) => apply(state => operations.requestMembership(state, code, context(studentId))),
    decideMembership: (membershipId: Id, decision: "approved" | "rejected", actorId: Id = DEMO_IDS.teacher) => apply(state => operations.decideMembership(state, membershipId, decision, context(actorId))),
    createTask: (details: Omit<Task, "id">, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.createTask(state, details, context(actorId))),
    submitTask: (taskId: Id, files: SubmissionFile[], note: string, studentId: Id = DEMO_IDS.student) => apply(state => operations.submitTask(state, taskId, files, note, context(studentId))),
    reviewTask: (submissionId: Id, grade: number, comment = "", actorId: Id = DEMO_IDS.teacher) => apply(state => operations.reviewTask(state, submissionId, grade, comment, context(actorId))),
    publishTaskGrade: (submissionId: Id, actorId: Id = DEMO_IDS.teacher) => apply(state => operations.publishTaskGrade(state, submissionId, context(actorId))),
    setHelpPreference(userId: Id, status: "offered" | "skipped" | "completed", version = 1): void {
      apply(state => { requireRule(state.users.some(user => user.id === userId), "USER_NOT_FOUND", "No se encontró el perfil."); const copy = clone(state); copy.revision++; copy.helpPreferences = copy.helpPreferences.filter(item => !(item.userId === userId && item.version === version)); copy.helpPreferences.push({ userId, status, version }); return { state: copy, result: undefined }; });
    },
  };
}
export type DemoRepository = ReturnType<typeof createDemoRepository>;
