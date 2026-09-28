import { createHash, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { isSameOrigin, jsonResponse, readJson } from '@/lib/http';
import { validateFileBytes, validateFileMetadata } from '@/lib/file-validation';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Origen de solicitud no válido.' }, 403);
  try {
    const client = await createSupabaseServer();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return jsonResponse({ error: 'Inicia sesión para adjuntar archivos.' }, 401);
    const body = await readJson(request, 4096);
    const name = typeof body.name === 'string' ? body.name : '';
    const size = typeof body.size === 'number' ? body.size : 0;
    const purpose = typeof body.purpose === 'string' ? body.purpose : '';
    const { mime } = validateFileMetadata(name, size, purpose);
    const admin = createSupabaseAdmin();
    if (body.action === 'prepare') {
      const id = randomUUID();
      const { data: reservation, error: reserveError } = await admin.rpc('aulify_reserve_upload', { p_owner: data.user.id, p_id: id, p_name: name, p_purpose: purpose, p_size: size, p_mime: mime });
      if (reserveError) return jsonResponse({ error: reserveError.code === 'P0001' ? reserveError.message : 'No pudimos preparar el archivo.' }, 400);
      const { data: signed, error: signedError } = await admin.storage.from(reservation.bucket).createSignedUploadUrl(reservation.path, { upsert: false });
      if (signedError || !signed) return jsonResponse({ error: 'El almacenamiento no está disponible en este momento.' }, 503);
      return jsonResponse({ id, path: reservation.path, token: signed.token, mime });
    }
    if (body.action !== 'complete' || typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) return jsonResponse({ error: 'Archivo no válido.' }, 400);
    const path = `${data.user.id}/${body.id}`;
    const { data: blob, error: downloadError } = await admin.storage.from('aulify-files').download(path);
    if (downloadError || !blob) return jsonResponse({ error: 'La subida no terminó. Intenta de nuevo.' }, 400);
    if (blob.size !== size || blob.size > 10 * 1024 * 1024) return jsonResponse({ error: 'El tamaño recibido no coincide con el archivo.' }, 400);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const detectedMime = await validateFileBytes(name, bytes);
    const { error: completeError } = await admin.rpc('aulify_register_file', { p_owner: data.user.id, p_id: body.id, p_name: name, p_mime: detectedMime, p_size: bytes.length, p_sha256: createHash('sha256').update(bytes).digest('hex') });
    if (completeError) return jsonResponse({ error: 'No pudimos confirmar el archivo. Conserva tu original y vuelve a intentarlo.' }, 400);
    return jsonResponse({ id: body.id, name, size, mimeType: detectedMime, url: `/api/files/${body.id}` });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error && !/key|token|fetch|supabase/i.test(error.message) ? error.message : 'No pudimos procesar el archivo.' }, 400);
  }
}
