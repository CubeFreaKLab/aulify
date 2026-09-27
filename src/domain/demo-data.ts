import type { ActivitySettings, DemoState, Question } from './types';
import { startAttempt, submitAnswer } from './operations';

export const DEMO_IDS = {
  teacher: 'teacher-elena',
  student: 'student-camila',
  otherStudent: 'student-mateo',
  pendingStudent: 'student-lucia',
  subject: 'subject-biology',
  resource: 'resource-ecosystems',
  version: 'version-ecosystems-1',
  activity: 'activity-ecosystems',
  task: 'task-ecosystems',
  pendingAttempt: 'attempt-mateo',
} as const;

export function defaultActivitySettings(
  now = new Date().toISOString(),
  purpose: 'practice' | 'exam' = 'practice',
): ActivitySettings {
  return {
    purpose,
    pace: 'individual',
    maxGrade: 100,
    weight: 1,
    countsTowardAverage: purpose === 'exam',
    maxAttempts: purpose === 'practice' ? 3 : 1,
    opensAt: new Date(Date.parse(now) - 3600000).toISOString(),
    closesAt: new Date(Date.parse(now) + 7 * 86400000).toISOString(),
    timeLimitMinutes: null,
    timeZone: 'America/La_Paz',
    feedback: purpose === 'practice' ? 'immediate' : 'after-close',
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
}

export function ecosystemQuestions(): Question[] {
  return [
    {
      id: 'question-producer',
      type: 'single',
      prompt: '¿Quién produce su propio alimento en este ecosistema?',
      points: 2,
      options: [
        { id: 'grass', text: 'El pasto' },
        { id: 'rabbit', text: 'El conejo' },
        { id: 'fox', text: 'El zorro' },
        { id: 'fungus', text: 'El hongo' },
      ],
      correctOptionId: 'grass',
      explanation:
        'Las plantas producen alimento mediante la fotosíntesis. Son la base de muchas cadenas alimentarias.',
      hint: 'Piensa en quién utiliza la luz del sol para obtener energía.',
    },
    {
      id: 'question-components',
      type: 'multiple',
      prompt: 'Selecciona los dos componentes no vivos de un ecosistema.',
      points: 2,
      options: [
        { id: 'water', text: 'Agua' },
        { id: 'tree', text: 'Árbol' },
        { id: 'sunlight', text: 'Luz solar' },
        { id: 'bird', text: 'Ave' },
      ],
      correctOptionIds: ['water', 'sunlight'],
      explanation:
        'El agua y la luz solar son factores abióticos: no tienen vida, pero permiten que exista.',
    },
    {
      id: 'question-energy',
      type: 'true-false',
      prompt: 'La energía pasa de los productores a los consumidores.',
      points: 1,
      correct: true,
      explanation: 'La energía se transfiere cuando un organismo se alimenta de otro.',
    },
    {
      id: 'question-roles',
      type: 'matching',
      prompt: 'Relaciona cada ser vivo con su función.',
      points: 3,
      left: [
        { id: 'plant', text: 'Planta' },
        { id: 'deer', text: 'Venado' },
        { id: 'mushroom', text: 'Hongo' },
      ],
      right: [
        { id: 'consumer', text: 'Consumidor' },
        { id: 'decomposer', text: 'Descomponedor' },
        { id: 'producer', text: 'Productor' },
      ],
      pairs: { plant: 'producer', deer: 'consumer', mushroom: 'decomposer' },
      explanation:
        'Las plantas producen; los animales consumen; los hongos ayudan a descomponer materia.',
    },
    {
      id: 'question-chain',
      type: 'ordering',
      prompt: 'Ordena la cadena alimentaria desde el origen de la energía.',
      points: 2,
      items: [
        { id: 'predator', text: 'Zorro' },
        { id: 'sun', text: 'Sol' },
        { id: 'herbivore', text: 'Conejo' },
        { id: 'vegetation', text: 'Pasto' },
      ],
      correctOrder: ['sun', 'vegetation', 'herbivore', 'predator'],
      explanation: 'Sol → pasto → conejo → zorro: cada eslabón recibe energía del anterior.',
    },
    {
      id: 'question-complete',
      type: 'fill-options',
      prompt: 'Completa la idea sobre los ecosistemas.',
      points: 2,
      template: 'Los factores {living} tienen vida y los factores {nonliving} no tienen vida.',
      blanks: [
        {
          id: 'living',
          options: [
            { id: 'biotic', text: 'bióticos' },
            { id: 'abiotic', text: 'abióticos' },
          ],
          correctOptionId: 'biotic',
        },
        {
          id: 'nonliving',
          options: [
            { id: 'biotic', text: 'bióticos' },
            { id: 'abiotic', text: 'abióticos' },
          ],
          correctOptionId: 'abiotic',
        },
      ],
      explanation: 'Biótico se refiere a los seres vivos; abiótico, a los componentes no vivos.',
    },
    {
      id: 'question-word',
      type: 'fill-text',
      prompt: 'Completa con tus propias palabras.',
      points: 2,
      manual: true,
      template: 'Cuidar el agua ayuda al ecosistema porque {reason}.',
      blanks: [{ id: 'reason', label: 'Tu explicación' }],
      manualGuide:
        'Valorar que relacione la disponibilidad de agua con las necesidades de seres vivos. No exigir coincidencia literal.',
    },
    {
      id: 'question-reflect',
      type: 'open',
      prompt: '¿Qué podría pasar si desaparecieran los productores? Explica una consecuencia.',
      points: 6,
      manual: true,
      manualGuide:
        'Hasta 3 puntos por relacionar productores y alimento/energía; hasta 3 por explicar una consecuencia coherente para consumidores.',
      hint: 'Observa qué organismos dependen de las plantas para alimentarse.',
    },
  ];
}

export function createDemoState(now = new Date().toISOString()): DemoState {
  const timestamp = new Date(Date.parse(now) - 2 * 3600000).toISOString();
  const blocks: DemoState['resources'][number]['blocks'] = [
    { id: 'block-heading', type: 'heading', text: 'Todo está conectado', level: 2 },
    {
      id: 'block-explanation',
      type: 'text',
      text: 'Un ecosistema está formado por seres vivos y por elementos como el agua, el suelo y la luz. Cada componente tiene un papel. Si uno cambia, los demás también pueden verse afectados.',
    },
    {
      id: 'block-list',
      type: 'list',
      ordered: false,
      items: [
        'Productores: transforman la energía del sol en alimento.',
        'Consumidores: se alimentan de otros seres vivos.',
        'Descomponedores: devuelven nutrientes al ambiente.',
      ],
    },
    { id: 'block-quiz', type: 'quiz', questions: ecosystemQuestions() },
  ];
  let state: DemoState = {
    schemaVersion: 1,
    revision: 0,
    users: [
      { id: DEMO_IDS.teacher, name: 'Elena Vargas', role: 'teacher', email: 'elena@example.test' },
      { id: DEMO_IDS.student, name: 'Camila Ríos', role: 'student', email: 'camila@example.test' },
      {
        id: DEMO_IDS.otherStudent,
        name: 'Mateo Torres',
        role: 'student',
        email: 'mateo@example.test',
      },
      {
        id: DEMO_IDS.pendingStudent,
        name: 'Lucía Flores',
        role: 'student',
        email: 'lucia@example.test',
      },
    ],
    subjects: [
      {
        id: DEMO_IDS.subject,
        ownerId: DEMO_IDS.teacher,
        name: 'Biología',
        course: '3° A',
        year: new Date(now).getUTCFullYear(),
        description: 'Exploramos los seres vivos y sus conexiones con el entorno.',
        code: 'B3A7K2RX',
        status: 'active',
      },
    ],
    memberships: [
      {
        id: 'membership-camila',
        subjectId: DEMO_IDS.subject,
        studentId: DEMO_IDS.student,
        status: 'approved',
        requestedAt: timestamp,
        decidedAt: timestamp,
      },
      {
        id: 'membership-mateo',
        subjectId: DEMO_IDS.subject,
        studentId: DEMO_IDS.otherStudent,
        status: 'approved',
        requestedAt: timestamp,
        decidedAt: timestamp,
      },
      {
        id: 'membership-lucia',
        subjectId: DEMO_IDS.subject,
        studentId: DEMO_IDS.pendingStudent,
        status: 'pending',
        requestedAt: timestamp,
      },
    ],
    resources: [
      {
        id: DEMO_IDS.resource,
        ownerId: DEMO_IDS.teacher,
        title: 'Ecosistemas: todo está conectado',
        kind: 'resource',
        blocks: structuredClone(blocks),
        revision: 1,
        updatedAt: timestamp,
      },
    ],
    versions: [
      {
        id: DEMO_IDS.version,
        resourceId: DEMO_IDS.resource,
        ownerId: DEMO_IDS.teacher,
        number: 1,
        title: 'Ecosistemas: todo está conectado',
        blocks: structuredClone(blocks),
        publishedAt: timestamp,
      },
    ],
    activities: [
      {
        id: DEMO_IDS.activity,
        subjectId: DEMO_IDS.subject,
        versionId: DEMO_IDS.version,
        title: 'Explora un ecosistema',
        settings: {
          ...defaultActivitySettings(now),
          allowHint: true,
          allowDouble: true,
          streaks: true,
          countsTowardAverage: true,
        },
        createdAt: timestamp,
      },
    ],
    attempts: [],
    powerups: [],
    evaluations: [],
    tasks: [
      {
        id: DEMO_IDS.task,
        subjectId: DEMO_IDS.subject,
        title: 'Un ecosistema cerca de ti',
        instructions:
          'Observa un jardín, una plaza o tu patio. Identifica tres seres vivos y dos factores abióticos. Comparte un dibujo o documento con tu explicación.',
        opensAt: timestamp,
        closesAt: new Date(Date.parse(now) + 5 * 86400000).toISOString(),
        maxGrade: 20,
        weight: 1,
        countsTowardAverage: true,
        allowLate: false,
      },
    ],
    submissions: [],
    manualActivities: [],
    helpPreferences: [],
  };
  const ctx = {
    now: new Date(Date.parse(now) - 1800000).toISOString(),
    actorId: DEMO_IDS.otherStudent,
    id: DEMO_IDS.pendingAttempt,
  };
  state = startAttempt(state, DEMO_IDS.activity, DEMO_IDS.otherStudent, ctx).state;
  const values: import('./types').AnswerValue[] = [
    { type: 'single', optionId: 'grass' },
    { type: 'multiple', optionIds: ['water', 'sunlight'] },
    { type: 'true-false', value: true },
    { type: 'matching', pairs: { plant: 'producer', deer: 'consumer', mushroom: 'decomposer' } },
    { type: 'ordering', itemIds: ['sun', 'vegetation', 'herbivore', 'predator'] },
    { type: 'fill-options', choices: { living: 'biotic', nonliving: 'abiotic' } },
    { type: 'fill-text', texts: { reason: 'todos los seres vivos la necesitan para vivir' } },
    {
      type: 'open',
      text: 'Los conejos se quedarían sin plantas para comer y los zorros tendrían menos alimento. La cadena perdería su fuente de energía.',
    },
  ];
  ecosystemQuestions().forEach((question, index) => {
    state = submitAnswer(
      state,
      DEMO_IDS.pendingAttempt,
      question.id,
      values[index],
      `seed-mateo-${index}`,
      false,
      ctx,
    ).state;
  });
  return state;
}
