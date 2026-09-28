import { NextResponse, type NextRequest } from 'next/server';

export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  return (
    origin === request.nextUrl.origin &&
    (!fetchSite || fetchSite === 'same-origin' || fetchSite === 'none')
  );
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
