import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GET as sync } from '../../src/app/api/sync/route';
import { GET as workspace } from '../../src/app/api/workspace/route';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getClaims: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }),
}));
vi.mock('@/lib/http', () => import('../../src/lib/http'));
vi.mock('@/lib/rpc-failure', () => import('../../src/lib/rpc-failure'));

const activity = '10000000-0000-4000-8000-000000000001';
const secret = 'SQL secreto / JWT privado / respuesta del estudiante';
const identity = { data: { claims: { sub: 'fictitious' } } };
const routes = [
  { handler: sync, scope: 'sync', path: `/api/sync?activity=${activity}`, rpc: 'aulify_sync' },
  {
    handler: workspace,
    scope: 'workspace',
    path: `/api/workspace?activity=${activity}`,
    rpc: 'aulify_activity_snapshot',
  },
  { handler: workspace, scope: 'workspace', path: '/api/workspace', rpc: 'aulify_snapshot' },
] as const;

describe.each(routes)('fallos de lectura en $rpc', ({ handler, scope, path, rpc }) => {
  const request = () => new NextRequest(`https://aulify.example${path}`);
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.getClaims.mockReset().mockResolvedValue(identity);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['', 0, 'transport'],
    ['PGRST003', 504, 'database_timeout'],
    ['57014', 500, 'database_cancelled'],
    ['40P01', 500, 'transaction_contention'],
  ])(
    'identifica %s sin exponer el error y conserva Retry-After',
    async (code, status, category) => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { code, message: secret, details: secret },
        status,
      });
      const response = await handler(request());
      expect(response.status).toBe(503);
      expect(response.headers.get('X-Aulify-Rpc-Failure')).toBe(category);
      expect(response.headers.get('Retry-After')).toBe('30');
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(JSON.stringify(await response.json())).not.toContain(secret);
      expect(console.warn).toHaveBeenCalledExactlyOnceWith(`aulify.${scope}.rpc_failure`, {
        category,
        durationMs: expect.any(Number),
      });
      expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(secret);
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
    },
  );

  it('conserva la denegación 403 y no reintenta', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: secret },
      status: 403,
    });
    const response = await handler(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Esta actividad ya no está disponible para tu cuenta.',
    });
    expect(response.headers.get('X-Aulify-Rpc-Failure')).toBe('forbidden');
    expect(response.headers.get('Retry-After')).toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('no confunde indisponibilidad de identidad con una llamada RPC fallida', async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: { status: 503 } });
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Aulify-Rpc-Failure')).toBeNull();
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(console.warn).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('mide únicamente la llamada RPC, excluyendo validación de identidad', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    mocks.getClaims.mockImplementation(async () => {
      now = 5000;
      return identity;
    });
    mocks.rpc.mockImplementation(async () => {
      now = 5037;
      return { data: null, error: { code: '', details: secret }, status: 0 };
    });
    await handler(request());
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(`aulify.${scope}.rpc_failure`, {
      category: 'transport',
      durationMs: 37,
    });
  });

  it('usa el SDK real con transporte simulado y clasifica su timeout de conexión', async () => {
    const transport = vi.fn(async () => {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error(secret), { code: 'UND_ERR_CONNECT_TIMEOUT' }),
      });
    });
    const client = createClient('https://unit.supabase.co', 'fictitious-publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: transport },
    });
    mocks.rpc.mockImplementation((name, payload) => client.rpc(name, payload));
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Aulify-Rpc-Failure')).toBe('transport_timeout');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(secret);
    expect(JSON.stringify(await response.json())).not.toContain(secret);
  });

  it('maneja una excepción de transporte sin convertirla en un fallo de identidad', async () => {
    mocks.rpc.mockRejectedValue(new TypeError('fetch failed'));
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Aulify-Rpc-Failure')).toBe('transport');
    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('conserva el RPC, sus argumentos y la respuesta de éxito', async () => {
    const data = scope === 'sync' ? { revision: 'opaque-revision' } : { state: { activities: [] } };
    mocks.rpc.mockResolvedValue({ data, error: null, status: 200 });
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(data);
    expect(response.headers.get('X-Aulify-Rpc-Failure')).toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
    if (rpc === 'aulify_snapshot') expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(rpc);
    else expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(rpc, { p_activity_id: activity });
  });

  it('rechaza un identificador inválido antes de identidad y RPC', async () => {
    const response = await handler(
      new NextRequest(`https://aulify.example/api/${scope}?activity=invalid`),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('X-Aulify-Rpc-Failure')).toBeNull();
    expect(mocks.getClaims).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
