'use client';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase/config';
import type { SubmissionFile } from '@/domain';

async function fileCommand(body: unknown) {
  const response = await fetch('/api/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo subir el archivo.');
  return result;
}
export async function uploadFile(file: File, purpose: 'resource' | 'submission'): Promise<SubmissionFile & { url: string }> {
  const metadata = { name: file.name, size: file.size, purpose };
  const prepared = await fileCommand({ ...metadata, action: 'prepare' });
  const { url, key } = supabaseConfig();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await client.storage.from('aulify-files').uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: prepared.mime });
  if (error) throw new Error('La subida no terminó. Comprueba tu conexión y vuelve a intentarlo.');
  return fileCommand({ ...metadata, action: 'complete', id: prepared.id });
}
