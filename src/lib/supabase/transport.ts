import { Pool } from 'undici';

const transports = new Map<string, ReturnType<typeof createBoundedTransport>>();

export function createBoundedTransport(url: string, connections = 128, timeoutMs = 12_000) {
  const origin = new URL(url).origin;
  // Una solicitud por conexión: no reenviar comandos ni activar pipelining HTTP/1.
  const pool = new Pool(origin, {
    connections,
    pipelining: 1,
    allowH2: false,
    keepAliveTimeout: 30_000,
  });
  const fetch: typeof globalThis.fetch = (input, init) => {
    const target = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input : input.url,
    );
    if (target.origin !== origin) return Promise.reject(new Error('Origen de datos inesperado.'));
    // El cliente del aula espera 15 s. Limitar también la espera del servidor
    // evita conservar solicitudes en cola después de ese plazo y acumular reintentos.
    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const deadline = AbortSignal.timeout(timeoutMs);
    const options: RequestInit & { dispatcher: Pool } = {
      ...init,
      dispatcher: pool,
      signal: callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline,
    };
    return globalThis.fetch(input, options);
  };
  return { fetch, close: () => pool.close() };
}

export function supabaseTransport(url: string): typeof globalThis.fetch {
  const origin = new URL(url).origin;
  let transport = transports.get(origin);
  if (!transport) {
    transport = createBoundedTransport(origin);
    transports.set(origin, transport);
  }
  return transport.fetch;
}
