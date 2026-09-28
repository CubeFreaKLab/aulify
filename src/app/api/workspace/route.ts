import { createSupabaseServer } from '@/lib/supabase/server';
import { authFailureResponse, jsonResponse } from '@/lib/http';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: identity, error: identityError } = await supabase.auth.getClaims();
  if (identityError || !identity?.claims.sub) return authFailureResponse(identityError);
  const { data, error } = await supabase.rpc('aulify_snapshot');
  if (error) return jsonResponse({ error: 'No pudimos abrir tu aula. Intenta de nuevo.' }, 503);
  return jsonResponse(data);
}
