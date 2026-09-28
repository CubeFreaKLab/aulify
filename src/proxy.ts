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
  const { error } = await client.auth.getClaims();
  if (availability.failure || isAuthUnavailable(error))
    return authFailureResponse(availability.failure ?? error);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/aula/:path*', '/api/:path*', '/auth/:path*', '/restablecer'] };
