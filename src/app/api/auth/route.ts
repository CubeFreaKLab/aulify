import type { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { isSameOrigin, jsonResponse, readJson } from '@/lib/http';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Origen de solicitud no válido.' }, 403);
  try {
    const data = await readJson(request, 4096);
    const action = data.action;
    const supabase = await createSupabaseServer();
    if (action === 'signout') {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      return error
        ? jsonResponse({ error: 'No pudimos cerrar la sesión. Intenta otra vez.' }, 503)
        : jsonResponse({ ok: true });
    }
    if (!['access', 'register', 'recover', 'update-password'].includes(String(action)))
      return jsonResponse({ error: 'Acción no válida.' }, 400);
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (
      action !== 'update-password' &&
      (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
      return jsonResponse({ error: 'Escribe un correo electrónico válido.' }, 400);
    if (
      action !== 'recover' &&
      (!password || password.length > 128 || (action !== 'access' && password.length < 8))
    )
      return jsonResponse({ error: 'La contraseña debe tener entre 8 y 128 caracteres.' }, 400);
    const origin = request.headers.get('origin')!;
    if (action === 'access') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error)
        return jsonResponse(
          {
            error:
              error.code === 'email_not_confirmed'
                ? 'Confirma tu correo con el enlace de registro antes de entrar.'
                : 'No pudimos iniciar sesión. Revisa tu correo y contraseña.',
          },
          error.status === 429 ? 429 : 401,
        );
      return jsonResponse({ ok: true, redirect: '/aula' });
    }
    if (action === 'register') {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (
        name.length < 2 ||
        name.length > 100 ||
        !['teacher', 'student'].includes(String(data.role))
      )
        return jsonResponse({ error: 'Completa tu nombre y elige tu perfil.' }, 400);
      const { data: account, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role: data.role }, emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error)
        return jsonResponse(
          {
            error:
              error.status === 429
                ? 'Hay demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
                : 'No pudimos completar el registro. Intenta de nuevo más tarde.',
          },
          error.status === 429 ? 429 : 400,
        );
      return jsonResponse({
        ok: true,
        redirect: account.session ? '/aula' : undefined,
        message:
          'Revisa tu correo para confirmar tu cuenta. Si ya tienes una cuenta, puedes iniciar sesión o recuperar el acceso.',
      });
    }
    if (action === 'recover') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/restablecer`,
      });
      if (error && error.status === 429)
        return jsonResponse(
          { error: 'Hay demasiados solicitudes. Espera unos minutos y vuelve a intentarlo.' },
          429,
        );
      if (error && error.status && error.status >= 500)
        return jsonResponse(
          {
            error:
              'El envío de correos no está disponible en este momento. Vuelve a intentarlo más tarde.',
          },
          503,
        );
      return jsonResponse({
        ok: true,
        message:
          'Si existe una cuenta con ese correo y permite recuperar el acceso, recibirás un enlace. Revisa también la carpeta de correo no deseado.',
      });
    }
    const { data: current, error: identityError } = await supabase.auth.getUser();
    if (identityError || !current.user)
      return jsonResponse(
        { error: 'El enlace ha caducado. Solicita uno nuevo para recuperar el acceso.' },
        401,
      );
    const { error } = await supabase.auth.updateUser({ password });
    if (error)
      return jsonResponse(
        {
          error:
            'No pudimos actualizar la contraseña. Prueba una contraseña diferente o solicita un nuevo enlace.',
        },
        400,
      );
    await supabase.auth.signOut({ scope: 'global' });
    return jsonResponse({ ok: true, redirect: '/acceso?password=updated' });
  } catch {
    return jsonResponse(
      { error: 'No pudimos procesar la solicitud. Intenta de nuevo en unos momentos.' },
      400,
    );
  }
}
