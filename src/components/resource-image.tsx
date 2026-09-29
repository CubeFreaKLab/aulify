'use client';
/* eslint-disable @next/next/no-img-element -- Resource URLs may be private; the image keeps its intrinsic ratio. */
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ImagePlus, SlidersHorizontal } from 'lucide-react';
import { safeImageUrl } from '@/domain';
import {
  resourceImageLayout,
  resourceImageStyle,
  type ImageLayout,
} from '@/lib/resource-image-layout';
import '@/styles/resource-image.css';

export function ResourceImage({
  url,
  alt,
  caption,
  widthPercent,
  imageAlignment,
  onEdit,
  onLayoutChange,
}: {
  url: string;
  alt: string;
  caption?: string;
  widthPercent?: unknown;
  imageAlignment?: unknown;
  onEdit?: () => void;
  onLayoutChange?: (layout: ImageLayout) => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const figure = useRef<HTMLElement>(null);
  const cleanupDrag = useRef<(() => void) | null>(null);
  const widthId = useId();
  const layout = resourceImageLayout({ widthPercent, imageAlignment });
  const displayed = { ...layout, widthPercent: dragWidth ?? layout.widthPercent };
  const available = safeImageUrl(url) && failedUrl !== url;
  const editable = Boolean(onLayoutChange);
  useEffect(() => () => cleanupDrag.current?.(), []);

  function beginResize(event: PointerEvent<HTMLSpanElement>, edge: 'left' | 'right') {
    if (!onLayoutChange || !figure.current || (event.pointerType === 'mouse' && event.button !== 0))
      return;
    event.preventDefault();
    event.stopPropagation();
    cleanupDrag.current?.();
    const startX = event.clientX;
    const availableWidth = figure.current.getBoundingClientRect().width;
    if (!availableWidth) return;
    const pointerId = event.pointerId;
    let nextWidth = layout.widthPercent;
    const changeLayout = onLayoutChange;
    const move = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      const factor = (edge === 'right' ? 1 : -1) * (layout.imageAlignment === 'center' ? 2 : 1);
      nextWidth = resourceImageLayout({
        widthPercent:
          layout.widthPercent + ((moveEvent.clientX - startX) / availableWidth) * 100 * factor,
      }).widthPercent;
      setDragWidth(nextWidth);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      cleanupDrag.current = null;
    };
    const finish = (upEvent: globalThis.PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      cleanup();
      setDragWidth(null);
      if (nextWidth !== layout.widthPercent) changeLayout({ ...layout, widthPercent: nextWidth });
    };
    const cancel = (cancelEvent: globalThis.PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      cleanup();
      setDragWidth(null);
    };
    cleanupDrag.current = cleanup;
    setDragWidth(layout.widthPercent);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
  }
  function resizeFromLeft(event: PointerEvent<HTMLSpanElement>) {
    beginResize(event, 'left');
  }
  function resizeFromRight(event: PointerEvent<HTMLSpanElement>) {
    beginResize(event, 'right');
  }

  return (
    <figure
      ref={figure}
      className={`resource-image${editable ? ' resource-image-editable' : ''}`}
      data-image-width={displayed.widthPercent}
      data-image-alignment={layout.imageAlignment}
      data-resizing={dragWidth !== null || undefined}
    >
      {available ? (
        <div className="resource-image-frame" style={resourceImageStyle(displayed)}>
          <img
            src={url}
            alt={alt}
            loading={editable ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setFailedUrl(url)}
          />
          {editable &&
            (['left', 'right'] as const)
              .filter((edge) => edge !== layout.imageAlignment)
              .map((edge) => (
                <span
                  key={edge}
                  aria-hidden="true"
                  className={`resource-image-resize resource-image-resize-${edge}`}
                  onPointerDown={edge === 'left' ? resizeFromLeft : resizeFromRight}
                />
              ))}
        </div>
      ) : (
        <p className="notice">
          {url ? `Imagen no disponible. ${alt}` : 'Añade una imagen y describe lo que muestra.'}
        </p>
      )}
      {caption && <figcaption style={resourceImageStyle(displayed)}>{caption}</figcaption>}
      {onEdit && (
        <div className="resource-image-actions" contentEditable={false}>
          <button
            type="button"
            className="resource-image-edit"
            onClick={() => {
              setFailedUrl(null);
              onEdit();
            }}
          >
            <ImagePlus size={16} aria-hidden="true" />
            {url ? 'Editar imagen' : 'Elegir imagen'}
          </button>
          {available && onLayoutChange && (
            <details className="resource-image-settings">
              <summary>
                <SlidersHorizontal size={15} aria-hidden="true" /> Tamaño y posición
              </summary>
              <div className="resource-image-options">
                <div className="resource-image-width">
                  <label htmlFor={widthId}>Ancho de la imagen</label>
                  <output htmlFor={widthId}>{displayed.widthPercent}%</output>
                  <input
                    id={widthId}
                    type="range"
                    min={25}
                    max={100}
                    step={1}
                    value={displayed.widthPercent}
                    aria-valuetext={`${displayed.widthPercent}% del ancho del documento`}
                    onChange={(event) =>
                      onLayoutChange({ ...layout, widthPercent: Number(event.target.value) })
                    }
                  />
                </div>
                <div
                  className="resource-image-alignment"
                  role="group"
                  aria-label="Alineación de la imagen"
                >
                  {(
                    [
                      ['left', 'Alinear imagen a la izquierda', AlignLeft],
                      ['center', 'Centrar imagen', AlignCenter],
                      ['right', 'Alinear imagen a la derecha', AlignRight],
                    ] as const
                  ).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={label}
                      title={label}
                      aria-pressed={layout.imageAlignment === value}
                      onClick={() => onLayoutChange({ ...layout, imageAlignment: value })}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </figure>
  );
}
