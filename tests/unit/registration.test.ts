import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock('../../src/lib/supabase/server', () => ({ createSupabaseServer: async () => ({ auth }) }));
import { POST } from '../../src/app/api/auth/route';

const details = {
  email: 'new@example.test',
  name: 'Persona de prueba',
  role: 'student',
  password: 'Una-clave-726!',
};
function request(body: Record<string, unknown>, origin = 'https://aulify.example') {
  return new NextRequest('https://aulify.example/api/auth', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
});

for (const action of ['register', 'update-password']) {
  for (const password of [
    'aaaaaaaa',
    'Aaaaaaa!',
    'aaaaaa1!',
    'AAAAAA1!',
    'Aaaaaa12',
    'Aa1!',
    'Aa1!' + 'a'.repeat(125),
  ]) {
    it(`${action} rechaza contraseña incompleta en servidor: ${password.length}/${password.slice(0, 8)}`, async () => {
      const response = await POST(request({ ...details, action, password }));
      expect(response.status).toBe(400);
      expect(auth.signUp).not.toHaveBeenCalled();
      expect(auth.updateUser).not.toHaveBeenCalled();
    });
  }
}
it('el registro válido normaliza el correo y solicita confirmación sin devolver sesión ni credenciales', async () => {
  auth.signUp.mockImplementation(async ({ options }) => ({
    data: {
      user: { identities: [{ provider: 'email' }], user_metadata: options.data },
      session: null,
    },
    error: null,
  }));
  const response = await POST(
    request({ ...details, action: 'register', email: '  New@Example.test ' }),
  );
  expect(response.status).toBe(200);
  expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.test' }));
  const body = await response.json();
  expect(body.redirect).toBeUndefined();
  expect(body.message).toContain('Te enviamos');
  expect(JSON.stringify(body)).not.toContain(details.password);
});
it('identidad vacía de Supabase se presenta como correo ocupado, sin éxito falso', async () => {
  auth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
  const response = await POST(request({ ...details, action: 'register' }));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'email_registered', field: 'email' });
});
it('un registro sin confirmar se distingue del nuevo aunque Supabase reenvíe el enlace', async () => {
  auth.signUp.mockResolvedValue({
    data: {
      user: {
        identities: [{ provider: 'email' }],
        user_metadata: { name: 'Nombre original', registration_request_id: 'previous-request' },
      },
      session: null,
    },
    error: null,
  });
  const response = await POST(request({ ...details, action: 'register' }));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'email_pending', field: 'email' });
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it('el error explícito de cuenta existente también indica el campo correo', async () => {
  auth.signUp.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: 'user_already_exists', status: 422 },
  });
  const response = await POST(request({ ...details, action: 'register' }));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'email_registered' });
});
it('un límite de envío no se interpreta como correo ya registrado ni éxito', async () => {
  auth.signUp.mockResolvedValue({ data: { user: null }, error: { status: 429 } });
  const response = await POST(request({ ...details, action: 'register' }));
  expect(response.status).toBe(429);
});
it('la nueva regla no bloquea las contraseñas de cuentas existentes al iniciar sesión', async () => {
  auth.signInWithPassword.mockResolvedValue({ error: null });
  const response = await POST(request({ ...details, action: 'access', password: 'aaaaaaaa' }));
  expect(response.status).toBe(200);
  expect(auth.signInWithPassword).toHaveBeenCalled();
});
it('cambiar contraseña exige sesión válida y conserva la regla fuerte', async () => {
  auth.getUser.mockResolvedValue({ data: { user: { id: 'fictional-user' } }, error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  const response = await POST(request({ action: 'update-password', password: details.password }));
  expect(response.status).toBe(200);
  expect(auth.updateUser).toHaveBeenCalledWith({ password: details.password });
});
it('rechaza una solicitud de registro de otro origen', async () => {
  const response = await POST(request({ ...details, action: 'register' }, 'https://other.example'));
  expect(response.status).toBe(403);
  expect(auth.signUp).not.toHaveBeenCalled();
});
