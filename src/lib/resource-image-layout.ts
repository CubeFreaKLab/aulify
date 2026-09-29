import type { CSSProperties } from 'react';

export type ImageAlignment = 'left' | 'center' | 'right';
export type ImageLayout = { widthPercent: number; imageAlignment: ImageAlignment };

/** Older documents fill the available width and keep their centered placement. */
export function resourceImageLayout(props?: {
  widthPercent?: unknown;
  imageAlignment?: unknown;
}): ImageLayout {
  return {
    widthPercent:
      typeof props?.widthPercent === 'number' && Number.isFinite(props.widthPercent)
        ? Math.round(Math.max(25, Math.min(100, props.widthPercent)))
        : 100,
    imageAlignment:
      props?.imageAlignment === 'left' || props?.imageAlignment === 'right'
        ? props.imageAlignment
        : 'center',
  };
}

export function resourceImageStyle(layout: ImageLayout): CSSProperties {
  return {
    width: `${layout.widthPercent}%`,
    marginInlineStart: layout.imageAlignment === 'left' ? 0 : 'auto',
    marginInlineEnd: layout.imageAlignment === 'right' ? 0 : 'auto',
  };
}
