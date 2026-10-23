import { createSupabaseServer } from '@/lib/supabase/server';
import { databaseRpc, hasDatabaseTransport } from '@/lib/supabase/database';
import { authFailureResponse, jsonResponse } from '@/lib/http';

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims.sub) return authFailureResponse(error);
    const result = hasDatabaseTransport()
      ? await databaseRpc('avatars', data.claims.sub, [])
      : await supabase.rpc('aulify_member_avatars');
    if (result.error) return jsonResponse({ error: 'No se pudieron cargar los avatares.' }, 503);
    return jsonResponse({ avatars: result.data });
  } catch {
    return jsonResponse({ error: 'No se pudieron cargar los avatares.' }, 503);
  }
}
