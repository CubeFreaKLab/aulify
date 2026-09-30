import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { authFailureResponse, jsonResponse } from '@/lib/http';
import { readRpcFailureResponse } from '@/lib/rpc-failure';
import { responseTiming } from '@/lib/response-timing';

export async function GET(request: NextRequest) {
  const handlerStartedAt = performance.now();
  const activityId = request.nextUrl.searchParams.get('activity');
  if (
    activityId !== null &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityId)
  )
    return jsonResponse({ error: 'Actividad no válida.' }, 400);
  const supabase = await createSupabaseServer();
  const { data: identity, error: identityError } = await supabase.auth.getClaims();
  if (identityError || !identity?.claims.sub) return authFailureResponse(identityError);
  const startedAt = performance.now();
  try {
    const { data, error, status } = activityId
      ? await supabase.rpc('aulify_activity_snapshot', { p_activity_id: activityId })
      : await supabase.rpc('aulify_workspace_overview');
    const rpcEndedAt = performance.now();
    if (error)
      return readRpcFailureResponse('workspace', error, performance.now() - startedAt, status);
    return responseTiming(jsonResponse(data), handlerStartedAt, startedAt, rpcEndedAt);
  } catch (error) {
    return readRpcFailureResponse('workspace', error, performance.now() - startedAt);
  }
}
