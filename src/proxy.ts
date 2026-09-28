import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabaseConfig, supabaseConfig } from './lib/supabase/config';

export async function proxy(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();
  const client = createServerClient(url, key, {
    cookieOptions: {
      sameSite: 'lax',
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (entries, headers) => {
        entries.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        entries.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/aula/:path*', '/api/:path*', '/auth/:path*', '/restablecer'] };
