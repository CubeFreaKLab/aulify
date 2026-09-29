import { jsonResponse } from './http';

export type RpcFailureCategory =
  | 'validation'
  | 'forbidden'
  | 'unauthorized'
  | 'transport'
  | 'transport_timeout'
  | 'database_timeout'
  | 'database_cancelled'
  | 'transaction_contention'
  | 'service_unavailable'
  | 'internal';

export type RpcFailure = {
  status: 400 | 401 | 403 | 500 | 503;
  category: RpcFailureCategory;
};

function field(value: unknown, name: string): unknown {
  return value && typeof value === 'object' ? Reflect.get(value, name) : undefined;
}

/** Clasifica sin devolver mensajes, detalles, consultas ni identificadores del servicio. */
export function classifyRpcFailure(error: unknown, upstreamStatus?: number): RpcFailure {
  const code = field(error, 'code');
  if (code === 'P0001') return { status: 400, category: 'validation' };
  if (code === '42501') return { status: 403, category: 'forbidden' };
  if (['PGRST301', 'PGRST302', 'PGRST303'].includes(String(code)) || upstreamStatus === 401)
    return { status: 401, category: 'unauthorized' };
  if (code === '40001' || code === '40P01' || code === '55P03')
    return { status: 503, category: 'transaction_contention' };
  if (code === '57014') return { status: 503, category: 'database_cancelled' };
  if (code === 'PGRST003') return { status: 503, category: 'database_timeout' };

  const causeCode = field(field(error, 'cause'), 'code');
  const timeoutCode =
    /\b(?:UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|ETIMEDOUT)\b/;
  if (
    field(error, 'name') === 'TimeoutError' ||
    timeoutCode.test(String(causeCode ?? code ?? '')) ||
    // El SDK conserva el código de la causa dentro de details al normalizar un fallo de fetch.
    (upstreamStatus === 0 && timeoutCode.test(String(field(error, 'details') ?? '')))
  )
    return { status: 503, category: 'transport_timeout' };
  if (
    (typeof code === 'string' && /^(?:08|53|57|PGRST00)/.test(code)) ||
    upstreamStatus === 429 ||
    (upstreamStatus !== undefined && upstreamStatus >= 500)
  )
    return { status: 503, category: 'service_unavailable' };
  if (
    upstreamStatus === 0 ||
    code === '' ||
    field(error, 'name') === 'AbortError' ||
    (field(error, 'name') === 'TypeError' && field(error, 'message') === 'fetch failed') ||
    ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_SOCKET'].includes(
      String(causeCode ?? code),
    )
  )
    return { status: 503, category: 'transport' };
  if (typeof code === 'string' && /^(?:22|23)/.test(code))
    return { status: 400, category: 'validation' };
  return { status: 500, category: 'internal' };
}

/** Solo categorías cerradas y duración: nunca serializa el error ni el contenido del comando. */
export function logRpcFailure(
  failure: RpcFailure,
  durationMs: number,
  scope: 'command' | 'sync' | 'workspace' = 'command',
) {
  if (failure.status < 500) return;
  console.warn(`aulify.${scope}.rpc_failure`, {
    category: failure.category,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0,
  });
}

/** Cabecera de diagnóstico cerrada; la respuesta no incluye el error recibido del servicio. */
export function readRpcFailureResponse(
  scope: 'sync' | 'workspace',
  error: unknown,
  durationMs: number,
  upstreamStatus?: number,
) {
  const failure = classifyRpcFailure(error, upstreamStatus);
  logRpcFailure(failure, durationMs, scope);
  const message =
    failure.status === 403
      ? 'Esta actividad ya no está disponible para tu cuenta.'
      : failure.status === 401
        ? 'Tu sesión terminó. Vuelve a iniciar sesión.'
        : scope === 'sync'
          ? 'No pudimos actualizar la actividad en este momento. Se reintentará.'
          : 'No pudimos abrir tu aula. Intenta de nuevo.';
  const response = jsonResponse({ error: message }, failure.status);
  response.headers.set('X-Aulify-Rpc-Failure', failure.category);
  if (failure.status === 503) response.headers.set('Retry-After', '30');
  return response;
}
