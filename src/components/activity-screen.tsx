'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Zap,
  Flag,
  Clock,
  Users,
  Play,
  BookOpen,
  Leaf,
} from 'lucide-react';
import {
  questionsOf,
  numeric,
  studentActivity,
  safeImageUrl,
  type DemoState,
  type User,
  type AnswerValue,
  type StudentQuestion,
  type Block,
  type Activity,
  type Attempt,
} from '@/domain';
import { runDemo, refreshDemo } from '@/demo/store';
import { Button, Badge, EmptyState, PageHeading } from './ui';
import { QuestionInput } from './question-input';
import '../styles/quiz.css';

export function ActivityScreen({
  activityId,
  previewId,
  state,
  user,
  notices,
}: {
  activityId?: string;
  previewId?: string;
  state: DemoState;
  user: User;
  notices: ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  const preview = previewId
    ? state.resources.find((r) => r.id === previewId && r.ownerId === user.id)
    : null;
  const activity = state.activities.find((a) => a.id === activityId);
  const teacher =
    activity && state.subjects.find((s) => s.id === activity.subjectId)?.ownerId === user.id;
  if (previewId) {
    if (!preview)
      return (
        <EmptyState icon={BookOpen} title="Recurso no disponible">
          Vuelve a tu biblioteca.
        </EmptyState>
      );
    return (
      <>
        <PageHeading
          title="Así lo verá tu clase."
          description="La vista previa no publica el recurso ni consume intentos."
        >
          <Link href={`/demo/editor/${preview.id}`} className="button secondary">
            <ArrowLeft size={16} />
            Volver al editor
          </Link>
        </PageHeading>
        <ResourceReader
          title={preview.title}
          blocks={preview.blocks}
          document={preview.editorDocument}
        />
        <div className="reader">
          <div className="quiz-invitation">
            <h2>{questionsOf(preview).length} preguntas para participar</h2>
            <p>Revisa las consignas antes de publicar.</p>
            {questionsOf(preview).map((q, i) => (
              <div style={{ marginTop: 22 }} key={q.id}>
                <h3 style={{ fontSize: 17, marginBottom: 12 }}>
                  {i + 1}. {q.prompt}
                </h3>
                <PreviewQuestion question={q} />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }
  if (!activity)
    return (
      <main id="contenido" className="error-page">
        <h1>Actividad no encontrada.</h1>
        <Link href="/demo" className="button">
          Volver a mi inicio
        </Link>
      </main>
    );
  if (teacher)
    return <TeacherRoom state={state} activity={activity} user={user} notices={notices} />;
  let view;
  try {
    view = studentActivity(state, activity.id, user.id);
  } catch {
    return (
      <main id="contenido" className="error-page">
        <h1>Esta actividad necesita una invitación.</h1>
        <p>Solicita el ingreso a la materia y espera la aprobación de tu docente.</p>
        <Link href="/demo/materias" className="button">
          Ver mis materias
        </Link>
      </main>
    );
  }
  const current = view.attempt ? state.attempts.find((a) => a.id === view.attempt?.id) : undefined;
  if (playing && current)
    return (
      <QuizPlayer
        key={current.id}
        state={state}
        activity={activity}
        user={user}
        attempt={current}
        questions={view.questions}
        notices={notices}
      />
    );
  return (
    <div className="quiz-shell">
      <QuizHeader />
      <main id="contenido" className="app-content reader">
        {notices}
        <ResourceReader
          title={view.title}
          blocks={view.blocks as Block[]}
          document={view.editorDocument}
        />
        <section className="quiz-invitation">
          <div className="eyebrow">Tu turno</div>
          <h2>Pon tus ideas en movimiento.</h2>
          <p>Lee las reglas y comienza cuando estés listo.</p>
          <div className="rules-grid">
            <div>
              <strong>{view.questions.length}</strong>preguntas
            </div>
            <div>
              <strong>{activity.settings.purpose === 'practice' ? 'Práctica' : 'Examen'}</strong>
              {activity.settings.countsTowardAverage
                ? 'Cuenta en tu promedio'
                : 'No cuenta en tu promedio'}
            </div>
            <div>
              <strong>
                {activity.settings.timeLimitMinutes
                  ? `${activity.settings.timeLimitMinutes} min`
                  : 'A tu ritmo'}
              </strong>
              {view.attemptsRemaining} intentos disponibles
            </div>
          </div>
          <p style={{ fontSize: 13 }}>
            Disponible hasta {new Date(activity.settings.closesAt).toLocaleString('es-BO')}. Las
            respuestas escritas se revisan manualmente.
          </p>
          {activity.settings.pace === 'guided' ? (
            <>
              <p className="notice" style={{ margin: '15px 0' }}>
                El docente abrirá cada pregunta. Esta sala usa datos locales de demostración.
              </p>
              <Button
                onPress={() => {
                  const joined = runDemo(
                    (r) => r.joinGuidedRoom(activity.id, user.id),
                    'Te uniste a la sala de ejemplo.',
                  );
                  if (joined && current) setPlaying(true);
                }}
              >
                <Users size={17} />
                {activity.guided?.studentIds.includes(user.id)
                  ? 'Ya estás en la sala'
                  : 'Unirme a la sala'}
              </Button>
              {current && (
                <Button style={{ marginLeft: 12 }} onPress={() => setPlaying(true)}>
                  Entrar a la actividad
                </Button>
              )}
            </>
          ) : (
            <Button
              style={{ marginTop: 18 }}
              isDisabled={!current && view.attemptsRemaining === 0}
              onPress={() => {
                const attempt = runDemo((r) => r.startAttempt(activity.id, user.id));
                if (attempt) setPlaying(true);
              }}
            >
              {current?.status === 'in-progress' ? 'Retomar mi participación' : 'Empezar actividad'}
              <ArrowRight size={17} />
            </Button>
          )}
        </section>
      </main>
    </div>
  );
}
function PreviewQuestion({ question }: { question: StudentQuestion }) {
  const [value, setValue] = useState<AnswerValue>();
  return <QuestionInput question={question} value={value} onChange={setValue} />;
}
function QuizHeader() {
  return (
    <header className="quiz-topbar">
      <Link href="/" className="quiz-logo">
        <img src="/brand/aulify-logo.svg" alt="Aulify" />
      </Link>
      <Badge>Clase de ejemplo</Badge>
      <Link href="/demo" className="button ghost small">
        <ArrowLeft size={16} />
        Mi inicio
      </Link>
    </header>
  );
}
function ResourceReader({
  title,
  blocks,
  document,
}: {
  title: string;
  blocks: Block[];
  document?: unknown[];
}) {
  return (
    <article className="reader-paper">
      <div className="eyebrow">Recurso de clase</div>
      <h1>{title}</h1>
      {document?.length
        ? document.map((block, i) => <NativeReadBlock key={i} block={block} />)
        : blocks
            .filter((b) => b.type !== 'quiz')
            .map((b) => (
              <div className="reader-block" key={b.id}>
                {b.type === 'heading' ? (
                  <h2>{b.text}</h2>
                ) : b.type === 'text' ? (
                  <p>{b.text}</p>
                ) : b.type === 'list' ? (
                  b.ordered ? (
                    <ol>
                      {b.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ol>
                  ) : (
                    <ul>
                      {b.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )
                ) : b.type === 'image' && safeImageUrl(b.url) ? (
                  <figure>
                    <img src={b.url} alt={b.alt} />
                    {b.caption && <figcaption>{b.caption}</figcaption>}
                  </figure>
                ) : b.type === 'video' && b.url.startsWith('https://') ? (
                  <a href={b.url} target="_blank" rel="noreferrer">
                    {b.title} ↗
                  </a>
                ) : null}
              </div>
            ))}
    </article>
  );
}
function NativeReadBlock({ block }: { block: unknown }) {
  if (!block || typeof block !== 'object') return null;
  const b = block as {
    type?: string;
    content?: unknown;
    props?: Record<string, unknown>;
    children?: unknown[];
  };
  if (b.type === 'quiz') return null;
  const content = <InlineContent content={b.content} />;
  return (
    <div className="reader-block">
      {b.type === 'heading' ? (
        <h2>{content}</h2>
      ) : b.type === 'bulletListItem' ? (
        <ul>
          <li>{content}</li>
        </ul>
      ) : b.type === 'numberedListItem' ? (
        <ol>
          <li>{content}</li>
        </ol>
      ) : b.type === 'image' && typeof b.props?.url === 'string' && safeImageUrl(b.props.url) ? (
        <img src={b.props.url} alt={String(b.props.caption || 'Imagen del recurso')} />
      ) : b.type === 'video' &&
        typeof b.props?.url === 'string' &&
        b.props.url.startsWith('https://') ? (
        <a href={b.props.url} rel="noreferrer" target="_blank">
          {String(b.props.caption || 'Ver video')} ↗
        </a>
      ) : (
        <p>{content}</p>
      )}
      {b.children?.map((child, i) => (
        <NativeReadBlock block={child} key={i} />
      ))}
    </div>
  );
}
function InlineContent({ content }: { content: unknown }) {
  if (!Array.isArray(content)) return null;
  return (
    <>
      {content.map((raw, i) => {
        const item = raw as {
          type?: string;
          text?: string;
          styles?: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean };
          content?: unknown;
          href?: string;
        };
        if (item.type === 'link')
          return typeof item.href === 'string' && /^https?:\/\//.test(item.href) ? (
            <a key={i} href={item.href} target="_blank" rel="noreferrer">
              <InlineContent content={item.content} />
            </a>
          ) : (
            <InlineContent key={i} content={item.content} />
          );
        return (
          <span
            key={i}
            style={{
              fontWeight: item.styles?.bold ? 700 : undefined,
              fontStyle: item.styles?.italic ? 'italic' : undefined,
              textDecoration: item.styles?.underline
                ? 'underline'
                : item.styles?.strike
                  ? 'line-through'
                  : undefined,
            }}
          >
            {item.text}
          </span>
        );
      })}
    </>
  );
}

function QuizPlayer({
  state,
  activity,
  user,
  attempt,
  questions,
  notices,
}: {
  state: DemoState;
  activity: Activity;
  user: User;
  attempt: Attempt;
  questions: StudentQuestion[];
  notices: ReactNode;
}) {
  const [value, setValue] = useState<AnswerValue>();
  const [double, setDouble] = useState(false);
  const [hint, setHint] = useState('');
  const [feedback, setFeedback] = useState<{
    id: string;
    points: number;
    max: number;
    explanation: string;
  } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const heading = useRef<HTMLHeadingElement>(null);
  const submitting = useRef(false);
  const guided = activity.settings.pace === 'guided';
  const index = guided ? activity.guided?.questionIndex || 0 : attempt.answers.length;
  const questionId = feedback?.id || attempt.questionOrder[index];
  const question = questions.find((q) => q.id === questionId);
  const answered = attempt.answers.some((a) => a.questionId === questionId);
  const waiting = guided && (!activity.guided?.questionOpen || answered) && !feedback;
  const consumedHint = state.powerups.some(
    (p) => p.studentId === user.id && p.activityId === activity.id && p.kind === 'hint',
  );
  const consumedDouble = state.powerups.some(
    (p) => p.studentId === user.id && p.activityId === activity.id && p.kind === 'double',
  );
  useEffect(() => {
    heading.current?.focus();
  }, [questionId, waiting]);
  useEffect(() => {
    const timer = setInterval(() => {
      setClock(Date.now());
      if (Date.now() >= Date.parse(attempt.deadline)) refreshDemo();
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt.deadline]);
  function submit() {
    if (!question || !value || submitting.current) return;
    submitting.current = true;
    const result = runDemo((r) =>
      r.submitAnswer(
        attempt.id,
        question.id,
        value,
        `${attempt.id}:${question.id}`,
        double,
        user.id,
      ),
    );
    submitting.current = false;
    if (!result) return;
    const answer = result.answers.find((a) => a.questionId === question.id);
    const review = answer?.reviews.at(-1);
    const raw = questionsOf(state.versions.find((v) => v.id === attempt.versionId)!).find(
      (q) => q.id === question.id,
    );
    if (activity.settings.feedback === 'immediate' && review) {
      setFeedback({
        id: question.id,
        points: numeric(review.points),
        max: question.points,
        explanation: raw?.explanation || '',
      });
    } else setValue(undefined);
    setDouble(false);
    setHint('');
  }
  if (attempt.status === 'closed' && !feedback)
    return (
      <div className="quiz-shell">
        <QuizHeader />
        <main id="contenido" className="quiz-finish">
          <div className="finish-icon">
            <Flag size={45} strokeWidth={1.5} />
          </div>
          <div className="eyebrow">Una idea más para tu mochila</div>
          <h1>
            {attempt.closeReason === 'expired'
              ? 'Terminó el tiempo.'
              : '¡Participación completada!'}
          </h1>
          <p>
            {attempt.closeReason === 'expired'
              ? 'Conservamos las respuestas que alcanzaste a enviar.'
              : 'Tus respuestas están listas para que tu docente las revise.'}{' '}
            Las calificaciones aparecerán cuando las publique.
          </p>
          {notices}
          <div className="row">
            <Link href="/demo/resultados" className="button">
              Ver mis resultados
              <ArrowRight size={17} />
            </Link>
            <Link href="/demo" className="button secondary">
              Volver a mi inicio
            </Link>
          </div>
        </main>
      </div>
    );
  return (
    <div className="quiz-shell">
      <header className="quiz-topbar">
        <Link href="/demo" className="quiz-logo">
          <img src="/brand/aulify-logo.svg" alt="Aulify" />
        </Link>
        <div className="quiz-progress-wrap">
          <div className="quiz-progress-label">
            <span>Tu recorrido</span>
            <span>
              {Math.min(index + 1, questions.length)} de {questions.length}
            </span>
          </div>
          <div
            className="quiz-progress"
            role="progressbar"
            aria-label="Preguntas respondidas"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={attempt.answers.length}
          >
            <div style={{ width: `${(attempt.answers.length / questions.length) * 100}%` }} />
          </div>
        </div>
        <Link className="button ghost small" href="/demo">
          Salir
        </Link>
      </header>
      <main id="contenido" className="quiz-canvas">
        {notices}
        {waiting ? (
          <section className="quiz-finish">
            <div className="finish-icon">
              <Users size={42} />
            </div>
            <h1 ref={heading} tabIndex={-1}>
              Tu clase sigue pensando.
            </h1>
            <p>
              El docente abrirá la siguiente pregunta. Puedes volver a tu inicio y retomar cuando
              esté lista.
            </p>
            <Badge>Avance guiado</Badge>
          </section>
        ) : question ? (
          <section className="question-stage" key={question.id}>
            <div className="quiz-heading">
              <Badge tone="green">
                {question.type === 'open' || question.type === 'fill-text'
                  ? 'Con tus palabras'
                  : question.type === 'multiple'
                    ? 'Elige varias respuestas'
                    : question.type === 'ordering'
                      ? 'Ponlo en orden'
                      : question.type === 'matching'
                        ? 'Encuentra la relación'
                        : 'Piensa y elige'}
              </Badge>
              {activity.settings.timeLimitMinutes && (
                <span className="row muted" style={{ fontSize: 13 }}>
                  <Clock size={16} />
                  {Math.max(0, Math.floor((Date.parse(attempt.deadline) - clock) / 60000))}:
                  {String(
                    Math.max(0, Math.floor((Date.parse(attempt.deadline) - clock) / 1000) % 60),
                  ).padStart(2, '0')}
                </span>
              )}
            </div>
            <h1 className="quiz-question" ref={heading} tabIndex={-1}>
              {question.prompt}
            </h1>
            {hint && (
              <div className="quiz-hint" role="status">
                <Lightbulb size={17} /> {hint}
              </div>
            )}
            <QuestionInput
              key={question.id}
              question={question}
              value={value}
              onChange={setValue}
              disabled={Boolean(feedback)}
            />
            {feedback ? (
              <div
                className={`quiz-feedback ${feedback.points < feedback.max ? 'incorrect' : ''}`}
                role="status"
              >
                <h2>
                  {feedback.points === feedback.max
                    ? '¡Bien conectado!'
                    : feedback.points > 0
                      ? 'Vas encontrando la conexión.'
                      : 'Una oportunidad para descubrir.'}
                </h2>
                <p>{feedback.explanation || 'Sigue con la próxima pregunta.'}</p>
                <Button
                  onPress={() => {
                    setFeedback(null);
                    setValue(undefined);
                  }}
                >
                  Continuar
                  <ArrowRight size={17} />
                </Button>
              </div>
            ) : (
              <div className="quiz-bottom">
                <div className="row wrap">
                  {activity.settings.allowHint && (
                    <button
                      type="button"
                      className="powerup"
                      disabled={consumedHint}
                      onClick={() => {
                        const text = runDemo((r) => r.useHint(attempt.id, question.id, user.id));
                        if (text) setHint(text);
                      }}
                    >
                      <Lightbulb size={16} />
                      {consumedHint ? 'Pista utilizada' : 'Una pista'}
                    </button>
                  )}
                  {activity.settings.allowDouble && (
                    <button
                      type="button"
                      className="powerup"
                      aria-pressed={double}
                      disabled={consumedDouble}
                      onClick={() => setDouble(!double)}
                    >
                      <Zap size={16} />
                      {consumedDouble ? 'Doble utilizado' : 'Puntos ×2'}
                    </button>
                  )}
                </div>
                <Button isDisabled={!value} onPress={submit}>
                  Responder
                  <ArrowRight size={18} />
                </Button>
              </div>
            )}
            <p className="quiz-note">Tu respuesta queda confirmada al pulsar Responder.</p>
          </section>
        ) : (
          <p className="notice">La siguiente pregunta todavía no está disponible.</p>
        )}
      </main>
    </div>
  );
}

function TeacherRoom({
  state,
  activity,
  user,
  notices,
}: {
  state: DemoState;
  activity: Activity;
  user: User;
  notices: ReactNode;
}) {
  const version = state.versions.find((v) => v.id === activity.versionId)!;
  const guided = activity.settings.pace === 'guided';
  const questions = questionsOf(version);
  const current = questions[activity.guided?.questionIndex || 0];
  const count = state.attempts.filter(
    (a) => a.activityId === activity.id && a.answers.some((r) => r.questionId === current?.id),
  ).length;
  return (
    <div className="quiz-shell">
      <QuizHeader />
      <main id="contenido" className="app-content" style={{ maxWidth: 1050 }}>
        {notices}
        <PageHeading
          eyebrow={guided ? 'Sala guiada · demostración local' : 'Vista docente'}
          title={activity.title}
          description={
            guided
              ? 'Abre cada pregunta cuando tu clase esté lista.'
              : 'Consulta el recurso y revisa las participaciones de tu clase.'
          }
        >
          <Link href="/demo/revision" className="button secondary">
            Revisar respuestas
          </Link>
        </PageHeading>
        {guided ? (
          <section className="surface">
            <div className="row between">
              <Badge tone="green">
                {activity.guided?.status === 'running'
                  ? 'En marcha'
                  : activity.guided?.status === 'closed'
                    ? 'Finalizada'
                    : 'Sala de espera'}
              </Badge>
              <span className="row">
                <Users size={18} />
                {activity.guided?.studentIds.length || 0} participantes
              </span>
            </div>
            <h2 style={{ fontSize: 32, margin: '35px 0 25px' }}>
              {activity.guided?.status === 'running'
                ? current?.prompt
                : 'Una pregunta. Toda la clase.'}
            </h2>
            {activity.guided?.status === 'running' && (
              <p className="muted">{count} estudiantes respondieron esta pregunta.</p>
            )}
            <div className="row wrap" style={{ marginTop: 24 }}>
              {!activity.guided || activity.guided.status === 'waiting' ? (
                <Button
                  onPress={() =>
                    runDemo((r) => r.startGuidedSession(activity.id, user.id), 'La sesión comenzó.')
                  }
                >
                  <Play size={17} />
                  Comenzar sesión
                </Button>
              ) : activity.guided.status === 'running' ? (
                activity.guided.questionOpen ? (
                  <>
                    <Button
                      onPress={() =>
                        runDemo((r) => r.closeGuidedQuestion(activity.id, false, user.id))
                      }
                    >
                      Cerrar pregunta
                    </Button>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        if (
                          window.confirm(
                            '¿Cerrar la pregunta aunque haya estudiantes sin responder?',
                          )
                        )
                          runDemo((r) => r.closeGuidedQuestion(activity.id, true, user.id));
                      }}
                    >
                      Cerrar con pendientes
                    </Button>
                  </>
                ) : (
                  <Button
                    onPress={() => runDemo((r) => r.openNextGuidedQuestion(activity.id, user.id))}
                  >
                    Abrir siguiente pregunta
                    <ArrowRight size={17} />
                  </Button>
                )
              ) : (
                <Link className="button" href="/demo/revision">
                  Revisar participaciones
                </Link>
              )}
            </div>
            <p className="notice" style={{ marginTop: 25 }}>
              Para explorar ambos roles, vuelve al inicio y cambia de perfil. Esta muestra no
              conecta dispositivos distintos.
            </p>
          </section>
        ) : (
          <>
            <ResourceReader
              title={version.title}
              blocks={version.blocks}
              document={version.editorDocument}
            />
            <div className="row" style={{ justifyContent: 'center' }}>
              <Leaf size={20} />
              <span>
                {questions.length} preguntas · versión {version.number}
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
