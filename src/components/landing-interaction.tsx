'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    const connect = () => {
      observer?.disconnect();
      if (media.matches) {
        element.removeAttribute('data-motion-ready');
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.12 },
      );
      element.querySelectorAll('.landing-reveal').forEach((target) => observer?.observe(target));
      element.setAttribute('data-motion-ready', 'true');
    };
    connect();
    media.addEventListener('change', connect);
    return () => {
      observer?.disconnect();
      media.removeEventListener('change', connect);
      element.removeAttribute('data-motion-ready');
    };
  }, []);
  return (
    <div className="landing" ref={root}>
      {children}
    </div>
  );
}

const choices = ['El pasto', 'El conejo', 'El zorro', 'El hongo'];
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function LandingQuestion() {
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const [selection, setSelection] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  return (
    <section className="landing-question" aria-labelledby="sample-question">
      <span className="landing-sample-label">Prueba una pregunta de Biología</span>
      <h3 id="sample-question">¿Quién produce su propio alimento en este ecosistema?</h3>
      <fieldset disabled={submitted || !ready}>
        <legend className="sr-only">Elige una respuesta</legend>
        {choices.map((choice, i) => (
          <label key={choice} className={`landing-choice ${selection === i ? 'selected' : ''}`}>
            <input
              type="radio"
              name="landing-choice"
              value={i}
              checked={selection === i}
              onChange={() => setSelection(i)}
            />
            <span className="landing-choice-letter" aria-hidden="true">
              {String.fromCharCode(65 + i)}
            </span>
            <span>{choice}</span>
            {submitted && i === 0 && <Check size={18} aria-hidden="true" />}
          </label>
        ))}
      </fieldset>
      {submitted ? (
        <>
          <p className="landing-feedback" role="status">
            <strong>{selection === 0 ? '¡Exacto!' : 'El productor es el pasto.'}</strong> Las
            plantas producen su propio alimento mediante la fotosíntesis.
          </p>
          <button
            className="landing-text-link"
            onClick={() => {
              setSelection(null);
              setSubmitted(false);
            }}
          >
            Probar otra vez <RotateCcw size={15} aria-hidden="true" />
          </button>
        </>
      ) : (
        <button
          className="button small"
          disabled={selection === null}
          onClick={() => setSubmitted(true)}
        >
          Responder <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
      <p className="landing-sample-note">Ejemplo de demostración. No registra una nota.</p>
    </section>
  );
}
