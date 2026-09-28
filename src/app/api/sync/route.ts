import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { authFailureResponse, jsonResponse } from '@/lib/http';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('activity');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return jsonResponse({ error: 'Actividad no válida.' }, 400);
  const client = await createSupabaseServer();
  const { data, error: identityError } = await client.auth.getClaims();
  if (identityError || !data?.claims.sub) return authFailureResponse(identityError);
  const { data: revision, error } = await client.rpc('aulify_sync', { p_activity_id: id });
  if (error) {
    const forbidden = error.code === '42501';
    return jsonResponse(
      {
        error: forbidden
          ? 'Esta actividad ya no está disponible para tu cuenta.'
          : 'No pudimos actualizar la actividad en este momento. Se reintentará.',
      },
      forbidden ? 403 : 503,
    );
  }
  return jsonResponse(revision);
}
