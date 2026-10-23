import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { databaseRpc, hasDatabaseTransport } from '@/lib/supabase/database';
import { authFailureResponse, isSameOrigin, jsonResponse, readJson } from '@/lib/http';
import { guestError } from '@/lib/guest-practice';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Origen no permitido.' }, 403);
  let body: Record<string, unknown>;
  try {
    body = await readJson(request, 2048);
  } catch {
    return jsonResponse({ error: 'Solicitud inválida.' }, 400);
  }
  if (
    !['read', 'create', 'revoke'].includes(String(body.action)) ||
    typeof body.activityId !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(body.activityId)
  )
    return jsonResponse({ error: 'Elige una actividad propia.' }, 400);
  if (
    body.action === 'create' &&
    (typeof body.opensAt !== 'string' ||
      !Number.isFinite(Date.parse(body.opensAt)) ||
      typeof body.closesAt !== 'string' ||
      !Number.isFinite(Date.parse(body.closesAt)) ||
      !Number.isInteger(body.durationSeconds))
  )
    return jsonResponse({ error: 'Revisa las fechas y la duración.' }, 400);
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims.sub) return authFailureResponse(error);
    const result = hasDatabaseTransport()
      ? await databaseRpc('guestManage', data.claims.sub, [body.action, body])
      : await supabase.rpc('aulify_guest_manage', { p_action: body.action, p_payload: body });
    if (result.error) throw new Error(result.error.message);
    return jsonResponse({ link: result.data });
  } catch (error) {
    const failure = guestError(error);
    return jsonResponse({ error: failure.message }, failure.status);
  }
}
