// Criterios completos: ningún percentil compensa muestras o respuestas faltantes.
export function loadCriteria(current) {
  const complete = current.successfulAcknowledgementSamples === 2000 &&
    current.observedConfirmationSamples === 2000 && current.unsentAnswers === 0 &&
    current.unconfirmedAnswers === 0 && current.unobservedConfirmations === 0;
  return {
    durationCompleted: current.elapsedSeconds >= current.targetSeconds && !current.interrupted,
    confirmationP95: complete && current.confirmationP95Ms !== null && current.confirmationP95Ms <= 1500,
    propagationP95: current.mode !== 'guided' || current.observedPropagationSamples === 2000 && current.propagationP95Ms !== null && current.propagationP95Ms <= 2000,
    validRequestFailureRate: current.failureRate !== null && current.failureRate < 0.01,
    integrity: current.integrity?.confirmedAnswers === 2000 && current.integrity?.persistedAnswers === 2000 && current.integrity?.missingOrChangedConfirmed === 0 && current.integrity?.duplicateQuestions === 0,
    publishedResults: current.observedResultSamples === 200 && (current.unobservedResults || 0) === 0,
    burst: current.stage !== 'measurement' || current.burst?.dispatched === 200 && current.burst.windowMs <= 2000,
  };
}
