import { NextResponse, type NextRequest } from 'next/server';
import { isAuthUnavailable, type AuthFailure } from './supabase/auth-availability';

export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export function authFailureResponse(error?: AuthFailure | null) {
  const unavailable = isAuthUnavailable(error);
  const response = jsonResponse(
    {
      error: unavailable
        ? 'No pudimos verificar tu sesión en este momento. Intenta de nuevo.'
        : 'Tu sesión terminó. Vuelve a iniciar sesión.',
    },
    unavailable ? 503 : 401,
  );
  if (unavailable) response.headers.set('Retry-After', '30');
  return response;
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (!origin || (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none')) return false;
  if (origin === request.nextUrl.origin) return true;
  // Next normaliza 127.0.0.1 a localhost; conserva puerto y protocolo al comparar.
  try {
    const source = new URL(origin),
      target = request.nextUrl;
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    return (
      loopback.has(source.hostname) &&
      loopback.has(target.hostname) &&
      source.port === target.port &&
      source.protocol === target.protocol
    );
  } catch {
    return false;
  }
}

export async function readJson(
  request: NextRequest,
  maxBytes = 32_768,
): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new Error('Formato de solicitud no válido.');
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > maxBytes)
    throw new Error('La solicitud supera el tamaño permitido.');
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('La solicitud no es válida.');
  return parsed as Record<string, unknown>;
}

export function safePath(value: string | null, fallback = '/aula') {
  return value && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u001f]/.test(value) ? value : fallback;
}
