'use client';
import { BlockNoteSchema, defaultBlockSpecs, type PartialBlock } from '@blocknote/core';
import { es } from '@blocknote/core/locales';
import { createReactBlockSpec, useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import { ArrowUp, ArrowDown } from 'lucide-react';
import '@blocknote/ariakit/style.css';
import type { Block } from '@/domain/types';

const quizBlock = createReactBlockSpec(
  { type: 'quiz', propSchema: { label: { default: 'Actividad interactiva' } }, content: 'none' },
  {
    render: () => (
      <div className="notice" style={{ width: '100%' }}>
        <strong>Actividad interactiva</strong>
        <p>Las preguntas de este recurso aparecen al terminar la explicación.</p>
        <button
          type="button"
          className="button ghost small"
          onClick={() =>
            document.getElementById('preguntas')?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
            })
          }
        >
          Editar las preguntas ↓
        </button>
      </div>
    ),
  },
);
const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    image: defaultBlockSpecs.image,
    video: defaultBlockSpecs.video,
    quiz: quizBlock(),
  },
});

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((v) =>
      typeof v === 'object' && v !== null && 'text' in v
        ? String(v.text)
        : typeof v === 'object' && v !== null && 'content' in v
          ? textOf(v.content)
          : '',
    )
    .join('');
}
export function semanticBlocks(document: unknown[]): Block[] {
  const result: Block[] = [];
  document.forEach((entry, index) => {
    const item = entry as {
      id?: string;
      type?: string;
      content?: unknown;
      props?: Record<string, unknown>;
    };
    const id = item.id || `block-${index}`;
    const text = textOf(item.content);
    if (item.type === 'heading')
      result.push({ id, type: 'heading', text, level: item.props?.level === 3 ? 3 : 2 });
    else if (item.type === 'bulletListItem' || item.type === 'numberedListItem')
      result.push({ id, type: 'list', items: [text], ordered: item.type === 'numberedListItem' });
    else if (item.type === 'image' && typeof item.props?.url === 'string')
      result.push({
        id,
        type: 'image',
        url: item.props.url,
        alt: String(item.props.caption || 'Imagen del recurso'),
      });
    else if (item.type === 'video' && typeof item.props?.url === 'string')
      result.push({
        id,
        type: 'video',
        url: item.props.url,
        title: String(item.props.caption || 'Video de la clase'),
      });
    else if (item.type !== 'quiz' && text) result.push({ id, type: 'text', text });
  });
  return result;
}
function nativeBlocks(blocks: Block[]): PartialBlock<typeof schema.blockSchema>[] {
  return blocks.flatMap<PartialBlock<typeof schema.blockSchema>>((block) => {
    if (block.type === 'heading')
      return [
        {
          id: block.id,
          type: 'heading' as const,
          props: { level: block.level },
          content: block.text,
        },
      ];
    if (block.type === 'text')
      return [{ id: block.id, type: 'paragraph' as const, content: block.text }];
    if (block.type === 'list')
      return block.items.map((text, index) => ({
        id: `${block.id}-${index}`,
        type: block.ordered ? ('numberedListItem' as const) : ('bulletListItem' as const),
        content: text,
      }));
    if (block.type === 'image')
      return [
        { id: block.id, type: 'image' as const, props: { url: block.url, caption: block.alt } },
      ];
    if (block.type === 'video')
      return [
        { id: block.id, type: 'video' as const, props: { url: block.url, caption: block.title } },
      ];
    return [{ id: block.id, type: 'quiz' as const }];
  }) as PartialBlock<typeof schema.blockSchema>[];
}

export default function RichEditor({
  blocks,
  document,
  onChange,
}: {
  blocks: Block[];
  document?: unknown[];
  onChange: (document: unknown[], blocks: Block[]) => void;
}) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: es,
    domAttributes: { editor: { 'aria-label': 'Contenido del recurso' } },
    initialContent: (document?.length ? document : nativeBlocks(blocks)) as PartialBlock<
      typeof schema.blockSchema
    >[],
  });
  return (
    <div className="block-editor">
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={() => {
          // Los bloques sin contenido incluyen propiedades undefined; JSON las omite.
          const document = JSON.parse(JSON.stringify(editor.document)) as unknown[];
          onChange(document, semanticBlocks(document));
        }}
      />
      <details className="advanced" style={{ margin: '18px 22px 0' }}>
        <summary>Ordenar bloques con botones</summary>
        <div className="advanced-content">
          {editor.document.map((block, i) => (
            <div
              className="row between block-order-row"
              key={block.id}
              style={{ padding: '5px 0', fontSize: 12 }}
            >
              <span>
                {i + 1}.{' '}
                {textOf(block.content).slice(0, 45) ||
                  (
                    { quiz: 'Actividad interactiva', image: 'Imagen', video: 'Video' } as Record<
                      string,
                      string
                    >
                  )[block.type] ||
                  'Bloque de texto'}
              </span>
              <div className="row" style={{ gap: 0 }}>
                <button
                  type="button"
                  className="icon-button"
                  disabled={i === 0}
                  aria-label={`Subir bloque ${i + 1}`}
                  onClick={() => editor.moveBlocksUp(block.id)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={i === editor.document.length - 1}
                  aria-label={`Bajar bloque ${i + 1}`}
                  onClick={() => editor.moveBlocksDown(block.id)}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
