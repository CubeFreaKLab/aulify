'use client';
import { Fragment, type ReactNode } from 'react';
import type { Block } from '@/domain/types';
import { type RichBlock, textOf } from '@/lib/rich-document';
import { resourceTextStyle } from '@/lib/resource-text-style';
import { ResourceImage } from './resource-image';
import '@/styles/rich-editor.css';
import '@/styles/resource-text.css';
import { ResourceVideo } from './resource-video';

export function InlineContent({ content }: { content: unknown }): ReactNode {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  return content.map((raw, i) => {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as {
      type?: string;
      text?: string;
      styles?: Record<string, unknown>;
      content?: unknown;
      href?: string;
    };
    if (item.type === 'link')
      return typeof item.href === 'string' && /^https?:\/\//i.test(item.href) ? (
        <a key={i} href={item.href} target="_blank" rel="noopener noreferrer">
          <InlineContent content={item.content} />
        </a>
      ) : (
        <Fragment key={i}>
          <InlineContent content={item.content} />
        </Fragment>
      );
    let value: ReactNode = item.text || '';
    if (item.styles?.code) value = <code>{value}</code>;
    if (item.styles?.bold) value = <strong>{value}</strong>;
    if (item.styles?.italic) value = <em>{value}</em>;
    if (item.styles?.underline) value = <u>{value}</u>;
    if (item.styles?.strike) value = <s>{value}</s>;
    return (
      <span key={i} style={resourceTextStyle(item.styles)}>
        {value}
      </span>
    );
  });
}

function ReadTable({ content }: { content: unknown }) {
  const table = content as {
    rows?: { cells?: unknown[] }[];
    headerRows?: number;
    headerCols?: number;
  };
  if (!Array.isArray(table?.rows)) return null;
  return (
    <div
      className="reader-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Tabla del recurso, desplazamiento horizontal"
    >
      <table>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells?.map((cell, colIndex) => {
                const isHeader =
                  rowIndex < (table.headerRows || 0) || colIndex < (table.headerCols || 0);
                const Tag = isHeader ? 'th' : 'td';
                const value = Array.isArray(cell) ? cell : (cell as { content?: unknown })?.content;
                return (
                  <Tag
                    key={colIndex}
                    style={resourceTextStyle((cell as { props?: Record<string, unknown> })?.props)}
                    scope={
                      isHeader ? (rowIndex < (table.headerRows || 0) ? 'col' : 'row') : undefined
                    }
                  >
                    <InlineContent content={value} />
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NativeBlocks({ blocks, depth = 0 }: { blocks: unknown[]; depth?: number }) {
  if (depth > 20) return null;
  const nodes: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i] as RichBlock;
    if (!b || typeof b !== 'object' || b.type === 'quiz') continue;
    if (b.type === 'bulletListItem' || b.type === 'numberedListItem') {
      const kind = b.type;
      const group: RichBlock[] = [b];
      while ((blocks[i + 1] as RichBlock)?.type === kind) group.push(blocks[++i] as RichBlock);
      const Tag = kind === 'numberedListItem' ? 'ol' : 'ul';
      nodes.push(
        <Tag key={b.id || i}>
          {group.map((item, n) => (
            <li key={item.id || n} style={resourceTextStyle(item.props)}>
              <InlineContent content={item.content} />
              {item.children?.length ? (
                <NativeBlocks blocks={item.children} depth={depth + 1} />
              ) : null}
            </li>
          ))}
        </Tag>,
      );
      continue;
    }
    const content = <InlineContent content={b.content} />;
    const children = b.children?.length ? (
      <div className="reader-children">
        <NativeBlocks blocks={b.children} depth={depth + 1} />
      </div>
    ) : null;
    let node: ReactNode;
    if (b.type === 'heading') {
      const Heading =
        Number(b.props?.level) <= 1
          ? 'h2'
          : Number(b.props?.level) === 2
            ? 'h3'
            : Number(b.props?.level) === 3
              ? 'h4'
              : 'h5';
      node = b.props?.isToggleable ? (
        <details>
          <summary>{content}</summary>
          {children}
        </details>
      ) : (
        <>
          <Heading>{content}</Heading>
          {children}
        </>
      );
    } else if (b.type === 'toggleListItem')
      node = (
        <details className="reader-toggle">
          <summary>{content}</summary>
          {children || <p className="muted">Sin contenido adicional.</p>}
        </details>
      );
    else if (b.type === 'checkListItem')
      node = (
        <>
          <p className="reader-check">
            <span aria-label={b.props?.checked ? 'Completado' : 'Pendiente'}>
              {b.props?.checked ? '☑' : '☐'}
            </span>{' '}
            {content}
          </p>
          {children}
        </>
      );
    else if (b.type === 'quote')
      node = (
        <>
          <blockquote>{content}</blockquote>
          {children}
        </>
      );
    else if (b.type === 'codeBlock')
      node = (
        <>
          <pre>
            <code>{textOf(b.content)}</code>
          </pre>
          {children}
        </>
      );
    else if (b.type === 'table')
      node = (
        <>
          <ReadTable content={b.content} />
          {children}
        </>
      );
    else if (b.type === 'divider') node = <hr />;
    else if (b.type === 'image' && typeof b.props?.url === 'string')
      node = (
        <ResourceImage
          url={b.props.url}
          alt={String(b.props.alt || b.props.caption || '')}
          caption={typeof b.props.caption === 'string' ? b.props.caption : undefined}
          widthPercent={b.props.widthPercent}
          imageAlignment={b.props.imageAlignment}
        />
      );
    else if (b.type === 'video')
      node = (
        <ResourceVideo
          url={String(b.props?.url || '')}
          title={String(b.props?.caption || 'Video de la clase')}
        />
      );
    else
      node = (
        <>
          <p>{content}</p>
          {children}
        </>
      );
    nodes.push(
      <div className="reader-block" key={b.id || i} style={resourceTextStyle(b.props)}>
        {node}
      </div>,
    );
  }
  return nodes;
}

export function ResourceReader({
  title,
  blocks,
  document,
}: {
  title: string;
  blocks: Block[];
  document?: unknown[];
}) {
  return (
    <article className="reader-paper rich-reader">
      <h1>{title}</h1>
      {document?.length ? (
        <NativeBlocks blocks={document} />
      ) : (
        blocks
          .filter((b) => b.type !== 'quiz')
          .map((b) => (
            <div className="reader-block" key={b.id}>
              {b.type === 'heading' ? (
                b.level === 3 ? (
                  <h3>{b.text}</h3>
                ) : (
                  <h2>{b.text}</h2>
                )
              ) : b.type === 'text' ? (
                <p>{b.text}</p>
              ) : b.type === 'list' ? (
                b.ordered ? (
                  <ol>
                    {b.items.map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ol>
                ) : (
                  <ul>
                    {b.items.map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                )
              ) : b.type === 'image' ? (
                <ResourceImage
                  url={b.url}
                  alt={b.alt}
                  caption={b.caption}
                  widthPercent={b.widthPercent}
                  imageAlignment={b.imageAlignment}
                />
              ) : b.type === 'video' ? (
                <ResourceVideo url={b.url} title={b.title} />
              ) : null}
            </div>
          ))
      )}
    </article>
  );
}
