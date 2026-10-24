import { describe, expect, it } from 'vitest';
import { unstable_doesMiddlewareMatch as doesProxyMatch } from 'next/experimental/testing/server';
import { config } from '../../src/proxy';

describe('rutas que requieren el proxy de sesión', () => {
  it.each(['/api/sync?activity=example', '/api/workspace', '/api/commands'])(
    'deja que %s verifique su sesión en el handler',
    (url) => {
      expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
    },
  );

  it.each([
    '/',
    '/aula',
    '/aula/materias',
    '/api/auth',
    '/api/files',
    '/api/files/example',
    '/auth/callback',
    '/restablecer',
  ])('conserva la renovación previa en %s', (url) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
  });
});
