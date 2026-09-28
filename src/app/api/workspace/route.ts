import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { authFailureResponse, jsonResponse } from '@/lib/http';

export async function GET(request: NextRequest) {
  const activityId = request.nextUrl.searchParams.get('activity');
  if (
    activityId !== null &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityId)
  )
    return jsonResponse({ error: 'Actividad no válida.' }, 400);
  const supabase = await createSupabaseServer();
  const { data: identity, error: identityError } = await supabase.auth.getClaims();
  if (identityError || !identity?.claims.sub) return authFailureResponse(identityError);
  const { data, error } = activityId
    ? await supabase.rpc('aulify_activity_snapshot', { p_activity_id: activityId })
    : await supabase.rpc('aulify_snapshot');
  if (error) {
    const forbidden = error.code === '42501';
    return jsonResponse(
      {
        error: forbidden
          ? 'Esta actividad ya no está disponible para tu cuenta.'
          : 'No pudimos abrir tu aula. Intenta de nuevo.',
      },
      forbidden ? 403 : 503,
    );
  }
  return jsonResponse(data);
}
