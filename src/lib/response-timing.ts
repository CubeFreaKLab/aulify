/** Duraciones de esta solicitud; no contiene identidades, consultas ni contenido. */
export function responseTiming<T extends Response>(
  response: T,
  handlerStartedAt: number,
  rpcStartedAt: number,
  rpcEndedAt: number,
): T {
  const now = performance.now();
  const duration = (value: number) => Math.max(0, value).toFixed(2);
  response.headers.set(
    'Server-Timing',
    `prepare;dur=${duration(rpcStartedAt - handlerStartedAt)}, rpc;dur=${duration(rpcEndedAt - rpcStartedAt)}, encode;dur=${duration(now - rpcEndedAt)}`,
  );
  return response;
}
