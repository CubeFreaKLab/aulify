'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, RefreshCw } from 'lucide-react';
import { Button, Field } from './ui';
import { QuestionInput } from './question-input';
import { QuizTimeline } from './quiz-timeline';
import { BrandArt } from './brand-art';
import type { GuestView } from '@/lib/guest-types';
import type { AnswerValue } from '@/domain/types';
import '@/styles/quiz.css';
import '@/styles/guest-practice.css';

export function GuestPlayer({ token }: { token: string }) {
  const [view, setView] = useState<GuestView | null>(null);
  const [name, setName] = useState(''),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false),
    [clock, setClock] = useState(() => Date.now());
  const [value, setValue] = useState<AnswerValue>();
  const [next, setNext] = useState<GuestView | null>(null);
  const lock = useRef(false),
    expired = useRef(false),
    offset = useRef(0);
  const submission = useRef<{ index: number; id: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`/api/jugar/${token}`, { signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        offset.current = Date.parse(data.serverNow) - Date.now();
        setView(data);
        setClock(Date.now() + offset.current);
        setError('');
      } catch (cause) {
        if (!signal?.aborted)
          setError(cause instanceof Error ? cause.message : 'No pudimos cargar la práctica.');
      }
    },
    [token],
  );
  useEffect(() => {
    const controller = new AbortController();
    // This effect synchronizes the initial view with the remote practice, after fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now() + offset.current), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!view || view.run || view.quiz.status === 'closed') return;
    const boundary = view.quiz.status === 'waiting' ? view.quiz.opensAt : view.quiz.closesAt;
    const delay = Date.parse(boundary) - Date.now() - offset.current + 150;
    // Long schedules are rechecked when this capped timer expires.
    const timer = setTimeout(() => void refresh(), Math.max(0, Math.min(delay, 2147483647)));
    return () => clearTimeout(timer);
  }, [view, refresh]);
  useEffect(() => {
    if (
      view?.run &&
      !view.run.finished &&
      clock >= Date.parse(view.run.deadline) &&
      !expired.current &&
      !next
    ) {
      expired.current = true;
      void refresh();
    }
  }, [view, clock, next, refresh]);
  useEffect(() => {
    heading.current?.focus();
  }, [view?.question?.id, view?.run?.finished]);
  async function send(action: 'join' | 'answer') {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (action === 'answer' && submission.current?.index !== view?.run?.index)
        submission.current = { index: view!.run!.index, id: crypto.randomUUID() };
      const response = await fetch(`/api/jugar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'join'
            ? { action, name }
            : { action, index: view?.run?.index, requestId: submission.current?.id, answer: value },
        ),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      offset.current = Date.parse(data.serverNow) - Date.now();
      if (action === 'answer') setNext(data);
      else setView(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se envió. Puedes reintentar.');
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const run = view?.run;
  return (
    <div className="quiz-shell guest-shell">
      <header className="quiz-topbar">
        <Link href="/" className="quiz-logo">
          <img src="/brand/aulify-logo.svg" alt="Aulify" />
        </Link>
        {run && (
          <div className="guest-identity">
            <img src={`/illustrations/avatars/${run.avatarId}.svg`} alt="" width={40} height={40} />
            <span>
              {run.name}
              <small>Invitado</small>
            </span>
          </div>
        )}
        <Link href="/" className="button ghost small">
          Salir
        </Link>
      </header>
      {run && !run.finished && (
        <QuizTimeline startedAt={run.startedAt} deadline={run.deadline} clock={clock} />
      )}
      <main id="contenido" className="quiz-canvas">
        {error && (
          <div className="notice warning" role="alert">
            <p>{error}</p>
            <Button variant="ghost small" onPress={() => void refresh()}>
              <RefreshCw size={16} /> Actualizar
            </Button>
          </div>
        )}
        {!view && !error && <p role="status">Preparando tu práctica…</p>}
        {view && !run && (
          <section className="guest-entry">
            <BrandArt name="student-thinking" className="guest-entry-art" />
            <div>
              <span className="badge green">Práctica sin cuenta</span>
              <h1>{view.quiz.title}</h1>
              <p>
                {view.quiz.count} preguntas · {view.quiz.durationSeconds / 60} minutos · A tu ritmo
              </p>
              {view.quiz.status === 'open' ? (
                <form
                  className="stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send('join');
                  }}
                >
                  <Field
                    id="guest-name"
                    label="¿Cómo te llamas?"
                    hint="Puedes usar solo tu nombre. Tus puntos no se convierten en una nota."
                  >
                    <input
                      id="guest-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      minLength={2}
                      maxLength={60}
                      required
                      autoComplete="given-name"
                    />
                  </Field>
                  <Button type="submit" isDisabled={busy}>
                    {busy ? 'Entrando…' : 'Empezar a jugar'}
                    <ArrowRight size={18} />
                  </Button>
                  <small>
                    Recibirás un avatar al azar. Tu partida queda guardada para continuar desde este
                    navegador.
                  </small>
                </form>
              ) : (
                <p className="notice">
                  {view.quiz.status === 'waiting'
                    ? `Esta práctica comienza el ${new Date(view.quiz.opensAt).toLocaleString('es-BO')}.`
                    : 'Esta práctica ya cerró.'}
                </p>
              )}
            </div>
          </section>
        )}
        {run?.finished && (
          <section className="quiz-finish">
            <BrandArt name="student-progress" className="guest-finish-art" />
            <h1 ref={heading} tabIndex={-1}>
              ¡Terminaste tu práctica, {run.name}!
            </h1>
            <p className="guest-score">
              {Math.round(run.points * 100) / 100} <span>/ {run.maximum} puntos</span>
            </p>
            <p>
              Respondiste {run.index} de {view?.quiz.count} preguntas. Estos puntos son de práctica
              y no se registran como nota.
            </p>
            <Link className="button" href="/">
              Volver a Aulify <ArrowRight size={18} />
            </Link>
          </section>
        )}
        {view?.question && run && !run.finished && (
          <section className="question-stage" key={view.question.id}>
            <div className="quiz-heading">
              <span className="badge green">
                {run.index + 1} de {view.quiz.count}
              </span>
              <span>{view.quiz.title}</span>
            </div>
            <div
              className="quiz-progress guest-question-progress"
              role="progressbar"
              aria-label="Preguntas respondidas"
              aria-valuemin={0}
              aria-valuemax={view.quiz.count}
              aria-valuenow={run.index}
            >
              <div style={{ width: `${(run.index / view.quiz.count) * 100}%` }} />
            </div>
            <h1 className="quiz-question" ref={heading} tabIndex={-1}>
              {view.question.prompt}
            </h1>
            {view.question.image && (
              <img
                className="quiz-scene"
                src={view.question.image.src}
                alt={view.question.image.alt}
              />
            )}
            <QuestionInput
              question={view.question}
              value={value}
              onChange={setValue}
              disabled={busy || Boolean(next)}
            />
            {next ? (
              <div
                className={`quiz-feedback ${next.feedback?.points !== next.feedback?.maximum ? 'incorrect' : ''}`}
                role="status"
              >
                <h2>
                  {next.feedback?.points === next.feedback?.maximum
                    ? '¡Bien conectado!'
                    : 'Sigue descubriendo.'}
                </h2>
                <p>{next.feedback?.explanation}</p>
                <Button
                  onPress={() => {
                    setView(next);
                    setNext(null);
                    setValue(undefined);
                    submission.current = null;
                  }}
                >
                  {next.run?.finished ? 'Ver mi resultado' : 'Siguiente pregunta'}
                  <ArrowRight size={18} />
                </Button>
              </div>
            ) : (
              <div className="guest-answer-action">
                <Button isDisabled={busy || !value} onPress={() => void send('answer')}>
                  <Check size={18} />
                  {busy ? 'Enviando…' : 'Confirmar respuesta'}
                </Button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
