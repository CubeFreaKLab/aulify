// Lista cerrada: no conservar cabeceras desconocidas, mensajes, SQL ni cuerpos de errores.
const rpcCategories = new Set([
  'validation', 'forbidden', 'unauthorized', 'transport', 'transport_timeout',
  'database_timeout', 'database_cancelled', 'transaction_contention',
  'service_unavailable', 'internal',
]);

export function rpcFailureCategory(headers) {
  const value = headers.get('X-Aulify-Rpc-Failure');
  return rpcCategories.has(value) ? value : 'unclassified';
}

export function transportFailureCategory(error) {
  if (error?.name === 'TimeoutError') return 'client_timeout';
  if (error?.name === 'AbortError') return 'client_aborted';
  return 'client_transport';
}
