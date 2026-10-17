import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseServer } from '../../src/lib/supabase/server';
import { authFailureResponse } from '../../src/lib/http';

const cookieStore = vi.hoisted(() => ({
  getAll: vi.fn((): { name: string; value: string }[] => []),
  set: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  cookieStore.getAll.mockReturnValue([]);
});

describe('renovación en una ruta API sin proxy previo', () => {
  const user = {
    id: '10000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'ficticio@example.test',
  };
  function session(expires: number) {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return {
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expires, iat: expires - 3600, aud: 'authenticated', role: 'authenticated' })}.${Buffer.from('fictitious-signature').toString('base64url')}`,
      refresh_token: 'fictitious-refresh-token',
      expires_at: expires,
      expires_in: 3600,
      token_type: 'bearer',
      user,
    };
  }
  function expiredCookie() {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://cookie-test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'fictitious-publishable-key');
    const value = Buffer.from(
      JSON.stringify(session(Math.floor(Date.now() / 1000) - 120)),
    ).toString('base64url');
    cookieStore.getAll.mockReturnValue([
      { name: 'sb-cookie-test-auth-token', value: `base64-${value}` },
    ]);
  }

  it('verifica la identidad renovada y guarda la cookie protegida desde el handler', async () => {
    expiredCookie();
    let refreshes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
          refreshes++;
          return Response.json(session(Math.floor(Date.now() / 1000) + 3600));
        }
        if (url.endsWith('/auth/v1/user')) return Response.json(user);
        throw new Error('Destino inesperado en la prueba de sesión.');
      }),
    );
    const client = await createSupabaseServer();
    const { data, error } = await client.auth.getClaims();
    expect(error).toBeNull();
    expect(data?.claims.sub).toBe(user.id);
    expect(refreshes).toBe(1);
    const updatedCookie = cookieStore.set.mock.calls.find(
      ([name]) => name === 'sb-cookie-test-auth-token',
    );
    expect(updatedCookie?.[2]).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' });
  });

  it('conserva la cookie y responde indisponibilidad ante el límite temporal de Auth', async () => {
    expiredCookie();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 'over_request_rate_limit', msg: 'Request rate limit reached' },
          { status: 429 },
        ),
      ),
    );
    const client = await createSupabaseServer();
    const { data, error } = await client.auth.getClaims();
    expect(data?.claims.sub).toBeUndefined();
    expect(error).toBeTruthy();
    expect(cookieStore.set).not.toHaveBeenCalled();
    const response = authFailureResponse(error);
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
  });
});

describe('cookies de acceso emitidas por el cliente SSR', () => {
  it.each([
    {
      environment: 'preview de Vercel sin dominio configurado',
      vercel: '1',
      site: '',
      secure: true,
    },
    {
      environment: 'alojamiento HTTPS propio',
      vercel: '',
      site: 'https://aulify.example',
      secure: true,
    },
    {
      environment: 'compilado local HTTP',
      vercel: '',
      site: 'http://127.0.0.1:3001',
      secure: false,
    },
  ])('protege la sesión en $environment', async ({ vercel, site, secure }) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', vercel);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', site);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://cookie-test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'fictitious-publishable-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          access_token: 'fictitious-access-token',
          refresh_token: 'fictitious-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: '10000000-0000-4000-8000-000000000001',
            aud: 'authenticated',
            email: 'ficticio@example.test',
          },
        }),
      ),
    );

    const client = await createSupabaseServer();
    const { error } = await client.auth.signInWithPassword({
      email: 'ficticio@example.test',
      password: 'fictitious-password',
    });
    expect(error).toBeNull();
    const sessionCookie = cookieStore.set.mock.calls.find(
      ([name]) => name === 'sb-cookie-test-auth-token',
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.[2]).toMatchObject({
      secure,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });
});
