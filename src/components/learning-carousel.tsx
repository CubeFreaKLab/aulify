'use client';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
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
  const section = useRef<HTMLElement>(null);
  const engine = useRef({
    target: 0,
    current: 0,
    velocity: 0,
    interacted: 0,
    visible: false,
    reduced: true,
    focused: false,
  });
  const pointer = useRef<{
    x: number;
    lastX: number;
    time: number;
    phase: number;
    id: number;
  } | null>(null);
  const [phase, setPhase] = useState(0);
  const [width, setWidth] = useState(1100);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const spacing = width < 600 ? 184 : 260;
  useEffect(() => {
    const el = section.current!;
    const e = engine.current;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      e.reduced = media.matches;
    };
    sync();
    media.addEventListener('change', sync);
    const observer = new IntersectionObserver(
      ([entry]) => {
        e.visible = entry.isIntersecting;
      },
      { threshold: 0.1 },
    );
    const resize = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    resize.observe(el);
    let lastScroll = window.scrollY;
    const scroll = () => {
      const delta = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      if (e.visible && !e.reduced && !pointer.current) {
        e.target += delta / 900;
        e.interacted = performance.now();
      }
    };
    // React to the wheel without swallowing ordinary page scrolling.
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || pointer.current) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      e.target += Math.max(-300, Math.min(300, delta * (event.deltaMode === 1 ? 16 : 1))) / 420;
      e.interacted = performance.now();
      e.velocity = 0;
    };
    window.addEventListener('scroll', scroll, { passive: true });
    el.addEventListener('wheel', wheel, { passive: true });
    let frame = 0,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      if (e.visible) {
        if (!pointer.current && !e.reduced) {
          if (Math.abs(e.velocity) > 0.01) {
            e.target += e.velocity * dt;
            e.velocity *= Math.exp(-dt * 5);
          } else if (!paused && !e.focused && now - e.interacted > 1200) e.target += dt * 0.12;
        }
        e.current =
          e.reduced || pointer.current
            ? e.target
            : e.current + (e.target - e.current) * (1 - Math.exp(-dt * 12));
        setPhase(e.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      media.removeEventListener('change', sync);
      window.removeEventListener('scroll', scroll);
      el.removeEventListener('wheel', wheel);
    };
  }, [paused]);
  function keyMove(event: KeyboardEvent) {
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      engine.current.target += event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      engine.current.interacted = performance.now();
      engine.current.velocity = 0;
    } else if (event.key === ' ') {
      event.preventDefault();
      setPaused((v) => !v);
    }
  }
  function release(event: PointerEvent) {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    setDragging(false);
    engine.current.interacted = performance.now();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return (
    <section
      ref={section}
      className="learning-carousel"
      aria-label="Formas de aprender con Aulify"
      aria-roledescription="carrusel"
      onFocusCapture={(event) => {
        engine.current.focused = event.target.matches(':focus-visible');
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) engine.current.focused = false;
      }}
    >
      <h2 className="sr-only">
        Una clase para preparar, preguntar, participar, organizar, aprender, acompañar y compartir.
      </h2>
      <p id="carousel-instructions" className="sr-only">
        Arrastra o usa la rueda. Con teclado, usa las flechas para recorrer las propuestas y Espacio
        para pausar el movimiento.
      </p>
      <div className="learning-reel" aria-hidden="true">
        <span>Una clase para</span>
        <div className="learning-reel-window">
          {cards.map((card, i) => {
            const offset = wrap(i - phase + 3.5) - 3.5;
            return (
              <span
                key={card[0]}
                style={
                  {
                    '--slot': offset,
                    opacity: Math.max(0, 1 - Math.abs(offset) * 0.78),
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
        tabIndex={0}
        role="group"
        aria-label="Carrusel de siete propuestas"
        aria-describedby="carousel-instructions"
        data-dragging={dragging}
        onKeyDown={keyMove}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const now = performance.now();
          pointer.current = {
            x: event.clientX,
            lastX: event.clientX,
            time: now,
            phase: engine.current.current,
            id: event.pointerId,
          };
          engine.current.velocity = 0;
          engine.current.interacted = now;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const p = pointer.current;
          if (!p || p.id !== event.pointerId) return;
          const now = performance.now();
          engine.current.target = p.phase - (event.clientX - p.x) / spacing;
          engine.current.velocity = Math.max(
            -6,
            Math.min(
              6,
              -(event.clientX - p.lastX) / spacing / Math.max(0.016, (now - p.time) / 1000),
            ),
          );
          p.lastX = event.clientX;
          p.time = now;
        }}
        onPointerUp={release}
        onPointerCancel={(event) => {
          engine.current.velocity = 0;
          release(event);
        }}
      >
        <div className="learning-arch-horizon" />
        {cards.map((card, i) => {
          const offset = wrap(i - phase + 3.5) - 3.5;
          const angle = offset * 0.205,
            radius = spacing / Math.sin(0.205);
          return (
            <figure
              key={card[0]}
              className="learning-card"
              style={
                {
                  '--x': radius * Math.sin(angle) + 'px',
                  '--y': radius * (1 - Math.cos(angle)) + 'px',
                  '--angle': offset * 11.75 + 'deg',
                  zIndex: Math.round(100 - Math.abs(offset) * 10),
                } as CSSProperties
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={'/illustrations/cards/' + card[0] + '.svg'}
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
      <button className="carousel-pause-accessible" onClick={() => setPaused((v) => !v)}>
        {paused ? 'Reanudar movimiento' : 'Pausar movimiento'}
      </button>
    </section>
  );
}
