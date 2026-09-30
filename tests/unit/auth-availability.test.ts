import { afterEach, describe, expect, it, vi } from 'vitest';
import { authAvailability } from '../../src/lib/supabase/auth-availability';

const url = 'https://unit.supabase.co';
const refresh = `${url}/auth/v1/token?grant_type=refresh_token`;

afterEach(() => vi.unstubAllGlobals());

describe('estado transitorio por operación Auth', () => {
  it('no borra el fallo de renovación por éxitos de otros endpoints', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockImplementation(async () => Response.json({}));
    vi.stubGlobal('fetch', transport);
    const availability = authAvailability(url);
    await availability.fetch(refresh, { method: 'POST' });
    for (const other of [
      `${url}/rest/v1/rpc/aulify_snapshot`,
      `${url}/auth/v1/user`,
      `${url}/auth/v1/.well-known/jwks.json`,
      `${url}/auth/v1/token?grant_type=password`,
      'https://other.example.test/auth/v1/token?grant_type=refresh_token',
    ]) {
      await availability.fetch(other, { method: 'POST' });
      expect(availability.failure).toEqual({ status: 503 });
    }
    await availability.fetch(refresh, { method: 'GET' });
    expect(availability.failure).toEqual({ status: 503 });
    await availability.fetch(new Request(refresh, { method: 'POST' }));
    expect(availability.failure).toBeNull();
  });

  it('mantiene otros fallos pendientes aunque una operación se recupere', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({}, { status: 503 }))
        .mockResolvedValueOnce(Response.json({}, { status: 429 }))
        .mockResolvedValueOnce(Response.json({})),
    );
    const availability = authAvailability(url);
    await availability.fetch(refresh, { method: 'POST' });
    await availability.fetch(`${url}/auth/v1/user`);
    await availability.fetch(refresh, { method: 'POST' });
    expect(availability.failure).toEqual({ status: 429 });
  });

  it('retira un fallo de transporte cuando la misma operación se recupera', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(Response.json({})),
    );
    const availability = authAvailability(url);
    await expect(availability.fetch(refresh, { method: 'POST' })).rejects.toThrow('fetch failed');
    expect(availability.failure).toEqual({ name: 'AuthRetryableFetchError' });
    await availability.fetch(refresh, { method: 'POST' });
    expect(availability.failure).toBeNull();
  });
});
