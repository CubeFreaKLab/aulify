import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../src/app/api/commands/route';
import { GET } from '../../src/app/api/workspace/route';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), native: vi.fn(), claims: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { getClaims: mocks.claims }, rpc: mocks.rpc }),
}));
vi.mock('@/lib/supabase/database', () => ({
  hasDatabaseTransport: () => true,
  databaseRpc: mocks.native,
}));
vi.mock('@/lib/http', () => import('../../src/lib/http'));
vi.mock('@/lib/command-errors', () => import('../../src/lib/command-errors'));
vi.mock('@/lib/rpc-failure', () => import('../../src/lib/rpc-failure'));
vi.mock('@/lib/response-timing', () => import('../../src/lib/response-timing'));
const user = '11111111-1111-4111-8111-111111111111';
const activity = '22222222-2222-4222-8222-222222222222';

describe('Identidad y contratos HTTP con transporte PostgreSQL', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.native.mockReset().mockResolvedValue({ data: { saved: true }, error: null, status: 200 });
    mocks.claims.mockReset().mockResolvedValue({ data: { claims: { sub: user } } });
  });
  it('usa la identidad verificada para el comando e ignora un userId enviado por el cliente', async () => {
    const args = ['attempt', 'question', { text: 'respuesta' }, 'idempotency-key', false];
    const response = await POST(
      new NextRequest('https://aulify.example/api/commands', {
        method: 'POST',
        headers: { origin: 'https://aulify.example', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'submitAnswer', args, userId: 'foreign-user' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.native).toHaveBeenCalledExactlyOnceWith('command', user, [
      'submitAnswer',
      { args },
    ]);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ result: { saved: true } });
  });
  it.each([
    ['/api/workspace', 'overview', []],
    [`/api/workspace?activity=${activity}`, 'activity', [activity]],
  ])('conserva la identidad y el ámbito de %s', async (path, operation, args) => {
    const response = await GET(new NextRequest('https://aulify.example' + path));
    expect(response.status).toBe(200);
    expect(mocks.native).toHaveBeenCalledExactlyOnceWith(operation, user, args);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rechaza una sesión ausente antes de intentar una conexión a PostgreSQL', async () => {
    mocks.claims.mockResolvedValue({ data: null, error: { status: 401 } });
    expect((await GET(new NextRequest('https://aulify.example/api/workspace'))).status).toBe(401);
    expect(mocks.native).not.toHaveBeenCalled();
  });
  it('conserva el rechazo de permisos sin intentar un segundo transporte', async () => {
    mocks.native.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'FORBIDDEN' },
      status: 0,
    });
    expect(
      (await GET(new NextRequest(`https://aulify.example/api/workspace?activity=${activity}`)))
        .status,
    ).toBe(403);
    expect(mocks.native).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
