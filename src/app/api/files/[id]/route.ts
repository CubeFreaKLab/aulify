import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { jsonResponse } from '@/lib/http';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonResponse({ error: 'Archivo no disponible.' }, 404);
  const client = await createSupabaseServer();
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || !identity.user)
    return jsonResponse({ error: 'Inicia sesión para abrir este archivo.' }, 401);
  const { data: file, error } = await client.rpc('aulify_file', { p_id: id });
  if (error || !file) return jsonResponse({ error: 'No tienes acceso a este archivo.' }, 404);
  const { data: signed, error: signError } = await client.storage
    .from(file.bucket)
    .createSignedUrl(file.path, 60, {
      download: request.nextUrl.searchParams.has('download') ? file.name || true : false,
    });
  if (signError || !signed) return jsonResponse({ error: 'No pudimos abrir el archivo.' }, 503);
  return NextResponse.redirect(signed.signedUrl, {
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
