import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyRpcFailure } from '../../src/lib/rpc-failure';
import { POST } from '../../src/app/api/commands/route';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getClaims: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }),
}));
vi.mock('@/lib/http', () => import('../../src/lib/http'));
vi.mock('@/lib/command-errors', () => import('../../src/lib/command-errors'));
vi.mock('@/lib/rpc-failure', () => import('../../src/lib/rpc-failure'));

function request(
  action = 'submitAnswer',
  args: unknown[] = ['attempt', 'question', 'answer', 'key'],
) {
  return new NextRequest('https://aulify.example/api/commands', {
    method: 'POST',
    headers: { origin: 'https://aulify.example', 'content-type': 'application/json' },
    body: JSON.stringify({ action, args }),
  });
}

describe('errores RPC de comandos', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.getClaims.mockReset().mockResolvedValue({ data: { claims: { sub: 'fictitious' } } });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['', 0, 'transport'],
    ['40001', 500, 'transaction_contention'],
    ['40P01', 500, 'transaction_contention'],
    ['55P03', 500, 'transaction_contention'],
    ['57014', 500, 'database_cancelled'],
    ['PGRST003', 504, 'database_timeout'],
    ['PGRST001', 503, 'service_unavailable'],
    ['08006', 503, 'service_unavailable'],
    [undefined, 502, 'service_unavailable'],
  ])('devuelve 503 y conserva el estado incierto ante %s/%s', async (code, status, category) => {
    const secret = 'TOKEN_AND_SQL_MUST_NOT_LEAK';
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code, message: secret, details: secret },
      status,
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({
      error:
        'No pudimos confirmar el cambio. Espera unos segundos y actualiza la página para comprobar su estado.',
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('aulify.command.rpc_failure', {
      category,
      durationMs: expect.any(Number),
    });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(secret);
  });

  it.each([
    ['P0001', 'INVALID_EDITOR_LINK', 400, 'enlace no permitido'],
    ['42501', 'private SQL statement', 403, 'No tienes permiso'],
    ['PGRST301', 'private token', 401, 'Tu sesión terminó'],
  ])('mantiene la orientación y permisos para %s', async (code, message, status, expected) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message }, status });
    const response = await POST(request('saveDraft'));
    expect(response.status).toBe(status);
    expect(response.headers.get('Retry-After')).toBeNull();
    expect((await response.json()).error).toContain(expected);
    expect(console.warn).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('mantiene el ACK y la clave de idempotencia sin repetir el comando', async () => {
    const result = { idempotencyKey: 'key', accepted: true };
    mocks.rpc.mockResolvedValue({ data: result, error: null, status: 200 });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('aulify_command', {
      p_action: 'submitAnswer',
      p_payload: { args: ['attempt', 'question', 'answer', 'key'] },
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('conserva el límite de negocio y no reenvía una creación no idempotente', async () => {
    mocks.rpc.mockResolvedValue({
      data: { error: { code: 'RATE_LIMIT' } },
      error: null,
      status: 200,
    });
    expect((await POST(request('createSubject', ['example']))).status).toBe(429);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('distingue una excepción RPC inesperada de JSON inválido y no filtra detalles', async () => {
    mocks.rpc.mockRejectedValue(new Error('private payload and SQL'));
    const response = await POST(request('createSubject'));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const malformed = request();
    vi.spyOn(malformed, 'text').mockResolvedValue('invalid json');
    expect((await POST(malformed)).status).toBe(400);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('bloquea sesión inválida antes de llamar RPC', async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: { status: 401 } });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('identifica timeout de transporte con el SDK real y no repite POST', async () => {
    const transport = vi.fn(async () => {
      throw new TypeError('fetch failed with secret URL', {
        cause: Object.assign(new Error('secret host'), { code: 'UND_ERR_CONNECT_TIMEOUT' }),
      });
    });
    const client = createClient('https://unit.supabase.co', 'fictitious-publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: transport },
    });
    mocks.rpc.mockImplementation((name, payload) => client.rpc(name, payload));
    const response = await POST(request('createSubject'));
    expect(response.status).toBe(503);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('aulify.command.rpc_failure', {
      category: 'transport_timeout',
      durationMs: expect.any(Number),
    });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('secret');
  });

  it('no convierte errores internos desconocidos en errores de datos', () => {
    expect(classifyRpcFailure({ code: 'XX000', message: 'private' }, 500).status).toBe(503);
    expect(classifyRpcFailure({ code: 'PGRST202', message: 'private' }, 404)).toEqual({
      status: 500,
      category: 'internal',
    });
  });

  it.each([
    [new TypeError('fetch failed'), 503, 'transport'],
    [new TypeError('Cannot read properties of undefined'), 500, 'internal'],
  ])('distingue fetch fallido de un TypeError de programación', async (error, status, category) => {
    mocks.rpc.mockRejectedValue(error);
    const response = await POST(request('createSubject'));
    expect(response.status).toBe(status);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('aulify.command.rpc_failure', {
      category,
      durationMs: expect.any(Number),
    });
  });
});
