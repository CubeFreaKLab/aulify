import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { jsonResponse } from '@/lib/http';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('activity');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return jsonResponse({ error: 'Actividad no válida.' }, 400);
  const client = await createSupabaseServer();
  const { data, error: identityError } = await client.auth.getClaims();
  if (identityError || !data?.claims.sub)
    return jsonResponse({ error: 'Tu sesión terminó. Vuelve a iniciar sesión.' }, 401);
  const { data: revision, error } = await client.rpc('aulify_sync', { p_activity_id: id });
  if (error)
    return jsonResponse({ error: 'Esta actividad ya no está disponible para tu cuenta.' }, 403);
  return jsonResponse(revision);
}
