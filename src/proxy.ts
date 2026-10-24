import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabaseConfig, supabaseConfig } from './lib/supabase/config';
import { authAvailability, isAuthUnavailable } from './lib/supabase/auth-availability';
import { authFailureResponse } from './lib/http';

export async function proxy(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();
  const availability = authAvailability(url);
  const client = createServerClient(url, key, {
    global: { fetch: availability.fetch },
    cookieOptions: {
      sameSite: 'lax',
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (entries, headers) => {
        if (availability.failure) return;
        entries.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        entries.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  const { data, error } = await client.auth.getClaims();
  if (availability.failure || isAuthUnavailable(error))
    return authFailureResponse(availability.failure ?? error);
  response.headers.set('Cache-Control', 'private, no-store');
  if (request.nextUrl.pathname === '/' && !error && data?.claims?.sub) {
    const home = NextResponse.redirect(new URL('/aula', request.url));
    // Keep rotated session cookies when returning through the public address.
    response.cookies.getAll().forEach((cookie) => home.cookies.set(cookie));
    home.headers.set('Cache-Control', 'private, no-store');
    return home;
  }
  return response;
}

// Las rutas de sondeo, lectura y comandos renuevan y verifican la sesión dentro
// de su propio handler. No necesitan una segunda ejecución previa del proxy.
export const config = {
  matcher: ['/', '/aula/:path*', '/api/auth', '/api/files/:path*', '/auth/:path*', '/restablecer'],
};
