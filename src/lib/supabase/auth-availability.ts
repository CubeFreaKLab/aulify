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
  let failure: AuthFailure | null = null;
  const guardedFetch: typeof fetch = async (input, init) => {
    const target = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input : input.url,
    );
    const isAuth = target.origin === authUrl.origin && target.pathname.startsWith(authUrl.pathname);
    try {
      const response = await globalThis.fetch(input, init);
      if (isAuth && isAuthUnavailable({ status: response.status }))
        failure = { status: response.status };
      return response;
    } catch (error) {
      if (isAuth) failure = { name: 'AuthRetryableFetchError' };
      throw error;
    }
  };
  return {
    fetch: guardedFetch,
    get failure() {
      return failure;
    },
  };
}
