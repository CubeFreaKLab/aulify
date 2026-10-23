import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));
vi.mock('../../src/lib/supabase/server', () => ({
  createSupabaseServer: async () => ({ auth: { verifyOtp } }),
}));
import { GET } from '../../src/app/auth/confirm/route';

afterEach(() => vi.resetAllMocks());
for (const [file, type, destination] of [
  ['confirmar-correo', 'email', '/aula'],
  ['recuperar-contrasena', 'recovery', '/restablecer'],
]) {
  it(`${file}: el enlace de la plantilla verifica el token sin código PKCE`, async () => {
    const html = readFileSync(`supabase/templates/${file}.html`, 'utf8');
    const link = html
      .match(/href="([^\"]*\/auth\/confirm[^\"]*)"/)![1]
      .replaceAll('&amp;', '&')
      .replace('{{ .SiteURL }}', 'https://aulify.example')
      .replace('{{ .TokenHash }}', 'fictitious-token-hash');
    verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(new NextRequest(link));
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'fictitious-token-hash', type });
    expect(response.headers.get('location')).toBe(`https://aulify.example${destination}`);
  });
}
it('token vencido o reutilizado vuelve a un aviso sin autorizar el aula', async () => {
  verifyOtp.mockResolvedValue({ error: { code: 'otp_expired' } });
  const response = await GET(
    new NextRequest('https://aulify.example/auth/confirm?token_hash=used&type=email'),
  );
  expect(response.headers.get('location')).toBe('https://aulify.example/acceso?error=enlace');
});
it('un tipo ajeno al flujo no se intercambia por una sesión', async () => {
  await GET(new NextRequest('https://aulify.example/auth/confirm?token_hash=x&type=invite'));
  expect(verifyOtp).not.toHaveBeenCalled();
});
