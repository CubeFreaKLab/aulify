import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config';

/** Only for validated uploads and scheduled cleanup; never for classroom authorization. */
export function createSupabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('El almacenamiento del aula todavía no está configurado.');
  return createClient(supabaseConfig().url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
