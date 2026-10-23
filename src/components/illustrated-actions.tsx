'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import '@/styles/illustrated-actions.css';

export function PreviewButton({
  onPress,
  small = false,
}: {
  onPress: () => void | Promise<void>;
  small?: boolean;
}) {
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  return (
    <button
      type="button"
      className={`button secondary preview-glasses${small ? ' small' : ''}`}
      data-guide="preview"
      onClick={() => void onPress()}
      onPointerMove={(e) => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const r = e.currentTarget.getBoundingClientRect();
        setGaze({
          x: Math.max(-3, Math.min(3, (e.clientX - r.left - r.width / 2) / 12)),
          y: Math.max(-2, Math.min(2, (e.clientY - r.top - r.height / 2) / 8)),
        });
      }}
      onPointerLeave={() => setGaze({ x: 0, y: 0 })}
    >
      <svg
        viewBox="0 0 66 32"
        width="42"
        height="28"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="17" r="12" fill="var(--white)" />
        <circle cx="48" cy="17" r="12" fill="var(--white)" />
        <path d="M30 15q3-4 6 0M6 13L2 9M60 13l4-4" />
        <g
          className="glasses-pupils"
          style={{ transform: `translate(${gaze.x}px,${gaze.y}px)` }}
          fill="currentColor"
          stroke="none"
        >
          <circle cx="18" cy="17" r="4.4" />
          <circle cx="48" cy="17" r="4.4" />
        </g>
      </svg>
      Vista previa
    </button>
  );
}

export function DocumentConfirm({
  onConfirm,
  disabled = false,
  children = 'Publicar',
  guide,
}: {
  onConfirm: () => void | Promise<unknown>;
  disabled?: boolean;
  children?: ReactNode;
  guide?: string;
}) {
  const [travel, setTravel] = useState(0);
  const [busy, setBusy] = useState(false);
  const origin = useRef<number | null>(null);
  const suppressed = useRef(false);
  const lock = useRef(false);
  async function confirm() {
    if (disabled || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      lock.current = false;
      setBusy(false);
      setTravel(0);
    }
  }
  return (
    <button
      type="button"
      className="button document-confirm"
      disabled={disabled || busy}
      aria-busy={busy}
      data-guide={guide}
      data-moving={busy || travel > 0}
      style={{ '--travel': `${travel}px` } as CSSProperties}
      title="Desliza hacia la derecha o pulsa para continuar"
      onPointerDown={(e) => {
        if (e.button !== 0 || disabled || busy) return;
        origin.current = e.clientX;
        suppressed.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (origin.current === null) return;
        setTravel(Math.max(0, Math.min(100, e.clientX - origin.current)));
      }}
      onPointerCancel={() => {
        origin.current = null;
        setTravel(0);
        suppressed.current = true;
      }}
      onPointerUp={(e) => {
        if (origin.current === null) return;
        const moved = e.clientX - origin.current;
        origin.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (moved > 65) {
          suppressed.current = true;
          void confirm();
        } else if (Math.abs(moved) > 8) {
          suppressed.current = true;
          setTravel(0);
        }
      }}
      onClick={(event) => {
        if (suppressed.current && event.detail !== 0) {
          suppressed.current = false;
          return;
        }
        suppressed.current = false;
        void confirm();
      }}
    >
      <span className="document-road" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="document-token"
        src="/illustrations/actions/documento.svg"
        width="32"
        height="34"
        alt=""
      />
      <span className="document-action-label">{busy ? 'Un momento…' : children}</span>
      <ArrowRight size={17} className="document-arrow" aria-hidden="true" />
    </button>
  );
}

export function BlockSticker({ kind = 'text' }: { kind?: string }) {
  const list = /lista|list|check/i.test(kind),
    heading = /título|heading|encabezado/i.test(kind),
    picture = /imagen|image|video/i.test(kind),
    question = /actividad|quiz|pregunta/i.test(kind);
  return (
    <svg
      className="block-sticker"
      viewBox="0 0 32 32"
      width="28"
      height="28"
      aria-hidden="true"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h15l5 6v20H6z" fill="var(--white)" />
      <path d="M21 3v7h5" fill="#85bd6e" />
      {question ? (
        <>
          <circle cx="16" cy="18" r="7" fill="#85bd6e" />
          <path d="M14 16c0-3 5-3 4 0-.3 1-2 1-2 3m0 3v.1" />
        </>
      ) : picture ? (
        <>
          <rect x="9" y="13" width="14" height="11" rx="1" fill="#85bd6e" />
          <path d="m10 23 4-5 3 3 3-4 2 6" />
          <circle cx="12" cy="16" r="1" fill="var(--ink)" />
        </>
      ) : heading ? (
        <>
          <path d="M10 14h12M16 14v10M13 24h6" strokeWidth="2.8" />
        </>
      ) : list ? (
        <>
          <path d="M14 14h8M14 19h8M14 24h8" />
          <path d="M10 14h.1M10 19h.1M10 24h.1" stroke="#85bd6e" strokeWidth="3" />
        </>
      ) : (
        <>
          <path d="M10 14h12" stroke="#85bd6e" strokeWidth="3" />
          <path d="M10 19h12M10 24h8" />
        </>
      )}
    </svg>
  );
}
