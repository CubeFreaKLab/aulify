import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createDemoState, decodeDemoState } from '../../src/domain';
import { editorLinkError } from '../../src/domain/editor-links';
import { ResourceReader } from '../../src/components/resource-reader';

vi.mock('@/lib/rich-document', () => import('../../src/lib/rich-document'));
vi.mock('@/lib/resource-text-style', () => import('../../src/lib/resource-text-style'));
vi.mock('@/styles/rich-editor.css', () => ({}));
vi.mock('@/styles/resource-text.css', () => ({}));
vi.mock('../../src/components/resource-image', () => ({ ResourceImage: () => null }));
vi.mock('../../src/components/resource-video', () => ({ ResourceVideo: () => null }));

describe('lector de documentos históricos: defensa al representar enlaces', () => {
  it.each(['javascript:void(0)', 'data:text/html,marcador', 'vbscript:rem marcador', null])(
    'conserva como texto el enlace legado %s aunque la restauración lo rechace',
    (href) => {
      const document = [
        {
          type: 'paragraph',
          content: [
            { type: 'link', href, content: [{ text: 'Destino legado' }] },
            {
              type: 'link',
              href: 'https://example.test/material',
              content: [{ text: 'Referencia HTTPS' }],
            },
          ],
        },
        { type: 'codeBlock', content: [{ text: '<script>Ejemplo educativo</script>' }] },
      ];
      const state = createDemoState();
      state.resources[0].editorDocument = document;
      expect(() => decodeDemoState(JSON.stringify(state))).toThrow(editorLinkError);

      // Entrada directa a la representación: no simula un nuevo guardado aceptado.
      const markup = renderToStaticMarkup(
        createElement(ResourceReader, { title: 'Documento histórico', blocks: [], document }),
      );
      expect(markup).toContain('Destino legado');
      expect(markup.match(/<a\b/g)).toHaveLength(1);
      expect(markup).toContain('href="https://example.test/material"');
      expect(markup).toContain('rel="noopener noreferrer"');
      expect(markup).not.toMatch(/href="(?:javascript|data|vbscript):/i);
      expect(markup).toContain('&lt;script&gt;Ejemplo educativo&lt;/script&gt;');
      expect(markup).not.toContain('<script>');
    },
  );
});
