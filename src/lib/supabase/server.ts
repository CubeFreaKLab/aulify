import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
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
        try {
          entries.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components are read-only; proxy persists refreshed cookies.
        }
      },
    },
  });
}
