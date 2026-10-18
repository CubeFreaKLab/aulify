/** SSE de la misma aplicación: sin acceso directo del generador a Realtime. */
export async function consumeEventFrames(body, event, bytes = () => {}) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let pending = '';
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes(next.value.byteLength);
      pending = (pending + decoder.decode(next.value, { stream: true })).replaceAll('\r\n', '\n');
      if (pending.length > 65_536) throw new Error('SSE_FRAME_TOO_LARGE');
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const name = frame.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (name) event(name, data);
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function openLoadEventStream({ connect, opened, failed, event, bytes }) {
  let stopped = false, controller, timer, timerResolve;
  let readyResolve, readyReject, hasReady = false;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const timeout = setTimeout(() => readyReject(new Error('SSE_NOT_READY')), 45_000);
  const done = (async () => {
    while (!stopped) {
      controller = new AbortController();
      let rotated = false, revoked = false;
      const headersTimeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await connect(controller.signal);
        clearTimeout(headersTimeout);
        opened(response);
        if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream'))
          throw Object.assign(new Error('SSE_HTTP_FAILURE'), { status: response.status });
        await consumeEventFrames(response.body, (name, data) => {
          if (name === 'ready' && !hasReady) { hasReady = true; clearTimeout(timeout); readyResolve(); }
          if (name === 'rotate') rotated = true;
          if (name === 'revoked') revoked = true;
          event(name, data);
        }, bytes);
        if (!stopped && !rotated && !revoked) failed({ name: 'SSE_UNEXPECTED_END' });
        if (revoked) { stopped = true; break; }
      } catch (error) {
        if (!stopped) failed(error);
        if ([401,403].includes(error.status)) { stopped=true;readyReject(error);event('revoked'); }
      } finally { clearTimeout(headersTimeout); event('disconnected'); }
      if (!stopped) await new Promise(resolve => { timerResolve = resolve; timer = setTimeout(resolve, 1500); });
    }
  })();
  return {
    ready,
    async stop() {
      stopped = true; clearTimeout(timeout); clearTimeout(timer); timerResolve?.(); controller?.abort();
      readyResolve(); await done;
    },
  };
}
