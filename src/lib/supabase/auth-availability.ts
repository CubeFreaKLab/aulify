export type AuthFailure = { status?: number; name?: string };

export function isAuthUnavailable(error?: AuthFailure | null) {
  return (
    error?.status === 429 ||
    (error?.status !== undefined && error.status >= 500) ||
    error?.name === 'AuthRetryableFetchError'
  );
}

// Auth puede borrar su almacenamiento al rechazar una renovación vencida con 429.
// Conservamos las cookies durante un fallo temporal, sin aceptar la identidad.
export function authAvailability(url: string) {
  const authUrl = new URL('/auth/v1/', url);
  const failures = new Map<string, AuthFailure>();
  const guardedFetch: typeof fetch = async (input, init) => {
    const target = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input : input.url,
    );
    const isAuth = target.origin === authUrl.origin && target.pathname.startsWith(authUrl.pathname);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const operation = `${method.toUpperCase()} ${target.href}`;
    try {
      const response = await globalThis.fetch(input, init);
      if (isAuth) {
        if (isAuthUnavailable({ status: response.status }))
          failures.set(operation, { status: response.status });
        // Un reintento resuelto permite guardar la rotación o eliminar un token inválido.
        // El éxito de otro endpoint no resuelve esta operación.
        else failures.delete(operation);
      }
      return response;
    } catch (error) {
      if (isAuth) failures.set(operation, { name: 'AuthRetryableFetchError' });
      throw error;
    }
  };
  return {
    fetch: guardedFetch,
    get failure() {
      return failures.values().next().value ?? null;
    },
  };
}
