import type { NextRequest } from 'next/server';
import { isAvatarId } from '@/domain/avatars';
import { authFailureResponse, isSameOrigin, jsonResponse, readJson } from '@/lib/http';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return authFailureResponse(error);
    const id: unknown = data.user.user_metadata.avatar_id;
    return jsonResponse({ userId: data.user.id, avatarId: isAvatarId(id) ? id : null });
  } catch {
    return jsonResponse({ error: 'No pudimos cargar tu avatar. Intenta de nuevo.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Origen no permitido.' }, 403);
  let body: Record<string, unknown>;
  try {
    body = await readJson(request, 256);
  } catch {
    return jsonResponse({ error: 'Selecciona un avatar del catálogo.' }, 400);
  }
  if (!isAvatarId(body.avatarId) || Object.keys(body).some((key) => key !== 'avatarId'))
    return jsonResponse({ error: 'Selecciona un avatar del catálogo.' }, 400);
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return authFailureResponse(error);
    // Cosmetic metadata only. Roles and classroom permissions remain in PostgreSQL.
    // updateUser acts on the authenticated account; no target user ID is accepted.
    const updated = await supabase.auth.updateUser({ data: { avatar_id: body.avatarId } });
    if (updated.error || !updated.data.user)
      return jsonResponse({ error: 'No se guardó el avatar. Intenta de nuevo.' }, 503);
    return jsonResponse({ userId: data.user.id, avatarId: body.avatarId });
  } catch {
    return jsonResponse({ error: 'No se guardó el avatar. Intenta de nuevo.' }, 503);
  }
}
