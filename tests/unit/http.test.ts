import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { authFailureResponse, isSameOrigin, readJson, safePath } from '../../src/lib/http';

describe('frontera HTTP del aula', () => {
  it('distingue indisponibilidad de Auth de una sesión inválida', async () => {
    for (const error of [{ status: 429 }, { status: 503 }, { name: 'AuthRetryableFetchError' }]) {
      const response = authFailureResponse(error);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: 'No pudimos verificar tu sesión en este momento. Intenta de nuevo.',
      });
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(response.headers.get('Retry-After')).toBe('30');
    }
    expect(authFailureResponse({ status: 401 }).status).toBe(401);
    expect(authFailureResponse({ name: 'AuthInvalidJwtError' }).status).toBe(401);
    expect(authFailureResponse(null).status).toBe(401);
  });
  it('rechaza solicitudes cruzadas y sin origen aunque tengan cookies', () => {
    for (const origin of ['https://otro.example', '', 'null']) {
      const request = new NextRequest('https://aulify.example/api/commands', {
        method: 'POST',
        headers: { origin, cookie: 'session=example' },
      });
      expect(isSameOrigin(request)).toBe(false);
    }
    expect(
      isSameOrigin(
        new NextRequest('https://aulify.example/api/commands', {
          method: 'POST',
          headers: { origin: 'https://aulify.example', 'sec-fetch-site': 'same-origin' },
        }),
      ),
    ).toBe(true);
  });
  it('no permite redirecciones externas tras autenticar', () => {
    for (const path of [
      '//otro.example',
      '/\\otro.example',
      'https://otro.example',
      '/\n/otro.example',
      null,
    ])
      expect(safePath(path)).toBe('/aula');
    expect(safePath('/restablecer')).toBe('/restablecer');
  });
  it('tolera la normalización local de Next sin permitir otro puerto ni otro sitio', () => {
    const request = (origin: string) =>
      new NextRequest('http://localhost:3002/api/auth', {
        headers: { origin, 'sec-fetch-site': 'same-origin' },
      });
    expect(isSameOrigin(request('http://127.0.0.1:3002'))).toBe(true);
    expect(isSameOrigin(request('http://127.0.0.1:3001'))).toBe(false);
    expect(isSameOrigin(request('http://localhost.evil.example:3002'))).toBe(false);
    expect(isSameOrigin(request('https://127.0.0.1:3002'))).toBe(false);
  });
  it('rechaza cuerpos grandes, arrays y contenido no JSON', async () => {
    const request = (body: string, type = 'application/json') =>
      new NextRequest('https://aulify.example/api/commands', {
        method: 'POST',
        headers: { 'content-type': type },
        body,
      });
    await expect(readJson(request('{"texto":"abcdefghijklmn"}'), 10)).rejects.toThrow();
    await expect(readJson(request('[]'))).rejects.toThrow();
    await expect(readJson(request('{}', 'text/plain'))).rejects.toThrow();
    await expect(readJson(request('{"action":"startAttempt"}'))).resolves.toEqual({
      action: 'startAttempt',
    });
  });
});
