import type { Block } from '@/domain/types';
import { resourceImageLayout } from './resource-image-layout';

export type RichBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: RichBlock[];
};

export function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(textOf).join('');
  if (!content || typeof content !== 'object') return '';
  const value = content as Record<string, unknown>;
  if (typeof value.text === 'string') return value.text;
  if (Array.isArray(value.rows))
    return value.rows
      .map((row) => (row as { cells: unknown[] }).cells.map(textOf).join(' | '))
      .join('\n');
  return textOf(value.content);
}

/** Search/export fallback. The full document retains styles, hierarchy and table cells. */
export function semanticBlocks(document: unknown[]): Block[] {
  const result: Block[] = [];
  const visit = (entries: unknown[]) =>
    entries.forEach((raw) => {
      if (!raw || typeof raw !== 'object') return;
      const item = raw as RichBlock;
      const id = item.id || crypto.randomUUID();
      const text = textOf(item.content);
      if (item.type === 'heading' && text)
        result.push({ id, type: 'heading', text, level: Number(item.props?.level) > 2 ? 3 : 2 });
      else if (
        ['bulletListItem', 'numberedListItem', 'checkListItem'].includes(item.type || '') &&
        text
      )
        result.push({
          id,
          type: 'list',
          items: [
            item.type === 'checkListItem' ? `${item.props?.checked ? '☑' : '☐'} ${text}` : text,
          ],
          ordered: item.type === 'numberedListItem',
        });
      else if (item.type === 'image' && typeof item.props?.url === 'string') {
        const fileId = item.props.url.match(/^\/api\/files\/([0-9a-f-]{36})$/i)?.[1];
        result.push({
          id,
          type: 'image',
          url: item.props.url,
          alt: String(item.props.alt || item.props.caption || ''),
          ...(fileId ? { fileId } : {}),
          ...(item.props.caption ? { caption: String(item.props.caption) } : {}),
          ...resourceImageLayout(item.props),
        });
      } else if (item.type === 'video' && typeof item.props?.url === 'string')
        result.push({
          id,
          type: 'video',
          url: item.props.url,
          title: String(item.props.caption || 'Video de la clase'),
        });
      else if (item.type !== 'quiz' && text) result.push({ id, type: 'text', text });
      if (Array.isArray(item.children)) visit(item.children);
    });
  visit(document);
  return result;
}

export function duplicateTree<T extends RichBlock>(block: T): T {
  return {
    ...structuredClone(block),
    id: crypto.randomUUID(),
    ...(block.children ? { children: block.children.map(duplicateTree) } : {}),
  };
}

export function blankIds(template: string): string[] {
  return [...new Set([...template.matchAll(/\{([^{}\s]+)\}/g)].map((match) => match[1]))];
}
