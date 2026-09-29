import { editorLinkError, isAllowedEditorHref } from './editor-links';
import type {
  ActivitySettings,
  AnswerValue,
  Attempt,
  AttemptScore,
  Block,
  DemoState,
  Evaluation,
  Question,
  Rational,
  Resource,
  ResourceVersion,
} from './types';

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
export function requireRule(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
export const clone = <T>(value: T): T => structuredClone(value);
export function rational(numerator: number, denominator = 1): Rational {
  requireRule(
    Number.isSafeInteger(numerator) && Number.isSafeInteger(denominator) && denominator > 0,
    'INVALID_NUMBER',
    'El valor numérico está fuera del intervalo admitido.',
  );
  let a = Math.abs(numerator),
    b = denominator;
  while (b) [a, b] = [b, a % b];
  return { numerator: numerator / (a || 1), denominator: denominator / (a || 1) };
}
export function decimal(value: number): Rational {
  requireRule(
    Number.isFinite(value) && value >= 0,
    'INVALID_NUMBER',
    'El valor debe ser un número no negativo.',
  );
  const [coefficient, exponentText = '0'] = String(value).split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const exponent = Number(exponentText) - fraction.length;
  return rational(
    Number(whole + fraction) * 10 ** Math.max(exponent, 0),
    10 ** Math.max(-exponent, 0),
  );
}
export const add = (a: Rational, b: Rational): Rational =>
  rational(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
export const multiply = (a: Rational, b: Rational): Rational =>
  rational(a.numerator * b.numerator, a.denominator * b.denominator);
export const divide = (a: Rational, b: Rational): Rational => {
  requireRule(b.numerator > 0, 'ZERO_DIVISOR', 'El máximo debe ser positivo.');
  return rational(a.numerator * b.denominator, a.denominator * b.numerator);
};
export const numeric = (a: Rational): number => a.numerator / a.denominator;
export function roundHalfUp(value: Rational): number {
  const n = BigInt(value.numerator) * 100n,
    d = BigInt(value.denominator);
  return Number((n * 2n + d) / (d * 2n)) / 100;
}
const unique = (ids: string[]) => new Set(ids).size === ids.length;
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && unique(a) && a.every((id) => b.includes(id));
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
export const questionsOf = (version: Pick<ResourceVersion, 'blocks'>): Question[] =>
  version.blocks.flatMap((block) => (block.type === 'quiz' ? block.questions : []));

export function validateQuestion(question: Question): void {
  requireRule(
    nonEmpty(question.id) && nonEmpty(question.prompt) && question.points > 0,
    'INVALID_QUESTION',
    'Cada pregunta necesita una consigna y un valor positivo.',
  );
  decimal(question.points);
  const choices = (items: { id: string; text: string }[], min: number, max: number) =>
    requireRule(
      Array.isArray(items) &&
        items.length >= min &&
        items.length <= max &&
        items.every((item) => nonEmpty(item.id) && nonEmpty(item.text)) &&
        unique(items.map((item) => item.id)),
      'INVALID_OPTIONS',
      `Define entre ${min} y ${max} elementos con identificadores únicos.`,
    );
  switch (question.type) {
    case 'single':
      choices(question.options, 2, 8);
      requireRule(
        question.options.some((option) => option.id === question.correctOptionId),
        'INVALID_SOLUTION',
        'Selecciona la respuesta correcta.',
      );
      break;
    case 'multiple':
      choices(question.options, 2, 8);
      requireRule(
        Array.isArray(question.correctOptionIds) &&
          question.correctOptionIds.length > 0 &&
          unique(question.correctOptionIds) &&
          question.correctOptionIds.every((id) =>
            question.options.some((option) => option.id === id),
          ),
        'INVALID_SOLUTION',
        'Selecciona una o más respuestas correctas.',
      );
      break;
    case 'true-false':
      requireRule(
        typeof question.correct === 'boolean',
        'INVALID_SOLUTION',
        'Define si la respuesta es verdadera o falsa.',
      );
      break;
    case 'matching':
      choices(question.left, 2, 12);
      choices(question.right, 2, 12);
      requireRule(
        sameSet(
          Object.keys(question.pairs),
          question.left.map((item) => item.id),
        ) &&
          sameSet(
            Object.values(question.pairs),
            question.right.map((item) => item.id),
          ),
        'INVALID_SOLUTION',
        'Relaciona cada elemento una sola vez.',
      );
      break;
    case 'ordering':
      choices(question.items, 2, 12);
      requireRule(
        sameSet(
          question.correctOrder,
          question.items.map((item) => item.id),
        ),
        'INVALID_SOLUTION',
        'La secuencia debe incluir todos los elementos una sola vez.',
      );
      break;
    case 'fill-options':
    case 'fill-text':
      requireRule(
        nonEmpty(question.template) &&
          Array.isArray(question.blanks) &&
          question.blanks.length >= 1 &&
          question.blanks.length <= 10 &&
          unique(question.blanks.map((blank) => blank.id)),
        'INVALID_BLANKS',
        'Define entre uno y diez espacios.',
      );
      question.blanks.forEach((blank) => {
        requireRule(
          question.template.includes(`{${blank.id}}`),
          'INVALID_BLANKS',
          'Incluye cada espacio en la frase, con su identificador entre llaves.',
        );
        if ('options' in blank) {
          choices(blank.options, 2, 8);
          requireRule(
            blank.options.some((option) => option.id === blank.correctOptionId),
            'INVALID_SOLUTION',
            'Define la opción correcta de cada espacio.',
          );
        }
      });
      if (question.type === 'fill-text')
        requireRule(
          question.manual === true,
          'WRITING_IS_MANUAL',
          'Las respuestas escritas requieren revisión docente.',
        );
      break;
    case 'open':
      requireRule(
        question.manual === true && nonEmpty(question.manualGuide),
        'WRITING_IS_MANUAL',
        'Añade una guía privada para la revisión manual.',
      );
      break;
    default:
      throw new DomainError('INVALID_QUESTION', 'El tipo de pregunta no es válido.');
  }
}
export function validateBlocks(blocks: Block[]): void {
  requireRule(
    Array.isArray(blocks) &&
      blocks.length > 0 &&
      blocks.length <= 200 &&
      unique(blocks.map((block) => block.id)),
    'INVALID_BLOCKS',
    'El recurso debe contener entre uno y 200 bloques con identificadores únicos.',
  );
  requireRule(
    blocks.filter((block) => block.type === 'quiz').length <= 1,
    'ONE_QUIZ',
    'Organiza cada quiz en un recurso independiente.',
  );
  for (const block of blocks) {
    requireRule(nonEmpty(block.id), 'INVALID_BLOCK', 'El bloque necesita un identificador.');
    switch (block.type) {
      case 'heading':
        requireRule(
          [2, 3].includes(block.level) && nonEmpty(block.text),
          'INVALID_BLOCK',
          'Completa el título del bloque.',
        );
        break;
      case 'text':
        requireRule(nonEmpty(block.text), 'INVALID_BLOCK', 'Completa la explicación del bloque.');
        break;
      case 'list':
        requireRule(
          Array.isArray(block.items) && block.items.length > 0 && block.items.every(nonEmpty),
          'INVALID_BLOCK',
          'Completa los elementos de la lista.',
        );
        break;
      case 'image':
        requireRule(
          nonEmpty(block.alt) && safeImageUrl(block.url),
          'INVALID_IMAGE',
          'La imagen necesita una dirección válida y texto alternativo.',
        );
        break;
      case 'video':
        requireRule(
          nonEmpty(block.title) && /^https:\/\//i.test(block.url),
          'INVALID_VIDEO',
          'El video necesita un título y un enlace HTTPS.',
        );
        break;
      case 'quiz':
        requireRule(
          Array.isArray(block.questions) &&
            block.questions.length >= 1 &&
            block.questions.length <= 100 &&
            unique(block.questions.map((question) => question.id)),
          'INVALID_QUIZ',
          'El quiz necesita entre una y 100 preguntas únicas.',
        );
        block.questions.forEach(validateQuestion);
        break;
      default:
        throw new DomainError('INVALID_BLOCK', 'El tipo de bloque no es válido.');
    }
  }
}
export function safeImageUrl(url: string): boolean {
  return (
    typeof url === 'string' &&
    (/^https:\/\//i.test(url) ||
      /^\/(?!\/)/.test(url) ||
      /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(url))
  );
}
export function validateEditorDocument(value: unknown): void {
  if (value === undefined) return;
  requireRule(
    Array.isArray(value),
    'INVALID_EDITOR_DOCUMENT',
    'El documento del editor no es válido.',
  );
  // Only ancestors indicate a cycle; editors can reuse styles and props between sibling blocks.
  const activePath = new WeakSet<object>();
  function inspect(item: unknown, depth: number): void {
    requireRule(
      depth <= 30,
      'INVALID_EDITOR_DOCUMENT',
      'El documento tiene demasiados niveles de contenido.',
    );
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number') {
      requireRule(
        Number.isFinite(item),
        'INVALID_EDITOR_DOCUMENT',
        'El documento contiene un número inválido.',
      );
      return;
    }
    requireRule(
      typeof item === 'object' && item !== null,
      'INVALID_EDITOR_DOCUMENT',
      'El documento contiene un valor no compatible con JSON.',
    );
    requireRule(
      !activePath.has(item),
      'INVALID_EDITOR_DOCUMENT',
      'El documento debe ser serializable sin referencias circulares.',
    );
    activePath.add(item);
    for (const [key, nested] of Object.entries(item)) {
      if (key === 'href')
        requireRule(isAllowedEditorHref(nested), 'INVALID_EDITOR_LINK', editorLinkError);
      requireRule(
        !['correctOptionId', 'correctOptionIds', 'correctOrder', 'manualGuide'].includes(key),
        'PRIVATE_EDITOR_CONTENT',
        'Las soluciones privadas deben permanecer fuera del documento del editor.',
      );
      inspect(nested, depth + 1);
    }
    activePath.delete(item);
  }
  inspect(value, 0);
  requireRule(
    new TextEncoder().encode(JSON.stringify(value)).length <= 5 * 1024 * 1024,
    'EDITOR_DOCUMENT_LIMIT',
    'El contenido del editor supera los 5 MiB.',
  );
}
export function validateResource(resource: Pick<Resource, 'title' | 'blocks' | 'kind'>): void {
  requireRule(
    nonEmpty(resource.title) && resource.title.length <= 120,
    'INVALID_TITLE',
    'Escribe un título de hasta 120 caracteres.',
  );
  validateBlocks(resource.blocks);
  if (resource.kind === 'quiz')
    requireRule(
      questionsOf(resource).length > 0,
      'INVALID_QUIZ',
      'Un quiz independiente necesita preguntas.',
    );
}
export function validateSettings(settings: ActivitySettings): void {
  requireRule(
    ['practice', 'exam'].includes(settings.purpose) &&
      ['individual', 'guided'].includes(settings.pace) &&
      ['immediate', 'after-close', 'hidden'].includes(settings.feedback),
    'INVALID_SETTINGS',
    'Revisa el propósito, ritmo y retroalimentación.',
  );
  requireRule(
    settings.maxGrade > 0 &&
      settings.weight > 0 &&
      Number.isInteger(settings.maxAttempts) &&
      settings.maxAttempts > 0,
    'INVALID_SETTINGS',
    'El máximo, peso e intentos deben ser positivos.',
  );
  decimal(settings.maxGrade);
  decimal(settings.weight);
  requireRule(
    Number.isFinite(Date.parse(settings.opensAt)) &&
      Number.isFinite(Date.parse(settings.closesAt)) &&
      Date.parse(settings.opensAt) < Date.parse(settings.closesAt),
    'INVALID_DATES',
    'El cierre debe ser posterior a la apertura.',
  );
  requireRule(
    settings.timeLimitMinutes === null ||
      (Number.isFinite(settings.timeLimitMinutes) && settings.timeLimitMinutes > 0),
    'INVALID_DURATION',
    'El tiempo debe estar desactivado o ser positivo.',
  );
  try {
    new Intl.DateTimeFormat('es', { timeZone: settings.timeZone });
  } catch {
    throw new DomainError('INVALID_TIME_ZONE', 'Selecciona una zona horaria válida.');
  }
  requireRule(
    settings.pace !== 'guided' || (settings.maxAttempts === 1 && !settings.shuffleQuestions),
    'GUIDED_SETTINGS',
    'El ritmo guiado utiliza un intento y el mismo orden de preguntas.',
  );
  requireRule(
    settings.feedback !== 'hidden' || (!settings.streaks && !settings.ranking),
    'HIDDEN_FEEDBACK',
    'Desactiva rachas y clasificación cuando los aciertos permanezcan ocultos.',
  );
}
export function validateAnswer(question: Question, answer: AnswerValue): void {
  requireRule(
    answer.type === question.type,
    'ANSWER_TYPE',
    'La respuesta no corresponde al tipo de pregunta.',
  );
  switch (answer.type) {
    case 'single':
      requireRule(
        question.type === 'single' &&
          question.options.some((option) => option.id === answer.optionId),
        'INVALID_ANSWER',
        'Selecciona una opción válida.',
      );
      break;
    case 'multiple':
      requireRule(
        question.type === 'multiple' &&
          answer.optionIds.length > 0 &&
          unique(answer.optionIds) &&
          answer.optionIds.every((id) => question.options.some((option) => option.id === id)),
        'INVALID_ANSWER',
        'Selecciona opciones válidas sin repetirlas.',
      );
      break;
    case 'true-false':
      requireRule(
        typeof answer.value === 'boolean',
        'INVALID_ANSWER',
        'Selecciona verdadero o falso.',
      );
      break;
    case 'matching':
      requireRule(
        question.type === 'matching' &&
          sameSet(
            Object.keys(answer.pairs),
            question.left.map((item) => item.id),
          ) &&
          Object.values(answer.pairs).every((id) => question.right.some((item) => item.id === id)),
        'INVALID_ANSWER',
        'Elige una relación válida para cada elemento.',
      );
      break;
    case 'ordering':
      requireRule(
        question.type === 'ordering' &&
          sameSet(
            answer.itemIds,
            question.items.map((item) => item.id),
          ),
        'INVALID_ANSWER',
        'Ordena todos los elementos una sola vez.',
      );
      break;
    case 'fill-options':
      requireRule(
        question.type === 'fill-options' &&
          sameSet(
            Object.keys(answer.choices),
            question.blanks.map((blank) => blank.id),
          ) &&
          question.blanks.every((blank) =>
            blank.options.some((option) => option.id === answer.choices[blank.id]),
          ),
        'INVALID_ANSWER',
        'Selecciona una opción válida en cada espacio.',
      );
      break;
    case 'fill-text':
      requireRule(
        question.type === 'fill-text' &&
          sameSet(
            Object.keys(answer.texts),
            question.blanks.map((blank) => blank.id),
          ) &&
          Object.values(answer.texts).every((text) => nonEmpty(text) && text.length <= 5000),
        'INVALID_ANSWER',
        'Completa cada espacio con hasta 5.000 caracteres.',
      );
      break;
    case 'open':
      requireRule(
        nonEmpty(answer.text) && answer.text.length <= 5000,
        'INVALID_ANSWER',
        'Escribe una respuesta de hasta 5.000 caracteres.',
      );
      break;
  }
}
export function scoreQuestion(
  question: Question,
  answer: AnswerValue,
  forceManual = false,
): Rational | null {
  validateAnswer(question, answer);
  if (forceManual || question.manual) return null;
  let correct = 0,
    total = 1;
  if (question.type === 'single' && answer.type === 'single')
    correct = Number(question.correctOptionId === answer.optionId);
  if (question.type === 'multiple' && answer.type === 'multiple')
    correct = Number(sameSet(question.correctOptionIds, answer.optionIds));
  if (question.type === 'true-false' && answer.type === 'true-false')
    correct = Number(question.correct === answer.value);
  if (question.type === 'matching' && answer.type === 'matching') {
    total = question.left.length;
    correct = question.left.filter(
      (item) => question.pairs[item.id] === answer.pairs[item.id],
    ).length;
  }
  if (question.type === 'ordering' && answer.type === 'ordering') {
    total = question.items.length;
    correct = question.correctOrder.filter((id, i) => id === answer.itemIds[i]).length;
  }
  if (question.type === 'fill-options' && answer.type === 'fill-options') {
    total = question.blanks.length;
    correct = question.blanks.filter(
      (blank) => blank.correctOptionId === answer.choices[blank.id],
    ).length;
  }
  return multiply(decimal(question.points), rational(correct, total));
}
export function scoreAttempt(state: DemoState, attempt: Attempt): AttemptScore {
  const activity = state.activities.find((item) => item.id === attempt.activityId);
  const version = state.versions.find((item) => item.id === attempt.versionId);
  requireRule(activity && version, 'MISSING_REFERENCE', 'No se encontró la actividad del intento.');
  let base = rational(0),
    bonus = rational(0),
    maximum = rational(0),
    pending = 0;
  for (const question of questionsOf(version)) {
    maximum = add(maximum, decimal(question.points));
    const answer = attempt.answers.find((item) => item.questionId === question.id);
    if (!answer) continue;
    const latest = answer.reviews.at(-1);
    if (!latest) {
      pending++;
      continue;
    }
    base = add(base, latest.points);
    if (answer.usedDouble) bonus = add(bonus, latest.points);
  }
  const administrative = ['removed', 'archived', 'teacher-ended'].includes(
    attempt.closeReason ?? '',
  );
  const complete =
    attempt.status === 'closed' &&
    pending === 0 &&
    attempt.resolution !== 'exclude' &&
    (!administrative || attempt.resolution === 'evaluate');
  const counted = activity.settings.bonusAffectsGrade ? add(base, bonus) : base;
  const grade = complete
    ? Math.min(
        activity.settings.maxGrade,
        roundHalfUp(multiply(divide(counted, maximum), decimal(activity.settings.maxGrade))),
      )
    : null;
  return {
    basePoints: numeric(base),
    bonusPoints: numeric(bonus),
    gamePoints: numeric(add(base, bonus)),
    maximumPoints: numeric(maximum),
    pending,
    complete,
    grade,
  };
}
export function calculateAverage(evaluations: Evaluation[]): number | null {
  const latest = new Map<string, Evaluation>();
  for (const evaluation of evaluations) {
    const key = `${evaluation.studentId}/${evaluation.activityId}`;
    if ((latest.get(key)?.revision ?? 0) < evaluation.revision) latest.set(key, evaluation);
  }
  let weighted = rational(0),
    weights = rational(0);
  for (const item of latest.values()) {
    if (!item.publishedAt || !item.countsTowardAverage) continue;
    requireRule(
      item.grade >= 0 && item.grade <= item.maxGrade && item.maxGrade > 0 && item.weight > 0,
      'INVALID_EVALUATION',
      'La calificación publicada no es válida.',
    );
    const weight = decimal(item.weight);
    weighted = add(weighted, multiply(divide(decimal(item.grade), decimal(item.maxGrade)), weight));
    weights = add(weights, weight);
  }
  return weights.numerator ? roundHalfUp(multiply(divide(weighted, weights), rational(100))) : null;
}
