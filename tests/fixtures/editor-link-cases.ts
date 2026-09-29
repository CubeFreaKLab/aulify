export const literalCode =
  '<script>globalThis.__aulify_ap33_literal="opened"</script>\n<a href="javascript:void(0)">Ejemplo de código, no enlace activo</a>';

const prefix = 'https://example.test/';
export const maximumHref = prefix + 'a'.repeat(8192 - prefix.length);

export const allowedHrefs = [
  'https://example.test/leccion?tema=plantas#resumen',
  'HTTPS://example.test/LECCION',
  'https://example.test/ruta/javascript:ejemplo',
  'https://example.test/explicaci%C3%B3n',
];

export const rejectedHrefs: unknown[] = [
  "javascript:void(globalThis.__aulify_ap33_marker='opened')",
  'JaVaScRiPt:void(0)',
  'data:text/html,<p>Marcador AP-33</p>',
  'vbscript:rem marcador',
  'http://example.test/material',
  'java\tscript:void(0)',
  '\nhttps://example.test',
  'https://example.test/\rmarcador',
  'https://example.test/\u001fmarcador',
  'https://example.test/\u007fmarcador',
  'https://example.test/\u00a0marcador',
  'https://example.test/\u2009marcador',
  'https://example.test/ marcador',
  ' https://example.test',
  'https://',
  'https://?tema=sin-dominio',
  '//example.test',
  null,
  42,
];

export function documentWithHref(href: unknown) {
  return [
    {
      id: 'ap33-group',
      type: 'toggleListItem',
      content: [{ type: 'text', text: 'Material de la clase', styles: {} }],
      children: [
        {
          id: 'ap33-paragraph',
          type: 'paragraph',
          content: [
            {
              type: 'link',
              href,
              content: [{ type: 'text', text: 'Material HTTPS de ejemplo', styles: {} }],
            },
          ],
        },
        {
          id: 'ap33-code',
          type: 'codeBlock',
          props: { language: 'html' },
          content: [{ type: 'text', text: literalCode, styles: {} }],
        },
      ],
    },
    {
      id: 'ap33-literal',
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Texto literal: javascript:, data:, vbscript: y <script>.',
          styles: {},
        },
      ],
    },
  ];
}
