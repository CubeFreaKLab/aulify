import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../src/app/api/events/route';

const mocks = vi.hoisted(() => ({
  claims: vi.fn(),
  sync: vi.fn(),
  subscribe: vi.fn(),
  release: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { getClaims: mocks.claims } }),
}));
vi.mock('@/lib/supabase/sync-batch', () => ({ readVerifiedSync: mocks.sync }));
vi.mock('@/lib/supabase/activity-events', () => ({ subscribeActivityHints: mocks.subscribe }));
vi.mock('@/lib/activity-events', () => import('../../src/lib/activity-events'));
vi.mock('@/lib/http', () => import('../../src/lib/http'));
vi.mock('@/lib/rpc-failure', () => import('../../src/lib/rpc-failure'));
vi.mock('@/lib/response-timing', () => import('../../src/lib/response-timing'));
const activity = '10000000-0000-4000-8000-000000000001';
const request = () =>
  new NextRequest(`https://aulify.example/api/events?activity=${activity}&userId=other`);
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: 'verified' } }, error: null });
  mocks.sync.mockResolvedValue({ revision: 'a'.repeat(32) });
  mocks.subscribe.mockImplementation(() => mocks.release);
});
afterEach(() => {
  vi.useRealTimers();
});
describe('Flujo privado del aula', () => {
  it('no abre un canal sin sesión', async () => {
    mocks.claims.mockResolvedValue({ data: null, error: { status: 401 } });
    expect((await GET(request())).status).toBe(401);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
  it('comprueba pertenencia con la identidad verificada antes de abrir el flujo', async () => {
    mocks.sync.mockRejectedValue({ code: '42501' });
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.sync).toHaveBeenCalledWith('verified', activity);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
  it('envía avisos sin respuestas y libera el canal al cancelar', async () => {
    const response = await GET(request());
    const listener = mocks.subscribe.mock.calls[0][1];
    expect(listener.userId).toBe('verified');
    listener.connected(true);
    listener.changed(false);
    listener.changed(false, true);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    for (let i = 0; i < 4; i++) chunks.push(decoder.decode((await reader.read()).value));
    expect(chunks.join('')).toContain('event: ready');
    expect(chunks.join('')).toContain('event: changed\ndata: {}');
    expect(chunks.join('')).toContain('event: changed\ndata: {"activityChanged":true}');
    await reader.cancel();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cierra inmediatamente un acceso revocado y rota antes del límite del alojamiento', async () => {
    const response = await GET(request());
    mocks.subscribe.mock.calls[0][1].changed(true);
    expect(await response.text()).toContain('event: revoked');
    expect(mocks.release).toHaveBeenCalledOnce();
    const second = await GET(request());
    await vi.advanceTimersByTimeAsync(240_000);
    expect(await second.text()).toContain('event: rotate');
    expect(mocks.release).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rechaza el identificador inválido antes de consultar datos', async () => {
    expect(
      (await GET(new NextRequest('https://aulify.example/api/events?activity=no'))).status,
    ).toBe(400);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
