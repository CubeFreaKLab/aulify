import type { CSSProperties } from 'react';

const palette = new Set([
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
]);
function color(value: unknown, role: 'text' | 'background'): string | undefined {
  if (typeof value !== 'string' || value === 'default') return undefined;
  if (palette.has(value)) return `var(--resource-${value}-${role})`;
  // Pasted literal colors may be retained; arbitrary CSS expressions and URLs are not content.
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return value;
  if (/^(?:rgb|hsl)a?\([\d\s.,%/+deg-]+\)$/i.test(value)) return value;
  return undefined;
}

export function resourceTextStyle(props?: Record<string, unknown>): CSSProperties {
  if (!props) return {};
  return {
    color: color(props.textColor, 'text'),
    backgroundColor: color(props.backgroundColor, 'background'),
    textAlign: ['left', 'center', 'right', 'justify'].includes(String(props.textAlignment))
      ? (props.textAlignment as CSSProperties['textAlign'])
      : undefined,
  };
}
