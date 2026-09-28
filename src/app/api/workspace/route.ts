import { createSupabaseServer } from '@/lib/supabase/server';
import { jsonResponse } from '@/lib/http';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identity.user)
    return jsonResponse({ error: 'Tu sesión terminó. Vuelve a iniciar sesión.' }, 401);
  const { data, error } = await supabase.rpc('aulify_snapshot');
  if (error) return jsonResponse({ error: 'No pudimos abrir tu aula. Intenta de nuevo.' }, 503);
  return jsonResponse(data);
}
