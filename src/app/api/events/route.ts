import type { NextRequest } from 'next/server';
import { authFailureResponse, jsonResponse } from '@/lib/http';
import { createSupabaseServer } from '@/lib/supabase/server';
import { readVerifiedSync } from '@/lib/supabase/sync-batch';
import { subscribeActivityHints } from '@/lib/supabase/activity-events';
import { readRpcFailureResponse } from '@/lib/rpc-failure';
import { ACTIVITY_EVENT_HEARTBEAT_MS, ACTIVITY_EVENT_STREAM_MS } from '@/lib/activity-events';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const activityId = request.nextUrl.searchParams.get('activity');
  if (
    !activityId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityId)
  )
    return jsonResponse({ error: 'Actividad no válida.' }, 400);
  const client = await createSupabaseServer();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub) return authFailureResponse(error);
  const started = performance.now();
  try {
    await readVerifiedSync(data.claims.sub, activityId);
  } catch (failure) {
    return readRpcFailureResponse('sync', failure, performance.now() - started);
  }

  const encoder = new TextEncoder();
  let closed = false;
  let release: () => void = () => undefined;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  const push = (text: string) => {
    if (!closed) controller?.enqueue(encoder.encode(text));
  };
  const dispose = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    request.signal.removeEventListener('abort', dispose);
    release();
    try {
      controller?.close();
    } catch {
      /* El consumidor ya pudo cancelar. */
    }
  };
  const stream = new ReadableStream<Uint8Array>({
    start(target) {
      controller = target;
      push('retry: 1500\n\n: connected\n\n');
      try {
        release = subscribeActivityHints(activityId, {
          userId: data.claims.sub,
          changed(revoked) {
            push(`event: ${revoked ? 'revoked' : 'changed'}\ndata: {}\n\n`);
            if (revoked) dispose();
          },
          connected(value) {
            push(`event: ${value ? 'ready' : 'unavailable'}\ndata: {}\n\n`);
          },
        });
      } catch {
        push('event: unavailable\ndata: {}\n\n');
        dispose();
        return;
      }
      heartbeat = setInterval(() => push(': keepalive\n\n'), ACTIVITY_EVENT_HEARTBEAT_MS);
      lifetime = setTimeout(() => {
        push('event: rotate\ndata: {}\n\n');
        dispose();
      }, ACTIVITY_EVENT_STREAM_MS);
      request.signal.addEventListener('abort', dispose, { once: true });
      if (request.signal.aborted) dispose();
    },
    cancel: dispose,
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
