'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import '@/styles/learning-carousel.css';

const cards = [
  ['01-prepara', 'Prepara tu clase', 'preparar'],
  ['02-pregunta', 'Haz una pregunta', 'preguntar'],
  ['03-participa', 'Todos participan', 'participar'],
  ['04-organiza', 'Todo en su materia', 'organizar'],
  ['05-responde', 'A tu ritmo', 'aprender'],
  ['06-acompana', 'Acompaña el progreso', 'acompañar'],
  ['07-comparte', 'Comparte lo que sabes', 'compartir'],
];
const wrap = (n: number) => ((n % cards.length) + cards.length) % cards.length;

export function LearningCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  const [width, setWidth] = useState(1100);
  const [drag, setDrag] = useState(0);
  const section = useRef<HTMLElement>(null);
  const pointer = useRef<{ x: number; id: number } | null>(null);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.25,
    });
    const resize = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    if (section.current) {
      observer.observe(section.current);
      resize.observe(section.current);
    }
    return () => {
      media.removeEventListener('change', sync);
      observer.disconnect();
      resize.disconnect();
    };
  }, []);
  useEffect(() => {
    if (paused || reduced || !visible || hover) return;
    const timer = setInterval(() => setIndex((i) => wrap(i + 1)), 4200);
    return () => clearInterval(timer);
  }, [paused, reduced, visible, hover]);
  const select = (n: number) => {
    setPaused(true);
    setIndex(wrap(n));
  };
  const compact = width < 600;
  const spacing = compact ? 177 : 240;
  const active = cards[index];
  return (
    <section
      ref={section}
      className="learning-carousel"
      aria-label="Formas de aprender con Aulify"
      aria-roledescription="carrusel"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setPaused(true)}
    >
      <h2 className="sr-only">
        Una clase para preparar, preguntar, participar, organizar, aprender, acompañar y compartir.
      </h2>
      <div className="learning-reel" aria-hidden="true">
        <span>Una clase para</span>
        <div className="learning-reel-window">
          {cards.map((card, i) => {
            const offset = wrap(i - index + 3) - 3;
            return (
              <span
                key={card[0]}
                style={
                  {
                    '--slot': offset,
                    opacity: Math.abs(offset) > 1 ? 0 : offset === 0 ? 1 : 0.22,
                  } as CSSProperties
                }
              >
                {card[2]}
              </span>
            );
          })}
        </div>
      </div>
      <div
        className="learning-arch"
        data-dragging={!!drag}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          pointer.current = { x: e.clientX, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
          setPaused(true);
        }}
        onPointerMove={(e) => {
          if (pointer.current?.id === e.pointerId)
            setDrag(Math.max(-spacing, Math.min(spacing, e.clientX - pointer.current.x)));
        }}
        onPointerUp={(e) => {
          if (!pointer.current) return;
          const delta = e.clientX - pointer.current.x;
          pointer.current = null;
          setDrag(0);
          if (Math.abs(delta) > 35) select(index + (delta < 0 ? 1 : -1));
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          pointer.current = null;
          setDrag(0);
        }}
      >
        <div className="learning-arch-horizon" />
        {cards.map((card, i) => {
          const offset = wrap(i - index + 3) - 3;
          const position = offset + drag / spacing;
          return (
            <figure
              key={card[0]}
              className="learning-card"
              aria-hidden={i !== index}
              style={
                {
                  '--x': `${position * spacing}px`,
                  '--y': `${position * position * (compact ? 26 : 32)}px`,
                  '--angle': `${position * 11}deg`,
                  zIndex: 10 - Math.abs(offset),
                } as CSSProperties
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/illustrations/cards/${card[0]}.svg`}
                alt={card[1]}
                width={660}
                height={880}
                loading="lazy"
                draggable={false}
              />
            </figure>
          );
        })}
      </div>
      <div className="learning-carousel-controls">
        <button
          className="icon-button"
          aria-label="Propuesta anterior"
          onClick={() => select(index - 1)}
        >
          <ArrowLeft />
        </button>
        <p aria-live={paused ? 'polite' : 'off'} aria-atomic="true">
          <span>
            {index + 1} / {cards.length}
          </span>
          {active[1]}
        </p>
        <button
          className="icon-button"
          aria-label="Propuesta siguiente"
          onClick={() => select(index + 1)}
        >
          <ArrowRight />
        </button>
        <button
          className="icon-button"
          aria-label={paused || reduced ? 'Activar movimiento del carrusel' : 'Pausar carrusel'}
          disabled={reduced}
          onClick={() => setPaused((v) => !v)}
        >
          {paused || reduced ? <Play size={18} /> : <Pause size={18} />}
        </button>
      </div>
      <div className="learning-carousel-dots" aria-label="Elegir una propuesta">
        {cards.map((card, i) => (
          <button
            key={card[0]}
            aria-label={card[1]}
            aria-current={index === i ? 'true' : undefined}
            onClick={() => select(i)}
          >
            <span />
          </button>
        ))}
      </div>
    </section>
  );
}
