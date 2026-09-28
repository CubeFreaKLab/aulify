import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../../src/proxy';

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
});
