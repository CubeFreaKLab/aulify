'use client';
/* eslint-disable @next/next/no-img-element */
import Link from './workspace-link';
import { usePathname } from 'next/navigation';
import { ActivityManagement, ActivityRanking } from './classroom-management';
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
  type DemoState,
  type User,
  type AnswerValue,
  type StudentQuestion,
  type Activity,
  type Block,
  type Attempt,
} from '@/domain';
import {
  runDemo,
  refreshDemo,
  getDemoRepository,
  getImmediateFeedback,
  getWorkspaceExtras,
  remoteCommand,
} from '@/demo/store';
import { Button, Badge, EmptyState, PageHeading } from './ui';
import { QuestionInput } from './question-input';
import { ResourceReader } from './resource-reader';
import { StaticAttemptHelp } from './help-guide';
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
        <header className="reader-toolbar">
          <Link href={`/demo/editor/${preview.id}`} className="editor-back">
            <ArrowLeft size={16} aria-hidden="true" />
            Volver al editor
          </Link>
          <p>
            <strong>Vista previa</strong>
            <span>Esta vista no publica cambios ni registra respuestas.</span>
          </p>
        </header>
        <ResourceReader
          title={preview.title}
          blocks={preview.blocks}
          document={preview.editorDocument}
        />
        {questionsOf(preview).length > 0 && (
          <section className="preview-questions" aria-label="Vista previa de las preguntas">
            <h2>{questionsOf(preview).length} preguntas para participar</h2>
            <p>Revisa las consignas antes de publicar.</p>
            {questionsOf(preview).map((q, i) => (
              <div className="preview-question" key={q.id}>
                <h3>
                  {i + 1}. {q.prompt}
                </h3>
                <PreviewQuestion question={q} />
              </div>
            ))}
          </section>
        )}
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
    view = getDemoRepository().studentActivity(activity.id, user.id);
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
          {activity.settings.reportVisibility && (
            <p className="notice">
              Esta actividad registra cuándo esta pestaña deja de estar visible. El docente puede
              revisar esas señales; no muestran qué aplicación usas ni prueban una trampa. No se
              aplican sanciones automáticas.
            </p>
          )}
          {activity.settings.pace === 'guided' ? (
            <>
              <p className="notice" style={{ margin: '15px 0' }}>
                El docente abrirá cada pregunta. Puedes esperar aquí hasta que comience.
              </p>
              <Button
                onPress={async () => {
                  const joined = await runDemo(
                    (r) => r.joinGuidedRoom(activity.id, user.id),
                    'Te uniste a la sala.',
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
              onPress={async () => {
                const attempt = await runDemo((r) => r.startAttempt(activity.id, user.id));
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
  const live = usePathname().startsWith('/aula');
  return (
    <header className="quiz-topbar">
      <Link href="/" className="quiz-logo">
        <img src="/brand/aulify-logo.svg" alt="Aulify" />
      </Link>
      <Badge>{live ? 'Tu aula' : 'Clase de ejemplo'}</Badge>
      <Link href="/demo" className="button ghost small">
        <ArrowLeft size={16} />
        Mi inicio
      </Link>
    </header>
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
  const live = usePathname().startsWith('/aula');
  const [value, setValue] = useState<AnswerValue>();
  const [double, setDouble] = useState(false);
  const [hint, setHint] = useState('');
  const [soundOn, setSoundOn] = useState(activity.settings.sound);
  const [streak, setStreak] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const [signalError, setSignalError] = useState(false);
  const [feedback, setFeedback] = useState<{
    id: string;
    points: number;
    max: number;
    explanation: string;
  } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const heading = useRef<HTMLHeadingElement>(null);
  const submitting = useRef(false);
  const submissionKeys = useRef(new Map<string, string>());
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
    let checkedDeadline = false;
    const timer = setInterval(() => {
      setClock(Date.now());
      if (
        !checkedDeadline &&
        attempt.status === 'in-progress' &&
        Date.now() >= Date.parse(attempt.deadline)
      ) {
        checkedDeadline = true;
        void refreshDemo();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt.deadline, attempt.status]);
  useEffect(() => {
    if (!live || !activity.settings.reportVisibility || attempt.status !== 'in-progress') return;
    let hiddenAt: string | null = null;
    const changed = () => {
      if (document.visibilityState === 'hidden') hiddenAt = new Date().toISOString();
      else if (hiddenAt) {
        const start = hiddenAt;
        hiddenAt = null;
        void remoteCommand('reportVisibility', [
          attempt.id,
          crypto.randomUUID(),
          start,
          new Date().toISOString(),
        ])
          .then(() => setSignalError(false))
          .catch(() => setSignalError(true));
      }
    };
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, [live, activity.settings.reportVisibility, attempt.id, attempt.status]);
  useEffect(
    () => () => {
      void audio.current?.close();
      audio.current = null;
    },
    [],
  );
  async function submit() {
    if (!question || !value || submitting.current) return;
    submitting.current = true;
    const answerKey = `${attempt.id}:${question.id}`;
    if (!submissionKeys.current.has(answerKey))
      submissionKeys.current.set(answerKey, crypto.randomUUID());
    if (soundOn) {
      try {
        audio.current ||= new AudioContext();
        void audio.current.resume();
      } catch {
        /* El quiz sigue operativo si el dispositivo no admite audio. */
      }
    }
    const result = await runDemo(
      (r) =>
        r.submitAnswer(
          attempt.id,
          question.id,
          value,
          submissionKeys.current.get(answerKey)!,
          double,
          user.id,
        ),
      undefined,
      { refresh: 'deferred' },
    );
    submitting.current = false;
    if (!result) return;
    if (soundOn && audio.current?.state === 'running') {
      const oscillator = audio.current.createOscillator(),
        gain = audio.current.createGain();
      oscillator.frequency.value = 440;
      gain.gain.setValueAtTime(0.035, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.current.currentTime + 0.09);
      oscillator.connect(gain);
      gain.connect(audio.current.destination);
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.1);
    }
    const answer = result.answers.find((a) => a.questionId === question.id);
    const review = answer?.reviews.at(-1);
    const raw = questionsOf(
      getDemoRepository()
        .load()
        .versions.find((v) => v.id === attempt.versionId) || { blocks: [] },
    ).find((q) => q.id === question.id);
    const serverFeedback = getImmediateFeedback(attempt.id, question.id);
    if (activity.settings.streaks && activity.settings.feedback === 'immediate')
      setStreak((previous) =>
        serverFeedback?.correct || (review && numeric(review.points) === question.points)
          ? previous + 1
          : 0,
      );
    if (activity.settings.feedback === 'immediate' && (review || serverFeedback)) {
      setFeedback({
        id: question.id,
        points: numeric(serverFeedback?.points || review!.points),
        max: question.points,
        explanation: serverFeedback?.explanation || raw?.explanation || '',
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
          <ActivityRanking activityId={activity.id} live={live} state={state} />
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
        {activity.settings.sound && (
          <Button variant="ghost small" aria-pressed={soundOn} onPress={() => setSoundOn(!soundOn)}>
            {soundOn ? 'Silenciar sonidos' : 'Activar sonidos'}
          </Button>
        )}
        <Link className="button ghost small" href="/demo">
          Salir
        </Link>
      </header>
      <main id="contenido" className="quiz-canvas">
        {notices}
        <StaticAttemptHelp />
        {signalError && (
          <p className="notice">
            No se pudo enviar una señal de visibilidad. Esto no modifica tu respuesta ni tu
            calificación.
          </p>
        )}
        {activity.settings.streaks && streak > 1 && (
          <p role="status" className="notice">
            {streak} aciertos seguidos. ¡Sigue pensando!
          </p>
        )}
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
                      onClick={async () => {
                        const text = await runDemo((r) =>
                          r.useHint(attempt.id, question.id, user.id),
                        );
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
  const live = usePathname().startsWith('/aula');
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
          eyebrow={guided ? 'Sala guiada' : 'Vista docente'}
          title={activity.title}
          description={
            guided
              ? activity.guided?.status === 'closed'
                ? 'Revisa las respuestas antes de publicar las calificaciones.'
                : 'Abre cada pregunta cuando tu clase esté lista.'
              : 'Consulta el recurso y revisa las participaciones de tu clase.'
          }
        >
          <Link href="/demo/revision" className="button secondary">
            Revisar respuestas
          </Link>
        </PageHeading>
        <ActivityManagement
          state={state}
          user={user}
          activity={activity}
          live={live}
          extras={getWorkspaceExtras()}
        />
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
                : activity.guided?.status === 'closed'
                  ? 'La sesión terminó.'
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
              {activity.guided?.status === 'closed'
                ? 'Las respuestas están guardadas. Revisa las preguntas escritas antes de publicar las calificaciones.'
                : 'Los estudiantes entran desde su materia. Abre la siguiente pregunta cuando tu clase esté lista.'}
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
