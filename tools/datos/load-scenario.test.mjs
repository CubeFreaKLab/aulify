import assert from 'node:assert/strict';
import test from 'node:test';
import { CLASSROOM_SCENARIO as classroom, LEGACY_SCENARIO as legacy, loadScenarioFromArgs, selectLoadCohort, mergeLoadCookies, measuredScenarioPassed } from './load-scenario.mjs';
import { loadCriteria } from './load-criteria.mjs';

function fixture() {
  const users = [], groups = [];
  for (let group = 0; group < 4; group++) {
    const teacherId = `teacher-${group}`;
    users.push({ id: teacherId, role: 'teacher', group });
    const students = Array.from({ length: 50 }, (_, index) => `student-${group}-${index}`);
    users.push(...students.map(id => ({ id, role: 'student', group })));
    groups.push({ group, teacherId, students, questions: Array.from({ length: 10 }, (_, id) => ({ id })) });
  }
  return { accounts: { projectRef: 'bnqyyumfmyexsqszglab', users }, fixtures: { projectRef: 'bnqyyumfmyexsqszglab', groups } };
}
const complete = () => ({ mode: 'guided', stage: 'measurement', targetSeconds: 120, elapsedSeconds: 120,
  successfulAcknowledgementSamples: 300, observedConfirmationSamples: 300, unsentAnswers: 0,
  unconfirmedAnswers: 0, unobservedConfirmations: 0, confirmationP95Ms: 1500,
  observedPropagationSamples: 300, propagationP95Ms: 2000, failureRate: 0,
  integrity: { confirmedAnswers: 300, persistedAnswers: 300, missingOrChangedConfirmed: 0, duplicateQuestions: 0 },
  observedResultSamples: 30, unobservedResults: 0, publicationFailures: 0, burst: { dispatched: 30, windowMs: 1900 } });

test('La clase de 30 es explícita y el escenario histórico no se activa por omisión', () => {
  assert.equal(loadScenarioFromArgs(['--classroom']), classroom);
  assert.equal(loadScenarioFromArgs(['--plan']), classroom);
  assert.equal(loadScenarioFromArgs(['--legacy-full-200']), legacy);
  for (const args of [[], ['--classroom', '--legacy-full-200'], ['--students=100'], ['--classroom', '--diagnostic-individual']])
    assert.throws(() => loadScenarioFromArgs(args));
});

test('Selecciona un docente y 30 integrantes sin borrar ni modificar el escenario anterior', () => {
  const { accounts, fixtures } = fixture(), before = JSON.stringify({ accounts, fixtures });
  const cohort = selectLoadCohort(accounts, fixtures, classroom);
  assert.equal(cohort.users.length, 31);
  assert.equal(cohort.groups.length, 1);
  assert.equal(cohort.groups[0].students.length, 30);
  assert.equal(cohort.users.filter(user => user.role === 'teacher').length, 1);
  assert.equal(JSON.stringify({ accounts, fixtures }), before);
  assert.equal(selectLoadCohort(accounts, fixtures, legacy).users.length, 204);
});

test('Rechaza proyecto, grupo, pertenencia o identidades inconsistentes antes de medir', () => {
  const invalid = [
    ({ accounts }) => { accounts.projectRef = 'otro'; },
    ({ fixtures }) => { fixtures.groups[0].students[1] = fixtures.groups[0].students[0]; },
    ({ fixtures }) => { fixtures.groups[0].students[0] = 'student-1-0'; },
    ({ accounts }) => { accounts.users[0].role = 'student'; },
    ({ fixtures }) => { fixtures.groups[0].questions.pop(); },
    ({ accounts }) => { accounts.users[1].id = accounts.users[0].id; },
  ];
  for (const mutate of invalid) {
    const data = fixture(); mutate(data);
    assert.throws(() => selectLoadCohort(data.accounts, data.fixtures, classroom));
  }
});

test('Renovar la clase conserva las cookies de las otras 173 identidades', () => {
  const { accounts, fixtures } = fixture();
  const cached = Object.fromEntries(accounts.users.map(user => [user.id, { cookies: { old: user.id } }]));
  const sessions = selectLoadCohort(accounts, fixtures, classroom).users.map(user => ({ ...user, jar: new Map([['new', 'ficticio']]) }));
  const merged = mergeLoadCookies(cached, sessions, '2026-10-17T00:00:00Z');
  assert.equal(Object.keys(merged).length, 204);
  assert.deepEqual(merged['student-1-0'], cached['student-1-0']);
  assert.deepEqual(merged['student-0-0'].cookies, { new: 'ficticio' });
  assert.deepEqual(cached['student-0-0'].cookies, { old: 'student-0-0' });
});

test('Exige 300 respuestas, 30 notas y los mismos límites; no aprueba el protocolo de 200', () => {
  assert.ok(Object.values(loadCriteria(complete(), classroom)).every(Boolean));
  assert.ok(Object.values(loadCriteria(complete(), legacy)).includes(false));
  for (const delta of [{ observedConfirmationSamples: 299 }, { observedResultSamples: 29 },
    { failureRate: 0.01 }, { confirmationP95Ms: 1500.01 }, { propagationP95Ms: 2000.01 },
    { unconfirmedAnswers: 1 }, { publicationFailures: 1 }, { burst: { dispatched: 29, windowMs: 1900 } }])
    assert.ok(Object.values(loadCriteria({ ...complete(), ...delta }, classroom)).includes(false));
});

test('Una ejecución vacía, incompleta o de un solo modo nunca se declara aprobada', () => {
  const phase = { ...complete(), criteria: loadCriteria(complete(), classroom) };
  assert.equal(measuredScenarioPassed([], classroom), false);
  assert.equal(measuredScenarioPassed([phase], classroom), false);
  assert.equal(measuredScenarioPassed([phase, phase], classroom), false);
  assert.equal(measuredScenarioPassed([phase, { ...phase, mode: 'individual', criteria: {} }], classroom), false);
  assert.equal(measuredScenarioPassed([phase, { ...phase, mode: 'individual' }], classroom), true);
});
