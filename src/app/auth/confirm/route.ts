import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  if (token_hash && (type === 'signup' || type === 'recovery' || type === 'email')) {
    const client = await createSupabaseServer();
    const { error } = await client.auth.verifyOtp({ token_hash, type });
    if (!error)
      return NextResponse.redirect(
        new URL(type === 'recovery' ? '/restablecer' : '/aula', request.url),
      );
  }
  return NextResponse.redirect(new URL('/acceso?error=enlace', request.url));
}
