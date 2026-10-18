import 'server-only';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { isActivityHint } from '@/lib/activity-events';
import { supabaseConfig } from './config';

type Listener = {
  userId: string;
  changed: (revoked: boolean, activityChanged: boolean) => void;
  connected: (value: boolean) => void;
};
type Entry = { channel: RealtimeChannel; connected: boolean; listeners: Map<symbol, Listener> };
const entries = new Map<string, Entry>();
let client: SupabaseClient | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function service() {
  if (!client) {
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!key) throw new Error('Los avisos del aula no están configurados.');
    // Sólo recibe avisos. La autorización de cada navegador se realiza antes
    // de registrar el flujo, mediante su sesión y el contrato normal de datos.
    client = createClient(supabaseConfig().url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { logger: () => undefined },
    });
  }
  return client;
}

export function subscribeActivityHints(activityId: string, listener: Listener) {
  clearTimeout(idleTimer);
  let entry = entries.get(activityId);
  if (!entry) {
    if (entries.size >= 64) throw new Error('Límite de actividades simultáneas del relé.');
    const channel = service().channel(`aulify:activity:${activityId}`, {
      config: { private: true },
    });
    entry = { channel, connected: false, listeners: new Map() };
    entries.set(activityId, entry);
    const current = entry;
    channel.on('broadcast', { event: 'changed' }, ({ payload }: { payload: unknown }) => {
      if (!isActivityHint(payload) || payload.activityId !== activityId) return;
      for (const target of current.listeners.values()) {
        if (!payload.studentId || payload.studentId === target.userId)
          target.changed(payload.revoked === true, payload.studentId === undefined);
      }
    });
    channel.subscribe((status) => {
      current.connected = status === 'SUBSCRIBED';
      for (const target of current.listeners.values()) target.connected(current.connected);
    });
  }
  const current = entry;
  const id = Symbol();
  current.listeners.set(id, listener);
  listener.connected(current.connected);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    current.listeners.delete(id);
    if (current.listeners.size) return;
    if (entries.get(activityId) === current) entries.delete(activityId);
    void client?.removeChannel(current.channel).catch(() => undefined);
    if (!entries.size)
      idleTimer = setTimeout(() => {
        if (!entries.size) client?.realtime.disconnect();
      }, 5000);
  };
}
