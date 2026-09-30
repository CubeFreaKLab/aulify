import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseServer } from '../../src/lib/supabase/server';

const cookieStore = vi.hoisted(() => ({ getAll: vi.fn(() => []), set: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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
