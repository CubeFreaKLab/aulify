import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { databaseRpc, hasDatabaseTransport } from './supabase/database';
import { supabaseConfig } from './supabase/config';
import { illustratedQuestions } from '@/domain/demo-data';

import type { GuestRecord } from '@/domain/guest-practice';
export { guestProjection } from '@/domain/guest-practice';
export const guestToken =
  /^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|ecosistema-demo)$/;
export async function guestStore(
  action: 'read' | 'join' | 'answer',
  payload: Record<string, unknown>,
): Promise<GuestRecord> {
  if (payload.token === 'ecosistema-demo')
    payload = { ...payload, demoQuestions: illustratedQuestions() };
  const result = hasDatabaseTransport()
    ? await databaseRpc<GuestRecord>('guest', null, [action, payload])
    : await (() => {
        const { url } = supabaseConfig();
        if (!process.env.SUPABASE_SECRET_KEY) throw new Error('GUEST_UNAVAILABLE');
        return createClient(url, process.env.SUPABASE_SECRET_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        }).rpc('aulify_guest', { p_action: action, p_payload: payload });
      })();
  if (result.error || !result.data) throw new Error(result.error?.message || 'GUEST_UNAVAILABLE');
  return result.data as GuestRecord;
}
export function guestError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    GUEST_NOT_FOUND: 'Este enlace ya no está disponible.',
    GUEST_NOT_OPEN: 'La práctica todavía no ha comenzado.',
    GUEST_CLOSED: 'El tiempo de esta práctica terminó.',
    GUEST_LIMIT: 'Esta práctica alcanzó su límite de participantes. Pide otro enlace al docente.',
    GUEST_SESSION: 'Vuelve a entrar con tu nombre para jugar.',
    GUEST_STALE: 'Tu respuesta ya cambió. Actualiza para continuar.',
    GUEST_CLOSED_QUESTIONS:
      'El enlace para invitados necesita preguntas de corrección automática. Las respuestas escritas se mantienen en el aula.',
    INVALID_SCHEDULE:
      'Revisa las fechas: cierre posterior al inicio, hasta 90 días y duración entre 1 y 120 minutos.',
    NOT_ALLOWED: 'No tienes permiso para compartir esta actividad.',
  };
  const key = /^[A-Z_]+/.exec(code)?.[0] ?? '';
  return {
    message: messages[key] || 'No pudimos conectar con la práctica. Intenta de nuevo.',
    status:
      key === 'GUEST_NOT_FOUND' ? 404 : key === 'NOT_ALLOWED' ? 403 : messages[key] ? 409 : 503,
  };
}
