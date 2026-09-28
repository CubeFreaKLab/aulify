import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { safePath } from '@/lib/http';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const client = await createSupabaseServer();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safePath(request.nextUrl.searchParams.get('next')), request.url),
      );
  }
  return NextResponse.redirect(new URL('/acceso?error=enlace', request.url));
}
