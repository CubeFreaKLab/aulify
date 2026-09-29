'use client';
/* eslint-disable @next/next/no-img-element -- User images include authenticated URLs and local demo data; they are loaded directly with a validated source. */
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  createHeadingBlockSpec,
  type PartialBlock,
} from '@blocknote/core';
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { es } from '@blocknote/core/locales';
import { closeHistory } from '@tiptap/pm/history';
import {
  createReactBlockSpec,
  useCreateBlockNote,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import {
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  ImagePlus,
  Plus,
  MessageCircleQuestion,
} from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import '@blocknote/ariakit/style.css';
import '@/styles/rich-editor.css';
import '@/styles/resource-text.css';
import type { Block } from '@/domain/types';
import { safeImageUrl } from '@/domain';
import { isAllowedEditorHref } from '@/domain/editor-links';
import { duplicateTree, semanticBlocks, textOf } from '@/lib/rich-document';
import { uploadFile } from '@/lib/upload';
import {
  resourceImageLayout,
  resourceImageStyle,
  type ImageLayout,
} from '@/lib/resource-image-layout';
import { ResourceImage } from './resource-image';
import { useResolvedTheme } from './theme';
import { Button, DialogPanel, Field } from './ui';
import { VideoBlockEditor } from './video-block-editor';
export { semanticBlocks } from '@/lib/rich-document';

const ImageEditorContext = createContext<(id: string) => void>(() => {});
function ImageBlockView({
  id,
  url,
  alt,
  caption,
  widthPercent,
  imageAlignment,
  onLayoutChange,
}: {
  id: string;
  url: string;
  alt: string;
  caption: string;
  widthPercent: number;
  imageAlignment: string;
  onLayoutChange: (layout: ImageLayout) => void;
}) {
  const edit = useContext(ImageEditorContext);
  return (
    <ResourceImage
      url={url}
      alt={alt || caption}
      caption={caption}
      widthPercent={widthPercent}
      imageAlignment={imageAlignment}
      onEdit={() => edit(id)}
      onLayoutChange={onLayoutChange}
    />
  );
}
const imageBlock = createReactBlockSpec(
  {
    type: 'image',
    propSchema: {
      url: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      fileId: { default: '' },
      widthPercent: { default: 100 },
      imageAlignment: { default: 'center', values: ['left', 'center', 'right'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <ImageBlockView
        id={block.id}
        {...block.props}
        onLayoutChange={(layout) => editor.updateBlock(block, { props: layout })}
      />
    ),
    toExternalHTML: ({ block }) => (
      <figure style={resourceImageStyle(resourceImageLayout(block.props))}>
        <img
          src={safeImageUrl(block.props.url) ? block.props.url : undefined}
          alt={block.props.alt || block.props.caption}
          style={{ width: '100%', height: 'auto' }}
        />
        <figcaption>{block.props.caption}</figcaption>
      </figure>
    ),
  },
);
const videoBlock = createReactBlockSpec(
  {
    type: 'video',
    propSchema: { url: { default: '' }, caption: { default: '' } },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <VideoBlockEditor
        url={block.props.url}
        caption={block.props.caption}
        onChange={(props) => editor.updateBlock(block, { props })}
      />
    ),
  },
);
const quizBlock = createReactBlockSpec(
  { type: 'quiz', propSchema: { label: { default: 'Actividad interactiva' } }, content: 'none' },
  {
    render: () => (
      <div className="editor-quiz-link">
        <MessageCircleQuestion size={22} aria-hidden="true" />
        <div>
          <strong>Actividad interactiva</strong>
          <p>Preguntas al finalizar la lectura.</p>
        </div>
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
// Extend the installed block specs without changing their editing and paste behavior.
const accessibleChecklist: typeof defaultBlockSpecs.checkListItem = {
  ...defaultBlockSpecs.checkListItem,
  implementation: {
    ...defaultBlockSpecs.checkListItem.implementation,
    render(block, editor) {
      const rendered = defaultBlockSpecs.checkListItem.implementation.render.call(
        this,
        block,
        editor,
      );
      const checkbox = rendered.dom.querySelector('input[type="checkbox"]');
      checkbox?.setAttribute('aria-label', 'Marcar elemento de la lista');
      if (rendered.contentDOM) {
        rendered.contentDOM.id = `check-content-${block.id}`;
        checkbox?.setAttribute('aria-describedby', rendered.contentDOM.id);
      }
      return rendered;
    },
  },
};
const accessibleToggle: typeof defaultBlockSpecs.toggleListItem = {
  ...defaultBlockSpecs.toggleListItem,
  implementation: {
    ...defaultBlockSpecs.toggleListItem.implementation,
    render(block, editor) {
      const rendered = defaultBlockSpecs.toggleListItem.implementation.render.call(
        this,
        block,
        editor,
      );
      const button = rendered.dom.querySelector('.bn-toggle-button');
      const wrapper = rendered.dom.querySelector('.bn-toggle-wrapper');
      const update = () =>
        button?.setAttribute(
          'aria-expanded',
          String(wrapper?.getAttribute('data-show-children') === 'true'),
        );
      button?.setAttribute('aria-label', 'Mostrar u ocultar contenido');
      if (rendered.contentDOM) {
        rendered.contentDOM.id = `toggle-content-${block.id}`;
        button?.setAttribute('aria-describedby', rendered.contentDOM.id);
      }
      update();
      const observer = new MutationObserver(update);
      if (wrapper)
        observer.observe(wrapper, { attributes: true, attributeFilter: ['data-show-children'] });
      return {
        ...rendered,
        ignoreMutation: (mutation) =>
          (mutation.type === 'attributes' && mutation.target === button) ||
          !!rendered.ignoreMutation?.(mutation),
        destroy: () => {
          observer.disconnect();
          rendered.destroy?.();
        },
      };
    },
  },
};
const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: createHeadingBlockSpec({ levels: [1, 2, 3, 4] }),
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: accessibleChecklist,
    toggleListItem: accessibleToggle,
    quote: defaultBlockSpecs.quote,
    codeBlock: defaultBlockSpecs.codeBlock,
    table: defaultBlockSpecs.table,
    divider: defaultBlockSpecs.divider,
    image: imageBlock(),
    video: videoBlock(),
    quiz: quizBlock(),
  },
});
type EditorBlock = PartialBlock<typeof schema.blockSchema>;
function nativeBlocks(blocks: Block[]): EditorBlock[] {
  return blocks.flatMap<EditorBlock>((block) => {
    if (block.type === 'heading')
      return [
        { id: block.id, type: 'heading', props: { level: block.level }, content: block.text },
      ];
    if (block.type === 'text') return [{ id: block.id, type: 'paragraph', content: block.text }];
    if (block.type === 'list')
      return block.items.map((text, i) => ({
        id: i === 0 ? block.id : crypto.randomUUID(),
        type: block.ordered ? 'numberedListItem' : 'bulletListItem',
        content: text,
      }));
    if (block.type === 'image')
      return [
        {
          id: block.id,
          type: 'image',
          props: {
            url: block.url,
            alt: block.alt,
            caption: block.caption || '',
            fileId: block.fileId || '',
            ...resourceImageLayout(block),
          },
        },
      ];
    if (block.type === 'video')
      return [{ id: block.id, type: 'video', props: { url: block.url, caption: block.title } }];
    return [{ id: block.id, type: 'quiz' }];
  });
}
function validateImageLoad(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    const timer = window.setTimeout(() => {
      image.src = '';
      reject(
        new Error('La imagen tardó demasiado en cargar. Prueba otra dirección o sube el archivo.'),
      );
    }, 12000);
    image.onload = () => {
      clearTimeout(timer);
      if (image.naturalWidth) resolve();
      else reject(new Error('La dirección no contiene una imagen.'));
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('No se pudo cargar esa imagen. Revisa el enlace o sube el archivo.'));
    };
    image.src = url;
  });
}
const blockNames: Record<string, string> = {
  paragraph: 'Texto',
  heading: 'Encabezado',
  image: 'Imagen',
  video: 'Video',
  quiz: 'Actividad interactiva',
  table: 'Tabla',
  codeBlock: 'Código',
  toggleListItem: 'Desplegable',
  checkListItem: 'Lista de tareas',
  quote: 'Cita',
  divider: 'Separador',
};

export default function RichEditor({
  blocks,
  document: initialDocument,
  onChange,
}: {
  blocks: Block[];
  document?: unknown[];
  onChange: (document: unknown[], blocks: Block[]) => void;
}) {
  const real = usePathname().startsWith('/aula');
  const theme = useResolvedTheme();
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [imageTarget, setImageTarget] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editor = useCreateBlockNote({
    schema,
    dictionary: {
      ...es,
      placeholders: { ...es.placeholders, default: 'Escribe o usa / para añadir un bloque' },
    },
    dropCursor: { color: 'var(--green-text)', width: 3 },
    domAttributes: { editor: { 'aria-label': 'Contenido del recurso' } },
    initialContent: (initialDocument?.length
      ? initialDocument
      : nativeBlocks(blocks)) as EditorBlock[],
    link: { isValidLink: isAllowedEditorHref },
  });
  function command(action: () => void) {
    editor.transact((tr) => {
      closeHistory(tr);
      action();
    });
    editor.transact((tr) => {
      closeHistory(tr);
    });
  }
  function openImage(id: string) {
    const block = editor.getBlock(id);
    if (block?.type !== 'image') return;
    setImageTarget(id);
    setImageUrl(block.props.url);
    setImageAlt(block.props.alt || block.props.caption);
    setImageCaption(block.props.caption);
    setFile(null);
    setError('');
  }
  async function saveImage() {
    if (!imageAlt.trim()) {
      setError('Describe brevemente la imagen para quien no pueda verla.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let url = imageUrl.trim();
      let fileId = '';
      if (file) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
          throw new Error('Usa una imagen PNG, JPEG o WebP.');
        if (file.size > (real ? 5 : 3) * 1024 * 1024)
          throw new Error(
            real
              ? 'La imagen supera los 5 MiB.'
              : 'En la demostración usa imágenes de hasta 3 MiB.',
          );
        const localUrl = URL.createObjectURL(file);
        try {
          await validateImageLoad(localUrl);
        } finally {
          URL.revokeObjectURL(localUrl);
        }
        if (real) {
          const uploaded = await uploadFile(file, 'resource');
          url = uploaded.url;
          fileId = uploaded.id;
        } else
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            reader.readAsDataURL(file);
          });
      } else {
        if (
          !safeImageUrl(url) ||
          (!url.startsWith('/api/files/') &&
            !url.startsWith('data:image/') &&
            !/^https:\/\//i.test(url))
        )
          throw new Error('Usa un enlace HTTPS a una imagen o sube el archivo.');
        await validateImageLoad(url);
        fileId = url.match(/^\/api\/files\/([0-9a-f-]{36})$/i)?.[1] || '';
      }
      if (imageTarget)
        editor.updateBlock(imageTarget, {
          type: 'image',
          props: { url, alt: imageAlt.trim(), caption: imageCaption.trim(), fileId },
        });
      setImageTarget(null);
      setMessage('Imagen añadida con su descripción.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo añadir la imagen.');
    } finally {
      setBusy(false);
    }
  }
  function insert(type: keyof typeof schema.blockSchema) {
    const value: EditorBlock =
      type === 'table'
        ? {
            type: 'table',
            content: {
              type: 'tableContent',
              rows: [{ cells: ['', '', ''] }, { cells: ['', '', ''] }],
            },
          }
        : ({ type } as EditorBlock);
    const block = insertOrUpdateBlockForSlashMenu(editor, value);
    if (type === 'image') openImage(block.id);
    else editor.focus();
  }
  function outline(items: typeof editor.document, depth = 0): React.ReactNode {
    return items.map((block, i) => (
      <div
        key={block.id}
        className="block-outline-item"
        style={{ '--outline-depth': Math.min(depth, 3) } as React.CSSProperties}
      >
        <div className="block-order-row">
          <span>
            {i + 1}. {textOf(block.content).slice(0, 70) || blockNames[block.type] || 'Lista'}
          </span>
          <div className="row block-controls">
            <button
              type="button"
              className="icon-button"
              disabled={i === 0}
              aria-label={`Subir bloque ${i + 1}`}
              title="Subir"
              onClick={() => command(() => editor.moveBlocksUp(block.id))}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              disabled={i === items.length - 1}
              aria-label={`Bajar bloque ${i + 1}`}
              title="Bajar"
              onClick={() => command(() => editor.moveBlocksDown(block.id))}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Duplicar bloque ${i + 1}`}
              title="Duplicar"
              onClick={() => {
                command(() =>
                  editor.insertBlocks([duplicateTree(block) as EditorBlock], block, 'after'),
                );
                setMessage('Bloque duplicado.');
              }}
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Eliminar bloque ${i + 1}`}
              title="Eliminar"
              onClick={() => {
                command(() => editor.removeBlocks([block]));
                setMessage('Bloque eliminado. Puedes recuperarlo con Deshacer.');
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        {block.children.length > 0 && outline(block.children as typeof editor.document, depth + 1)}
      </div>
    ));
  }
  void revision;
  return (
    <ImageEditorContext.Provider value={openImage}>
      <div className="block-editor">
        <div className="editor-controls" role="group" aria-label="Herramientas del documento">
          <button
            className="icon-button editor-history-button"
            type="button"
            aria-label="Deshacer"
            title="Deshacer (Ctrl+Z)"
            onClick={() => {
              setMessage(editor.undo() ? 'Cambio deshecho.' : 'No hay cambios para deshacer.');
            }}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button editor-history-button"
            type="button"
            aria-label="Rehacer"
            title="Rehacer (Ctrl+Mayús+Z)"
            onClick={() => {
              setMessage(editor.redo() ? 'Cambio restaurado.' : 'No hay cambios para rehacer.');
            }}
          >
            <Redo2 size={17} />
          </button>
          <label className="editor-insert-label">
            <Plus size={16} />
            <span className="sr-only">Insertar bloque</span>
            <select
              aria-label="Insertar bloque"
              value=""
              onChange={(e) => {
                if (e.target.value) insert(e.target.value as keyof typeof schema.blockSchema);
              }}
            >
              <option value="">Insertar bloque</option>
              {Object.entries({
                ...blockNames,
                bulletListItem: 'Lista con viñetas',
                numberedListItem: 'Lista numerada',
              }).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="editor-help">
          Escribe <kbd>/</kbd> para añadir un bloque o selecciona texto para darle formato.
        </p>
        <BlockNoteView
          editor={editor}
          theme={theme}
          slashMenu={false}
          filePanel={false}
          onChange={() => {
            const doc = JSON.parse(JSON.stringify(editor.document)) as unknown[];
            onChange(doc, semanticBlocks(doc));
            setRevision((n) => n + 1);
          }}
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(
                [
                  ...getDefaultReactSlashMenuItems(editor).filter(
                    (item) =>
                      ![es.slash_menu.image.title, es.slash_menu.video.title].includes(item.title),
                  ),
                  {
                    title: 'Imagen',
                    subtext: 'Sube una imagen con descripción',
                    aliases: ['foto', 'imagen', 'image'],
                    group: 'Materiales',
                    icon: <ImagePlus size={18} />,
                    onItemClick: () => insert('image'),
                  },
                  {
                    title: 'Video',
                    subtext: 'Enlace a un video de la clase',
                    aliases: ['video', 'youtube'],
                    group: 'Materiales',
                    onItemClick: () => insert('video'),
                  },
                  {
                    title: 'Actividad interactiva',
                    subtext: 'Acceso a las preguntas del recurso',
                    aliases: ['quiz', 'preguntas', 'actividad'],
                    group: 'Participación',
                    icon: <MessageCircleQuestion size={18} />,
                    onItemClick: () => insert('quiz'),
                  },
                ],
                query,
              )
            }
          />
        </BlockNoteView>
        <details className="advanced editor-outline">
          <summary>Ordenar bloques con botones</summary>
          <div className="advanced-content">{outline(editor.document)}</div>
        </details>
        <p className="editor-status" role="status">
          {message}
        </p>
        <DialogPanel
          open={imageTarget !== null}
          onClose={() => {
            if (!busy) setImageTarget(null);
          }}
          title="Imagen del recurso"
        >
          <Field
            id="resource-image-file"
            label="Subir imagen"
            hint={
              real
                ? 'PNG, JPEG o WebP. Máximo 5 MiB.'
                : 'Demostración: imagen local de hasta 3 MiB; no se sube a un servidor.'
            }
          >
            <input
              id="resource-image-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
          <Field
            id="resource-image-url"
            label="O usar un enlace HTTPS"
            hint="Al comprobar el enlace se contactará con el sitio que aloja la imagen. Puede dejar de estar disponible si ese sitio la retira."
          >
            <input
              id="resource-image-url"
              type="url"
              value={file ? '' : imageUrl.startsWith('data:') ? '' : imageUrl}
              disabled={busy || !!file}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field
            id="resource-image-alt"
            label="Descripción de la imagen"
            hint="Texto alternativo: explica la información que aporta, sin empezar con «imagen de»."
          >
            <textarea
              id="resource-image-alt"
              value={imageAlt}
              disabled={busy}
              onChange={(e) => setImageAlt(e.target.value)}
              maxLength={1000}
            />
          </Field>
          <Field id="resource-image-caption" label="Pie de imagen (opcional)">
            <input
              id="resource-image-caption"
              value={imageCaption}
              disabled={busy}
              onChange={(e) => setImageCaption(e.target.value)}
              maxLength={500}
            />
          </Field>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button isDisabled={busy} onPress={() => void saveImage()}>
            {busy ? 'Comprobando imagen…' : 'Guardar imagen'}
          </Button>
        </DialogPanel>
      </div>
    </ImageEditorContext.Provider>
  );
}
