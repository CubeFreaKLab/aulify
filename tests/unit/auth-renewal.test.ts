import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { proxy } from '../../src/proxy';
import { authAvailability } from '../../src/lib/supabase/auth-availability';
import { authFailureResponse } from '../../src/lib/http';

const user = {
  id: '10000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'ficticio@example.test',
};
function session(expires: number) {
  const encode = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expires, iat: expires - 3600, aud: 'authenticated', role: 'authenticated' })}.${Buffer.from('fictitious-signature').toString('base64url')}`,
    refresh_token: 'fictitious-refresh-token',
    expires_at: expires,
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
}
function request() {
  const encoded = Buffer.from(
    JSON.stringify(session(Math.floor(Date.now() / 1000) - 120)),
  ).toString('base64url');
  return new NextRequest('https://aulify.example/api/workspace', {
    headers: { cookie: `sb-unit-auth-token=base64-${encoded}` },
  });
}

describe('renovación SSR con el cliente Supabase real y transporte simulado', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://unit.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'fictitious-publishable-key');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('mantiene cookies ante 429 y corta la solicitud sin autorizar datos', async () => {
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/auth/v1/token?grant_type=refresh_token');
      return Response.json(
        { code: 'over_request_rate_limit', msg: 'Request rate limit reached' },
        { status: 429 },
      );
    });
    vi.stubGlobal('fetch', transport);
    const input = request(),
      originalCookie = input.headers.get('cookie');
    const response = await proxy(input);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0][0])).toContain('/auth/v1/token?grant_type=refresh_token');
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBeNull();
    expect(input.headers.get('cookie')).toBe(originalCookie);
  });

  it('elimina una sesión cuyo refresh token sí fue rechazado como inválido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' },
          { status: 400 },
        ),
      ),
    );
    const response = await proxy(request());
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('persiste la renovación válida y transmite la nueva cookie a la ruta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/v1/token?grant_type=refresh_token'))
          return Response.json(session(Math.floor(Date.now() / 1000) + 3600));
        if (url.endsWith('/auth/v1/user')) return Response.json(user);
        throw new Error('Solicitud inesperada en transporte simulado.');
      }),
    );
    const input = request(),
      originalCookie = input.headers.get('cookie');
    const response = await proxy(input);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('set-cookie')).toContain('sb-unit-auth-token=base64-');
    expect(input.headers.get('cookie')).not.toBe(originalCookie);
  });

  it('persiste la renovación cuando el SDK recupera un 503 con su propio reintento', async () => {
    let refreshes = 0;
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
        refreshes++;
        return refreshes === 1
          ? Response.json({ msg: 'Temporarily unavailable' }, { status: 503 })
          : Response.json(session(Math.floor(Date.now() / 1000) + 3600));
      }
      if (url.endsWith('/auth/v1/user')) return Response.json(user);
      throw new Error('Solicitud inesperada en transporte simulado.');
    });
    vi.stubGlobal('fetch', transport);
    const input = request(),
      originalCookie = input.headers.get('cookie');
    const response = await proxy(input);
    expect(refreshes).toBe(2);
    expect(transport).toHaveBeenCalledTimes(3);
    expect(String(transport.mock.calls[2][0])).toContain('/auth/v1/user');
    expect(response.status).toBe(200);
    expect(response.headers.get('Retry-After')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('set-cookie')).toContain('sb-unit-auth-token=base64-');
    expect(input.headers.get('cookie')).not.toBe(originalCookie);
  });

  it('conserva el rechazo definitivo del refresh después de un 503 transitorio', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let refreshes = 0;
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/auth/v1/token?grant_type=refresh_token');
      refreshes++;
      return refreshes === 1
        ? Response.json({ msg: 'Temporarily unavailable' }, { status: 503 })
        : Response.json(
            { code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' },
            { status: 400 },
          );
    });
    vi.stubGlobal('fetch', transport);
    const response = await proxy(request());
    expect(refreshes).toBe(2);
    expect(response.headers.get('Retry-After')).toBeNull();
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('no acepta el JWT renovado si la verificación de identidad lo rechaza', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let refreshes = 0;
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
        refreshes++;
        return refreshes === 1
          ? Response.json({ msg: 'Temporarily unavailable' }, { status: 503 })
          : Response.json(session(Math.floor(Date.now() / 1000) + 3600));
      }
      if (url.endsWith('/auth/v1/user'))
        return Response.json({ code: 'bad_jwt', msg: 'Invalid JWT' }, { status: 401 });
      throw new Error('Solicitud inesperada en transporte simulado.');
    });
    vi.stubGlobal('fetch', transport);
    const input = request();
    const availability = authAvailability('https://unit.supabase.co');
    const client = createServerClient('https://unit.supabase.co', 'fictitious-publishable-key', {
      global: { fetch: availability.fetch },
      cookies: {
        getAll: () => input.cookies.getAll(),
        setAll: (entries) => {
          if (availability.failure) return;
          entries.forEach(({ name, value }) => input.cookies.set(name, value));
        },
      },
    });
    const { data, error } = await client.auth.getClaims();
    expect(refreshes).toBe(2);
    expect(transport).toHaveBeenCalledTimes(3);
    expect(String(transport.mock.calls[2][0])).toContain('/auth/v1/user');
    expect(availability.failure).toBeNull();
    expect(data).toBeNull();
    expect(error?.status).toBe(401);
    expect(authFailureResponse(error).status).toBe(401);
  });
});
