import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';
import { authAvailability } from './auth-availability';
import { supabaseTransport } from './transport';

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  const { url, key } = supabaseConfig();
  const availability = authAvailability(url, supabaseTransport(url));
  return createServerClient(url, key, {
    global: { fetch: availability.fetch },
    cookieOptions: {
      sameSite: 'lax',
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production' &&
        process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://'),
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries) => {
        if (availability.failure) return;
        try {
          entries.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components are read-only; proxy persists refreshed cookies.
        }
      },
    },
  });
}
