import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { authFailureResponse, jsonResponse } from '@/lib/http';
import { readRpcFailureResponse } from '@/lib/rpc-failure';
import { responseTiming } from '@/lib/response-timing';

export async function GET(request: NextRequest) {
  const handlerStartedAt = performance.now();
  const id = request.nextUrl.searchParams.get('activity');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return jsonResponse({ error: 'Actividad no válida.' }, 400);
  const client = await createSupabaseServer();
  const { data, error: identityError } = await client.auth.getClaims();
  if (identityError || !data?.claims.sub) return authFailureResponse(identityError);
  const startedAt = performance.now();
  try {
    const {
      data: revision,
      error,
      status,
    } = await client.rpc('aulify_sync', { p_activity_id: id });
    const rpcEndedAt = performance.now();
    if (error) return readRpcFailureResponse('sync', error, performance.now() - startedAt, status);
    return responseTiming(jsonResponse(revision), handlerStartedAt, startedAt, rpcEndedAt);
  } catch (error) {
    return readRpcFailureResponse('sync', error, performance.now() - startedAt);
  }
}
