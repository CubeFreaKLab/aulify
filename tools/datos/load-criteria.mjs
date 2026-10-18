// Criterios completos: ningún percentil compensa muestras o respuestas faltantes.
export function loadCriteria(current, scenario = { students: 200, questionsPerActivity: 10 }) {
  if (!Number.isSafeInteger(scenario.students) || scenario.students < 1 ||
      !Number.isSafeInteger(scenario.questionsPerActivity) || scenario.questionsPerActivity < 1)
    throw new Error('Escenario de carga inválido.');
  const expectedAnswers = scenario.students * scenario.questionsPerActivity;
  const complete = current.successfulAcknowledgementSamples === expectedAnswers &&
    current.observedConfirmationSamples === expectedAnswers && current.unsentAnswers === 0 &&
    current.unconfirmedAnswers === 0 && current.unobservedConfirmations === 0;
  return {
    durationCompleted: current.elapsedSeconds >= current.targetSeconds && !current.interrupted,
    confirmationP95: complete && current.confirmationP95Ms !== null && current.confirmationP95Ms <= 1500,
    propagationP95: current.mode !== 'guided' || current.observedPropagationSamples === expectedAnswers && current.propagationP95Ms !== null && current.propagationP95Ms <= 2000,
    validRequestFailureRate: current.failureRate !== null && current.failureRate < 0.01,
    integrity: current.integrity?.confirmedAnswers === expectedAnswers && current.integrity?.persistedAnswers === expectedAnswers && current.integrity?.missingOrChangedConfirmed === 0 && current.integrity?.duplicateQuestions === 0,
    publishedResults: current.observedResultSamples === scenario.students && (current.unobservedResults || 0) === 0 && (current.publicationFailures || 0) === 0,
    burst: current.stage !== 'measurement' || current.burst?.dispatched === scenario.students && current.burst.windowMs <= 2000,
  };
}
