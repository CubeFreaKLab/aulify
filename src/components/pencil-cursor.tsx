'use client';
import { useEffect, useRef } from 'react';
import '@/styles/pencil-cursor.css';

export function PencilCursor() {
  const cursor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cursor.current!;
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let previousX = 0,
      lean = 0,
      frame = 0;
    const hide = () => {
      el.hidden = true;
      document.documentElement.classList.remove('pencil-cursor-active');
    };
    const move = (event: globalThis.PointerEvent) => {
      if (!fine.matches || event.pointerType !== 'mouse') {
        hide();
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('iframe')) {
        hide();
        return;
      }
      el.hidden = false;
      const textTarget = target.closest(
        'textarea, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([type="button"]):not([type="submit"])',
      );
      el.dataset.mode = textTarget ? 'text' : 'pencil';
      document.documentElement.classList.add('pencil-cursor-active');
      // The SVG's graphite tip is the fixed origin. Only the body leans.
      el.style.left = event.clientX + 'px';
      el.style.top = event.clientY + 'px';
      lean = reduced.matches ? 0 : Math.max(-12, Math.min(12, (event.clientX - previousX) * 0.35));
      previousX = event.clientX;
      el.style.setProperty('--pencil-lean', lean + 'deg');
    };
    const press = () => {
      if (!el.hidden && !reduced.matches) {
        el.classList.remove('pencil-tap');
        void el.offsetWidth;
        el.classList.add('pencil-tap');
      }
    };
    const tick = () => {
      lean *= 0.9;
      el.style.setProperty('--pencil-lean', lean + 'deg');
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', press);
    window.addEventListener('blur', hide);
    document.addEventListener('pointerleave', hide);
    fine.addEventListener('change', hide);
    return () => {
      hide();
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', press);
      window.removeEventListener('blur', hide);
      document.removeEventListener('pointerleave', hide);
      fine.removeEventListener('change', hide);
    };
  }, []);
  return (
    <div ref={cursor} className="pencil-cursor" aria-hidden="true" hidden>
      <span className="pencil-click-mark" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="cursor-pencil-glyph"
        src="/illustrations/actions/lapiz.svg"
        alt=""
        width="48"
        height="48"
        draggable={false}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="cursor-text-glyph"
        src="/illustrations/actions/cursor-texto.svg"
        alt=""
        width="18"
        height="38"
        draggable={false}
      />
    </div>
  );
}
