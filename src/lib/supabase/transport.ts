import { Pool } from 'undici';

const transports = new Map<string, ReturnType<typeof createBoundedTransport>>();

export function createBoundedTransport(url: string, connections = 64) {
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
    const options: RequestInit & { dispatcher: Pool } = { ...init, dispatcher: pool };
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
