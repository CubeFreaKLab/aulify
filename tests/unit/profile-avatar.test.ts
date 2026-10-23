import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../src/app/api/profile/avatar/route';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: mocks }),
}));
vi.mock('@/lib/http', () => import('../../src/lib/http'));
vi.mock('@/domain/avatars', () => import('../../src/domain/avatars'));
const request = (body: unknown, origin = 'https://aulify.example') =>
  new NextRequest('https://aulify.example/api/profile/avatar', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'verified-user', user_metadata: { avatar_id: 'm01', role: 'untrusted' } } },
    error: null,
  });
  mocks.updateUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
});
describe('Avatar de la cuenta autenticada', () => {
  it('solo devuelve la preferencia de apariencia de la identidad verificada', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ userId: 'verified-user', avatarId: 'm01' });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('rechaza lectura y escritura sin sesión', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ avatarId: 'h06' }))).status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('rechaza otro origen antes de actualizar una cuenta', async () => {
    expect((await POST(request({ avatarId: 'h06' }, 'https://other.example'))).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it.each([
    { avatarId: '../other.svg' },
    { avatarId: 'h16' },
    { avatarId: 'h01', userId: 'foreign-user' },
    { avatarId: 'h01', role: 'teacher' },
  ])('rechaza rutas, identificadores ajenos y campos adicionales: %o', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('actualiza únicamente el avatar de la sesión actual', async () => {
    const response = await POST(request({ avatarId: 'h06' }));
    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledExactlyOnceWith({ data: { avatar_id: 'h06' } });
    expect(await response.json()).toEqual({ userId: 'verified-user', avatarId: 'h06' });
  });
  it('no comunica éxito cuando el proveedor rechaza la actualización', async () => {
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'provider failure' },
    });
    expect((await POST(request({ avatarId: 'h06' }))).status).toBe(503);
  });
});
