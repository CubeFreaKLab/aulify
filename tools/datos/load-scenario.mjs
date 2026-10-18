// Perfiles fijados antes de medir. El escenario histórico no se aprueba con la clase reducida.
export const CLASSROOM_SCENARIO = Object.freeze({
  id: 'classroom-30-v1',
  teachers: 1,
  students: 30,
  studentsPerClass: 30,
  questionsPerActivity: 10,
  warmupSeconds: 60,
  measurementSeconds: 120,
  warmupAnswerOffsetMs: 500,
  measurementAnswerOffsetMs: 1000,
  warmupSpreadMs: 3000,
  measurementSpreadMs: 6000,
  burstSpreadMs: 1900,
  burstWindowMs: 2000,
  maximumRuntimeMs: 12 * 60_000,
  defaultBudgetBytes: 150_000_000,
  maximumBudgetBytes: 150_000_000,
  minimumTokenLifetimeMs: 13 * 60_000,
});

export const LEGACY_SCENARIO = Object.freeze({
  id: 'legacy-200-v1',
  teachers: 4,
  students: 200,
  studentsPerClass: 50,
  questionsPerActivity: 10,
  warmupSeconds: 300,
  measurementSeconds: 900,
  warmupAnswerOffsetMs: 5000,
  measurementAnswerOffsetMs: 10000,
  warmupSpreadMs: 15000,
  measurementSpreadMs: 15000,
  burstSpreadMs: 1900,
  burstWindowMs: 2000,
  maximumRuntimeMs: 75 * 60_000,
  defaultBudgetBytes: 1_000_000_000,
  maximumBudgetBytes: 2_500_000_000,
  minimumTokenLifetimeMs: 50 * 60_000,
});

export function loadScenarioFromArgs(args) {
  const allowed = new Set(['--classroom', '--legacy-full-200', '--plan', '--sessions-only', '--diagnostic-individual']);
  if (args.some(arg => !allowed.has(arg))) throw new Error('Opción de carga desconocida. Consulta --help.');
  if (args.includes('--classroom') && args.includes('--legacy-full-200')) throw new Error('Seleccionar un solo escenario.');
  if (!args.includes('--classroom') && !args.includes('--legacy-full-200') && !args.includes('--plan'))
    throw new Error('Selecciona --classroom; el escenario histórico exige --legacy-full-200.');
  const scenario = args.includes('--legacy-full-200') ? LEGACY_SCENARIO : CLASSROOM_SCENARIO;
  if (args.includes('--sessions-only') && args.includes('--diagnostic-individual')) throw new Error('Seleccionar un solo modo.');
  if (scenario === CLASSROOM_SCENARIO && args.includes('--diagnostic-individual'))
    throw new Error('La clase reducida se comprueba en los dos modos; no admite el diagnóstico histórico.');
  return scenario;
}

export function selectLoadCohort(accounts, fixtures, scenario) {
  if (accounts?.projectRef !== 'bnqyyumfmyexsqszglab' || fixtures?.projectRef !== accounts.projectRef ||
      !Array.isArray(accounts.users) || !Array.isArray(fixtures.groups)) throw new Error('Proyecto o preparación incorrectos.');
  if (new Set(accounts.users.map(user => user.id)).size !== accounts.users.length ||
      new Set(fixtures.groups.map(group => group.group)).size !== fixtures.groups.length)
    throw new Error('Preparación con identidades o grupos duplicados.');
  const usersById = new Map(accounts.users.map(user => [user.id, user]));
  const groups = [...fixtures.groups].sort((a, b) => a.group - b.group).slice(0, scenario.teachers);
  if (groups.length !== scenario.teachers) throw new Error('Faltan materias preparadas.');
  const selectedUsers = [], selectedGroups = [];
  for (const group of groups) {
    const teacher = usersById.get(group.teacherId);
    const ids = group.students?.slice(0, scenario.studentsPerClass);
    if (!teacher || teacher.role !== 'teacher' || teacher.group !== group.group ||
        ids?.length !== scenario.studentsPerClass || new Set(group.students).size !== group.students.length ||
        group.questions?.length !== scenario.questionsPerActivity)
      throw new Error('Materia, docente, participantes o preguntas incompletos.');
    const students = ids.map(id => usersById.get(id));
    if (students.some(user => !user || user.role !== 'student' || user.group !== group.group))
      throw new Error('Participante ajeno al grupo o identidad inválida.');
    selectedUsers.push(teacher, ...students);
    selectedGroups.push({ ...group, students: ids });
  }
  if (new Set(selectedUsers.map(user => user.id)).size !== scenario.teachers + scenario.students)
    throw new Error('La cohorte no coincide con el escenario.');
  return { users: selectedUsers, groups: selectedGroups };
}

export function mergeLoadCookies(cached, sessions, savedAt) {
  const merged = { ...cached };
  for (const session of sessions) merged[session.id] = { cookies: Object.fromEntries(session.jar), savedAt };
  return merged;
}

export function measuredScenarioPassed(phases, scenario) {
  const measured = phases.filter(phase => phase.stage === 'measurement');
  return measured.length === 2 && ['individual', 'guided'].every(mode => {
    const phase = measured.find(phase => phase.mode === mode);
    return phase && phase.targetSeconds === scenario.measurementSeconds &&
      phase.criteria && Object.keys(phase.criteria).length === 7 && Object.values(phase.criteria).every(value => value === true);
  });
}
