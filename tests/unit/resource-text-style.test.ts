import { expect, it } from 'vitest';
import { resourceTextStyle } from '../../src/lib/resource-text-style';

it('solo admite propiedades visuales del documento, sin expresiones CSS externas', () => {
  expect(
    resourceTextStyle({
      textColor: 'url(https://example.invalid/pixel)',
      backgroundColor: 'var(--private)',
      textAlignment: 'expression(alert(1))',
    }),
  ).toEqual({ color: undefined, backgroundColor: undefined, textAlign: undefined });
  expect(
    resourceTextStyle({
      textColor: '#125634',
      backgroundColor: 'rgb(240, 245, 240)',
      textAlignment: 'right',
    }),
  ).toEqual({ color: '#125634', backgroundColor: 'rgb(240, 245, 240)', textAlign: 'right' });
});
