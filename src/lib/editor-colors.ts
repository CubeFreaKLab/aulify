import { createExtension, createStyleSpec, defaultStyleSpecs } from '@blocknote/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node } from '@tiptap/pm/model';
import { resourceTextStyle } from './resource-text-style';

function colorSpan(value: string, kind: 'textColor' | 'backgroundColor') {
  const dom = document.createElement('span');
  Object.assign(dom.style, resourceTextStyle({ [kind]: value }));
  return { dom, contentDOM: dom };
}

export const editorStyleSpecs = {
  ...defaultStyleSpecs,
  textColor: createStyleSpec(
    { type: 'textColor', propSchema: 'string' },
    {
      render: (value) => colorSpan(value, 'textColor'),
      toExternalHTML: (value) => colorSpan(value, 'textColor'),
      parse: (element) => element.style.color || undefined,
    },
  ),
  backgroundColor: createStyleSpec(
    { type: 'backgroundColor', propSchema: 'string' },
    {
      render: (value) => colorSpan(value, 'backgroundColor'),
      toExternalHTML: (value) => colorSpan(value, 'backgroundColor'),
      parse: (element) => element.style.backgroundColor || undefined,
    },
  ),
};

function blockColors(doc: Node) {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isBlock) return;
    const colors = resourceTextStyle(node.attrs);
    const style = [
      colors.color ? `color:${colors.color}` : '',
      colors.backgroundColor ? `background-color:${colors.backgroundColor}` : '',
    ]
      .filter(Boolean)
      .join(';');
    if (style) decorations.push(Decoration.node(pos, pos + node.nodeSize, { style }));
  });
  return DecorationSet.create(doc, decorations);
}

// BlockNote stores arbitrary colors but its built-in CSS paints only named colors.
// Render the same validated colors used by the reader, including table cells.
export const editorBlockColors = createExtension({
  key: 'aulify-block-colors',
  prosemirrorPlugins: [
    new Plugin<DecorationSet>({
      key: new PluginKey('aulify-block-colors'),
      state: {
        init: (_, state) => blockColors(state.doc),
        apply: (transaction, decorations) =>
          transaction.docChanged ? blockColors(transaction.doc) : decorations,
      },
      props: {
        decorations(state) {
          return this.getState(state);
        },
      },
    }),
  ],
});
