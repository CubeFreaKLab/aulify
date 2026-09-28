import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isSameOrigin, readJson, safePath } from '../../src/lib/http';

describe('frontera HTTP del aula', () => {
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
