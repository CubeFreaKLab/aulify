import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createSyncBatchQueue } from '@/lib/sync-batch';
import { supabaseConfig } from './config';
import { supabaseTransport } from './transport';

let queue: ReturnType<typeof createSyncBatchQueue> | null = null;

/** Only opaque sync metadata; authorization remains in activity_sync for every verified subject. */
export function readVerifiedSync(userId: string, activityId: string) {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Sincronización del servidor no configurada.');
  if (!queue) {
    const { url } = supabaseConfig();
    const service = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: supabaseTransport(url) },
    });
    queue = createSyncBatchQueue(async (requests) => {
      const { data, error } = await service.rpc('aulify_service_sync_batch', {
        p_requests: requests,
      });
      if (error) throw error;
      if (!Array.isArray(data)) throw { code: 'XX000' };
      return data;
    });
  }
  return queue.read(userId, activityId);
}
