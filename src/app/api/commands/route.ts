import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { authFailureResponse, isSameOrigin, jsonResponse, readJson } from '@/lib/http';
import { commandError } from '@/lib/command-errors';
import { classifyRpcFailure, logRpcFailure } from '@/lib/rpc-failure';
import { responseTiming } from '@/lib/response-timing';

function rpcFailureResponse(error: unknown, durationMs: number, upstreamStatus?: number) {
  const failure = classifyRpcFailure(error, upstreamStatus);
  logRpcFailure(failure, durationMs);
  const message =
    failure.status === 503
      ? 'No pudimos confirmar el cambio. Espera unos segundos y actualiza la página para comprobar su estado.'
      : failure.status === 401
        ? commandError('AUTH_REQUIRED')
        : failure.status === 403
          ? commandError('FORBIDDEN')
          : failure.status === 400 && error && typeof error === 'object' && 'message' in error
            ? commandError(String(error.message))
            : 'No pudimos completar el cambio. Actualiza la página para comprobar su estado.';
  const response = jsonResponse({ error: message }, failure.status);
  if (failure.status === 503) response.headers.set('Retry-After', '30');
  return response;
}

const actions = new Set([
  'saveDraft',
  'publishResource',
  'publishReading',
  'publishEvaluation',
  'recordNonparticipation',
  'autoTeams',
  'createActivity',
  'updateActivity',
  'createSubject',
  'requestMembership',
  'decideMembership',
  'joinGuidedRoom',
  'startGuidedSession',
  'closeGuidedQuestion',
  'openNextGuidedQuestion',
  'startAttempt',
  'submitAnswer',
  'useHint',
  'reviewAnswer',
  'publishGrade',
  'createTask',
  'submitTask',
  'reviewTask',
  'publishTaskGrade',
  'setHelpPreference',
  'readActivity',
  'readAttempt',
  'updateSubject',
  'renewCode',
  'withdrawMembership',
  'archiveSubject',
  'restoreSubject',
  'resolveAttempt',
  'extendDeadline',
  'endGuidedSession',
  'configureTeams',
  'createManualActivity',
  'gradeManual',
  'allowResubmission',
  'reportVisibility',
  'reviewIncident',
  'ranking',
]);

export async function POST(request: NextRequest) {
  const handlerStartedAt = performance.now();
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Origen de solicitud no válido.' }, 403);
  try {
    const body = await readJson(request, 2_097_152);
    if (
      typeof body.action !== 'string' ||
      !actions.has(body.action) ||
      !Array.isArray(body.args) ||
      body.args.length > 10
    )
      return jsonResponse({ error: 'Acción no válida.' }, 400);
    const supabase = await createSupabaseServer();
    const { data: identity, error: identityError } = await supabase.auth.getClaims();
    if (identityError || !identity?.claims.sub) return authFailureResponse(identityError);
    const startedAt = performance.now();
    let result;
    try {
      result = await supabase.rpc('aulify_command', {
        p_action: body.action,
        p_payload: { args: body.args },
      });
    } catch (error) {
      return rpcFailureResponse(error, performance.now() - startedAt);
    }
    const { data, error, status } = result;
    const rpcEndedAt = performance.now();
    if (error) return rpcFailureResponse(error, performance.now() - startedAt, status);
    if (data?.error)
      return jsonResponse(
        { error: commandError(data.error.code || '') },
        data.error.code === 'RATE_LIMIT' ? 429 : 400,
      );
    return responseTiming(jsonResponse({ result: data }), handlerStartedAt, startedAt, rpcEndedAt);
  } catch {
    return jsonResponse({ error: 'No pudimos procesar la solicitud.' }, 400);
  }
}
