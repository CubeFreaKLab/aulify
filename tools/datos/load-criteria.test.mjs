import assert from 'node:assert/strict';
import test from 'node:test';
import {loadCriteria} from './load-criteria.mjs';
const complete = () => ({mode:'guided', stage:'measurement', targetSeconds:900, elapsedSeconds:900, successfulAcknowledgementSamples:2000, observedConfirmationSamples:2000, unsentAnswers:0, unconfirmedAnswers:0, unobservedConfirmations:0, confirmationP95Ms:1500, observedPropagationSamples:2000, propagationP95Ms:2000, failureRate:0.0099, integrity:{confirmedAnswers:2000,persistedAnswers:2000,missingOrChangedConfirmed:0,duplicateQuestions:0}, observedResultSamples:200, unobservedResults:0, burst:{dispatched:200,windowMs:2000}});
test('Acepta únicamente el escenario completo en los límites definidos',()=>assert.ok(Object.values(loadCriteria(complete())).every(Boolean)));
test('Una muestra rápida no oculta respuestas o propagaciones ausentes',()=>{
  for(const delta of [{successfulAcknowledgementSamples:1999},{observedConfirmationSamples:1999},{unconfirmedAnswers:1},{unsentAnswers:1},{observedPropagationSamples:1999},{observedResultSamples:199},{unobservedResults:1}]) assert.ok(Object.values(loadCriteria({...complete(),...delta})).includes(false));
});
test('Rechaza pérdida, duplicación, demora, ráfaga o duración fuera del criterio',()=>{
  for(const delta of [{failureRate:0.01},{confirmationP95Ms:1500.01},{propagationP95Ms:2000.01},{elapsedSeconds:899.99},{interrupted:true},{burst:{dispatched:199,windowMs:1900}},{burst:{dispatched:200,windowMs:2001}},{integrity:{...complete().integrity,missingOrChangedConfirmed:1}},{integrity:{...complete().integrity,duplicateQuestions:1}},{integrity:{...complete().integrity,confirmedAnswers:1999}}]) assert.ok(Object.values(loadCriteria({...complete(),...delta})).includes(false));
});
