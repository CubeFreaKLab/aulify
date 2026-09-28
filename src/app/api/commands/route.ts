import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { isSameOrigin, jsonResponse, readJson } from '@/lib/http';
import { commandError } from '@/lib/command-errors';

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
    const { data: identity, error: identityError } = await supabase.auth.getUser();
    if (identityError || !identity.user)
      return jsonResponse({ error: 'Tu sesión terminó. Vuelve a iniciar sesión.' }, 401);
    const { data, error } = await supabase.rpc('aulify_command', {
      p_action: body.action,
      p_payload: { args: body.args },
    });
    if (data?.error)
      return jsonResponse(
        { error: commandError(data.error.code || '') },
        data.error.code === 'RATE_LIMIT' ? 429 : 400,
      );
    if (error)
      return jsonResponse(
        {
          error: commandError(
            error.code === 'P0001' ? error.message : error.code === '42501' ? 'FORBIDDEN' : '',
          ),
        },
        error.code === '42501' ? 403 : 400,
      );
    return jsonResponse({ result: data });
  } catch {
    return jsonResponse({ error: 'No pudimos procesar la solicitud.' }, 400);
  }
}
