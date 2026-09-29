'use client';

import Link from './workspace-link';
import {
  ArrowLeftRight,
  BarChart3,
  Check,
  ClipboardCheck,
  FileText,
  Plus,
  Upload,
} from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { uploadFile } from '@/lib/upload';
import { activityDays, withinDateRange } from '@/lib/result-analytics';
import { ResultDistribution } from './result-distribution';
import {
  calculateAverage,
  numeric,
  questionsOf,
  scoreAttempt,
  type Answer,
  type Attempt,
  type DemoState,
  type Evaluation,
  type Question,
  type StudentResult,
  type SubmissionFile,
  type Subject,
  type Task,
  type TaskSubmission,
  type User,
} from '@/domain';
import { getDemoRepository, runDemo, getWorkspaceExtras } from '@/demo/store';
import { Badge, Button, EmptyState, Field, PageHeading } from './ui';
import '../styles/results.css';
import { ManualActivities, TaskResubmission } from './classroom-management';

interface ScreenProps {
  state: DemoState;
  user: User;
}
const number = (value: number) =>
  new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(value);
const date = (value: string) =>
  new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
const studentName = (state: DemoState, id: string) =>
  state.users.find((user) => user.id === id)?.name ?? 'Estudiante';
const latestEvaluation = (state: DemoState, activityId: string, studentId: string) =>
  state.evaluations
    .filter((item) => item.activityId === activityId && item.studentId === studentId)
    .sort((a, b) => b.revision - a.revision)[0];

function visibleSubjects(state: DemoState, user: User) {
  return state.subjects.filter(
    (subject) =>
      subject.status === 'active' &&
      (user.role === 'teacher'
        ? subject.ownerId === user.id
        : state.memberships.some(
            (item) =>
              item.subjectId === subject.id &&
              item.studentId === user.id &&
              item.status === 'approved',
          )),
  );
}

function answerText(question: Question, answer: Answer) {
  const value = answer.value;
  if (value.type === 'single' && question.type === 'single')
    return (
      question.options.find((option) => option.id === value.optionId)?.text ??
      'Opción no encontrada'
    );
  if (value.type === 'multiple' && question.type === 'multiple')
    return value.optionIds
      .map((id) => question.options.find((option) => option.id === id)?.text ?? id)
      .join(' · ');
  if (value.type === 'true-false') return value.value ? 'Verdadero' : 'Falso';
  if (value.type === 'matching' && question.type === 'matching')
    return question.left
      .map(
        (item) =>
          `${item.text} → ${question.right.find((option) => option.id === value.pairs[item.id])?.text ?? 'Sin relación'}`,
      )
      .join('\n');
  if (value.type === 'ordering' && question.type === 'ordering')
    return value.itemIds
      .map(
        (id, index) => `${index + 1}. ${question.items.find((item) => item.id === id)?.text ?? id}`,
      )
      .join('\n');
  if (value.type === 'fill-options' && question.type === 'fill-options')
    return question.template.replace(
      /\{([^}]+)\}/g,
      (_, id: string) =>
        question.blanks
          .find((blank) => blank.id === id)
          ?.options.find((option) => option.id === value.choices[id])?.text ?? '…',
    );
  if (value.type === 'fill-text' && question.type === 'fill-text')
    return question.template.replace(/\{([^}]+)\}/g, (_, id: string) => value.texts[id] ?? '…');
  if (value.type === 'open') return value.text;
  return 'La respuesta no corresponde a esta pregunta.';
}

function AnswerReviewForm({
  question,
  answer,
  attempt,
  user,
}: {
  question: Question;
  answer: Answer;
  attempt: Attempt;
  user: User;
}) {
  const latest = answer.reviews.at(-1);
  const [editing, setEditing] = useState(!latest);
  const prefix = `review-${attempt.id}-${question.id}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const saved = await runDemo(
      (repo) =>
        repo.reviewAnswer(
          attempt.id,
          question.id,
          Number(data.get('points')),
          String(data.get('comment') ?? ''),
          String(data.get('reason') ?? '') || undefined,
          user.id,
        ),
      'Corrección guardada. La nota sigue bajo tu control.',
    );
    if (saved) setEditing(false);
  }
  return (
    <div className="review-answer">
      <div className="row wrap between">
        <h3>{question.prompt}</h3>
        <Badge tone={latest ? 'green' : 'amber'}>
          {latest
            ? `${number(numeric(latest.points))} / ${number(question.points)} puntos`
            : 'Por corregir'}
        </Badge>
      </div>
      <p className="answer-quote">{answerText(question, answer)}</p>
      {answer.usedDouble && (
        <p className="results-note">
          Se utilizó el doble en esta pregunta. La bonificación respeta las reglas de la actividad.
        </p>
      )}
      {question.manualGuide && (
        <details className="review-guide">
          <summary>Guía de corrección del docente</summary>
          <p>{question.manualGuide}</p>
        </details>
      )}
      {latest && (
        <p className="results-note">
          {latest.actorId === 'automatic' ? 'Corrección automática' : `Revisión ${latest.revision}`}{' '}
          · {date(latest.at)}
          {latest.comment && (
            <>
              <br />
              {latest.comment}
            </>
          )}
        </p>
      )}
      {editing ? (
        <form className="stack results-review-form" onSubmit={submit}>
          <Field label={`Puntos, de 0 a ${question.points}`} id={`${prefix}-points`}>
            <input
              className="grade-input"
              id={`${prefix}-points`}
              name="points"
              type="number"
              step="0.01"
              min="0"
              max={question.points}
              defaultValue={latest ? numeric(latest.points) : ''}
              required
            />
          </Field>
          <Field label="Comentario para el estudiante" id={`${prefix}-comment`}>
            <textarea
              id={`${prefix}-comment`}
              name="comment"
              defaultValue={latest?.comment ?? ''}
              maxLength={3000}
              rows={2}
            />
          </Field>
          {latest && (
            <Field label="Motivo de la nueva revisión" id={`${prefix}-reason`}>
              <input id={`${prefix}-reason`} name="reason" required maxLength={500} />
            </Field>
          )}
          <div className="row wrap">
            <Button type="submit" variant="small">
              Guardar corrección
            </Button>
            {latest && (
              <Button variant="ghost small" onPress={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button variant="ghost small" onPress={() => setEditing(true)}>
          Revisar puntuación
        </Button>
      )}
    </div>
  );
}

function ReviewDetail({ state, user, attempt }: ScreenProps & { attempt: Attempt }) {
  const activity = state.activities.find((item) => item.id === attempt.activityId)!;
  const version = state.versions.find((item) => item.id === attempt.versionId)!;
  const score = scoreAttempt(state, attempt);
  const evaluation = latestEvaluation(state, activity.id, attempt.studentId);
  const completeCandidates = state.attempts
    .filter((item) => item.activityId === activity.id && item.studentId === attempt.studentId)
    .map((item) => ({ attempt: item, score: scoreAttempt(state, item) }))
    .filter((item) => item.score.complete)
    .sort((a, b) => (b.score.grade ?? 0) - (a.score.grade ?? 0));
  const best = completeCandidates[0];
  const currentPublication =
    evaluation &&
    best &&
    evaluation.attemptId === best.attempt.id &&
    evaluation.grade === best.score.grade &&
    best.attempt.answers.every(
      (answer) =>
        evaluation.answerRevisions?.[answer.questionId] === answer.reviews.at(-1)?.revision,
    );
  const questions = questionsOf(version);
  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    runDemo(
      (repo) =>
        repo.publishGrade(
          activity.id,
          attempt.studentId,
          String(data.get('comment') ?? ''),
          String(data.get('reason') ?? '') || undefined,
          user.id,
        ),
      'Nota publicada para este estudiante.',
    );
  }
  return (
    <section className="surface review-detail" aria-label="Respuestas del intento seleccionado">
      <div className="row wrap between">
        <div>
          <h2>{studentName(state, attempt.studentId)}</h2>
          <p className="muted">
            {activity.title} · Intento {attempt.number} · Versión {version.number}
          </p>
        </div>
        <Badge tone={score.pending ? 'amber' : currentPublication ? 'green' : ''}>
          {score.pending
            ? 'Pendiente de revisión'
            : currentPublication
              ? 'Nota publicada'
              : 'Sin publicar'}
        </Badge>
      </div>
      <div className="results-score-strip">
        <span>
          <strong>{number(score.basePoints)}</strong> / {number(score.maximumPoints)} puntos base
        </span>
        <span>
          <strong>{score.pending}</strong> respuestas por corregir
        </span>
        {score.bonusPoints > 0 && (
          <span>
            <strong>+{number(score.bonusPoints)}</strong> de bonificación
          </span>
        )}
      </div>
      {questions.map((question) => {
        const answer = attempt.answers.find((item) => item.questionId === question.id);
        return answer ? (
          <AnswerReviewForm
            key={`${attempt.id}-${question.id}-${answer.reviews.length}`}
            question={question}
            answer={answer}
            attempt={attempt}
            user={user}
          />
        ) : (
          <div className="review-answer" key={question.id}>
            <h3>{question.prompt}</h3>
            <p className="results-note">
              Sin respuesta al cerrar el intento · 0 / {number(question.points)} puntos.
            </p>
          </div>
        );
      })}
      <form onSubmit={publish} className="stack results-publish-form">
        <h3>Publicar la nota individual</h3>
        <p className="muted">
          {best ? (
            <>
              El mejor intento completo es el {best.attempt.number}:{' '}
              <strong>
                {number(best.score.grade!)} / {number(activity.settings.maxGrade)}
              </strong>
              . La publicación conserva esa versión y sus correcciones.
            </>
          ) : (
            'Termina la corrección de un intento cerrado para poder publicar.'
          )}
        </p>
        {evaluation && (
          <p className="results-note">
            Última nota publicada: {number(evaluation.grade)} / {number(evaluation.maxGrade)} ·
            revisión {evaluation.revision}.
          </p>
        )}
        {!currentPublication && (
          <>
            <Field label="Comentario general" id="publish-comment">
              <textarea
                id="publish-comment"
                name="comment"
                defaultValue={evaluation?.comment ?? ''}
                maxLength={3000}
                rows={2}
              />
            </Field>
            {evaluation && (
              <Field label="Motivo de la nueva publicación" id="publish-reason">
                <input id="publish-reason" name="reason" required maxLength={500} />
              </Field>
            )}
            <Button type="submit" isDisabled={!best}>
              <Check size={17} aria-hidden="true" />
              Publicar nota de {studentName(state, attempt.studentId).split(' ')[0]}
            </Button>
          </>
        )}
        {currentPublication && (
          <p className="notice">
            Esta nota ya está publicada. Una nueva corrección se revisará antes de volver a
            publicarla.
          </p>
        )}
      </form>
    </section>
  );
}

export function ReviewScreen({ state, user }: ScreenProps) {
  const [selectedId, setSelectedId] = useState('');
  if (user.role !== 'teacher')
    return (
      <EmptyState icon={ClipboardCheck} title="La revisión pertenece al espacio docente">
        Consulta tus calificaciones desde Resultados.
      </EmptyState>
    );
  const subjects = visibleSubjects(state, user);
  const attempts = state.attempts.filter(
    (attempt) =>
      attempt.status === 'closed' &&
      state.activities.some(
        (activity) =>
          activity.id === attempt.activityId &&
          subjects.some((subject) => subject.id === activity.subjectId),
      ),
  );
  const selected = attempts.find((attempt) => attempt.id === selectedId) ?? attempts[0];
  return (
    <>
      <PageHeading
        title="Una respuesta, una oportunidad."
        description="Revisa lo que aprendieron, acompaña con un comentario y publica cada nota cuando esté lista."
      />
      {!selected ? (
        <EmptyState icon={ClipboardCheck} title="Todavía no hay intentos para revisar">
          Las participaciones terminadas aparecerán aquí.
        </EmptyState>
      ) : (
        <div className="review-layout">
          <aside className="review-list" aria-label="Intentos terminados">
            {attempts.map((attempt) => {
              const score = scoreAttempt(state, attempt);
              return (
                <button
                  className={`review-person ${selected.id === attempt.id ? 'active' : ''}`}
                  key={attempt.id}
                  aria-pressed={selected.id === attempt.id}
                  onClick={() => setSelectedId(attempt.id)}
                >
                  <span className="avatar">
                    {studentName(state, attempt.studentId)
                      .split(' ')
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span>
                    <strong>{studentName(state, attempt.studentId)}</strong>
                    <small>
                      {
                        state.activities.find((activity) => activity.id === attempt.activityId)
                          ?.title
                      }
                    </small>
                    <small>
                      Intento {attempt.number} ·{' '}
                      {score.pending ? `${score.pending} por corregir` : 'Revisado'}
                    </small>
                  </span>
                </button>
              );
            })}
          </aside>
          <ReviewDetail key={selected.id} state={state} user={user} attempt={selected} />
        </div>
      )}
    </>
  );
}

type Status = StudentResult['status'];
interface ResultRow {
  id: string;
  activityId: string;
  studentId: string;
  title: string;
  subject: Subject;
  status: Status;
  grade: number | null;
  maxGrade: number;
  kind: 'quiz' | 'task' | 'manual';
  comment?: string;
  answers?: StudentResult['answers'];
}
const statuses: Record<Status, string> = {
  'not-started': 'Sin participar',
  'in-progress': 'En curso',
  'pending-review': 'Por revisar',
  unpublished: 'Sin publicar',
  published: 'Publicada',
};
function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge tone={status === 'published' ? 'green' : status === 'pending-review' ? 'amber' : ''}>
      {statuses[status]}
    </Badge>
  );
}
function latestEvaluations(evaluations: Evaluation[]) {
  const result = new Map<string, Evaluation>();
  for (const item of evaluations) {
    const key = `${item.studentId}/${item.activityId}`;
    if (!result.has(key) || result.get(key)!.revision < item.revision) result.set(key, item);
  }
  return [...result.values()];
}

export function ResultsScreen({ state, user }: ScreenProps) {
  const live = usePathname().startsWith('/aula');
  const [subjectId, setSubjectId] = useState('all');
  const [course, setCourse] = useState('all');
  const [year, setYear] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [throughDate, setThroughDate] = useState('');
  const days = activityDays(state);
  const includedDate = (activityId: string) =>
    withinDateRange(days.get(activityId), fromDate, throughDate);
  const teacher = user.role === 'teacher';
  const subjects = visibleSubjects(state, user);
  const filteredSubjects = subjects.filter(
    (subject) =>
      (subjectId === 'all' || subject.id === subjectId) &&
      (course === 'all' || subject.course === course) &&
      (year === 'all' || String(subject.year) === year),
  );
  const evaluations = latestEvaluations(
    state.evaluations.filter(
      (item) =>
        filteredSubjects.some((subject) => subject.id === item.subjectId) &&
        includedDate(item.activityId) &&
        (teacher || item.studentId === user.id) &&
        Boolean(item.publishedAt),
    ),
  );
  const rows: ResultRow[] = [];
  for (const subject of filteredSubjects) {
    if (teacher) {
      for (const activity of state.activities.filter(
        (item) => item.subjectId === subject.id && includedDate(item.id),
      )) {
        const studentIds = [
          ...new Set([
            ...state.memberships
              .filter((item) => item.subjectId === subject.id && item.status === 'approved')
              .map((item) => item.studentId),
            ...state.attempts
              .filter((item) => item.activityId === activity.id)
              .map((item) => item.studentId),
          ]),
        ];
        for (const id of studentIds) {
          const attempts = state.attempts.filter(
            (item) => item.activityId === activity.id && item.studentId === id,
          );
          const evaluation = latestEvaluation(state, activity.id, id);
          const scores = attempts.map((attempt) => scoreAttempt(state, attempt));
          const status: Status = evaluation
            ? 'published'
            : !attempts.length
              ? 'not-started'
              : attempts.some((attempt) => attempt.status === 'in-progress')
                ? 'in-progress'
                : scores.some((score) => !score.complete)
                  ? 'pending-review'
                  : 'unpublished';
          rows.push({
            id: `${activity.id}/${id}`,
            activityId: activity.id,
            studentId: id,
            title: activity.title,
            subject,
            status,
            grade: evaluation?.grade ?? null,
            maxGrade: activity.settings.maxGrade,
            kind: 'quiz',
            comment: evaluation?.comment,
          });
        }
      }
    } else {
      for (const item of getDemoRepository().studentResults(subject.id, user.id)) {
        if (!includedDate(item.activityId)) continue;
        const kind = state.tasks.some((task) => task.id === item.activityId)
          ? 'task'
          : state.manualActivities.some((activity) => activity.id === item.activityId)
            ? 'manual'
            : 'quiz';
        rows.push({
          id: `${item.activityId}/${user.id}`,
          activityId: item.activityId,
          studentId: user.id,
          title: item.title,
          subject,
          status:
            kind === 'manual' && item.status === 'not-started' ? 'pending-review' : item.status,
          grade: item.status === 'published' ? item.grade : null,
          maxGrade: item.maxGrade,
          kind,
          comment: evaluations.find((evaluation) => evaluation.activityId === item.activityId)
            ?.comment,
          answers: item.status === 'published' && item.reviewVisible ? item.answers : undefined,
        });
      }
    }
    // La proyección remota del estudiante ya incluye tareas y actividades manuales.
    if (live && !teacher) continue;
    for (const task of state.tasks.filter(
      (item) => item.subjectId === subject.id && includedDate(item.id),
    )) {
      const studentIds = teacher
        ? [
            ...new Set([
              ...state.memberships
                .filter((item) => item.subjectId === subject.id && item.status === 'approved')
                .map((item) => item.studentId),
              ...state.submissions
                .filter((item) => item.taskId === task.id)
                .map((item) => item.studentId),
            ]),
          ]
        : [user.id];
      for (const id of studentIds) {
        const submission = state.submissions
          .filter((item) => item.taskId === task.id && item.studentId === id)
          .at(-1);
        const evaluation = latestEvaluation(state, task.id, id);
        rows.push({
          id: `${task.id}/${id}`,
          activityId: task.id,
          studentId: id,
          title: task.title,
          subject,
          status: evaluation
            ? 'published'
            : !submission
              ? 'not-started'
              : submission.gradedAt
                ? 'unpublished'
                : 'pending-review',
          grade: evaluation?.grade ?? null,
          maxGrade: task.maxGrade,
          kind: 'task',
          comment: evaluation?.comment,
        });
      }
    }
    for (const activity of state.manualActivities.filter(
      (item) => item.subjectId === subject.id && includedDate(item.id),
    )) {
      const studentIds = teacher
        ? [
            ...new Set([
              ...state.memberships
                .filter((item) => item.subjectId === subject.id && item.status === 'approved')
                .map((item) => item.studentId),
              ...evaluations
                .filter((item) => item.activityId === activity.id)
                .map((item) => item.studentId),
            ]),
          ]
        : [user.id];
      for (const studentId of studentIds) {
        const evaluation = evaluations.find(
          (item) => item.activityId === activity.id && item.studentId === studentId,
        );
        const unpublished =
          teacher &&
          getWorkspaceExtras().draftEvaluations.some(
            (item) => item.activityId === activity.id && item.studentId === studentId,
          );
        rows.push({
          id: `${activity.id}/${studentId}`,
          activityId: activity.id,
          studentId,
          title: activity.title,
          subject,
          status: evaluation ? 'published' : unpublished ? 'unpublished' : 'pending-review',
          grade: evaluation?.grade ?? null,
          maxGrade: activity.maxGrade,
          kind: 'manual',
          comment: evaluation?.comment,
        });
      }
    }
  }
  const averageGroups = new Map(
    rows.map((row) => [
      `${row.subject.id}/${row.studentId}`,
      { studentId: row.studentId, subject: row.subject },
    ]),
  );
  const averages = [...averageGroups].map(([id, group]) => {
    const included = evaluations.filter(
      (item) => item.studentId === group.studentId && item.subjectId === group.subject.id,
    );
    return {
      id,
      studentId: group.studentId,
      subject: group.subject,
      name: studentName(state, group.studentId),
      count: included.filter((item) => item.countsTowardAverage).length,
      average: calculateAverage(included),
    };
  });
  return (
    <>
      <PageHeading
        title={teacher ? 'El progreso, con contexto.' : 'Cada paso cuenta.'}
        description={
          teacher
            ? 'Filtra tus grupos y observa las notas publicadas. Lo pendiente no equivale a un cero.'
            : 'Tus calificaciones aparecen cuando el docente las publica.'
        }
      />
      {teacher && (
        <ManualActivities
          state={state}
          user={user}
          live={live}
          draftEvaluations={getWorkspaceExtras().draftEvaluations}
        />
      )}
      <div className="filters results-filters">
        <Field label="Materia" id="result-subject">
          <select
            id="result-subject"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value="all">Todas las materias</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} · {subject.course}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Curso" id="result-course">
          <select
            id="result-course"
            value={course}
            onChange={(event) => setCourse(event.target.value)}
          >
            <option value="all">Todos los cursos</option>
            {[...new Set(subjects.map((subject) => subject.course))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Año" id="result-year">
          <select id="result-year" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="all">Todos los años</option>
            {[...new Set(subjects.map((subject) => subject.year))]
              .sort((a, b) => b - a)
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Desde la fecha" id="result-from">
          <input
            id="result-from"
            type="date"
            value={fromDate}
            max={throughDate || undefined}
            aria-describedby="result-date-help"
            onChange={(event) => setFromDate(event.target.value)}
          />
        </Field>
        <Field label="Hasta la fecha" id="result-through">
          <input
            id="result-through"
            type="date"
            value={throughDate}
            min={fromDate || undefined}
            aria-describedby="result-date-help"
            onChange={(event) => setThroughDate(event.target.value)}
          />
        </Field>
        <Button
          variant="ghost small"
          onPress={() => {
            setSubjectId('all');
            setCourse('all');
            setYear('all');
            setFromDate('');
            setThroughDate('');
          }}
        >
          Restablecer filtros
        </Button>
      </div>
      <p id="result-date-help" className="results-note results-date-help">
        Las fechas incluyen ambos extremos y corresponden al cierre del quiz o tarea, o a la
        realización de la actividad manual. El día respeta la zona horaria de la actividad.
      </p>
      {fromDate && throughDate && fromDate > throughDate && (
        <p role="alert">La fecha inicial debe ser anterior o igual a la fecha final.</p>
      )}
      {!rows.length ? (
        <EmptyState icon={BarChart3} title="Todavía no hay resultados en este grupo">
          Prueba otros filtros o espera la primera actividad de la materia.
        </EmptyState>
      ) : (
        <>
          <section className="surface results-overview" aria-labelledby="average-heading">
            <h2 id="average-heading">
              {teacher ? 'Promedios por materia y estudiante' : 'Tus promedios por materia'}{' '}
              <span className="results-scale">sobre 100</span>
              {(fromDate || throughDate) && (
                <span className="results-scale"> · Promedio del intervalo</span>
              )}
            </h2>
            <p className="results-note">
              Cada materia conserva su propio promedio. Solo incluye notas publicadas que cuentan,
              con el peso configurado en cada actividad.
            </p>
            <div className="results-average-chart" aria-hidden="true">
              {averages.map((item) => (
                <div className="results-average-bar" key={item.id}>
                  <span>
                    {item.name}
                    <small className="results-table-secondary">
                      {item.subject.name} · {item.subject.course} · {item.subject.year}
                    </small>
                  </span>
                  <div>
                    <i style={{ width: `${item.average ?? 0}%` }} />
                  </div>
                  <strong>{item.average === null ? '—' : number(item.average)}</strong>
                </div>
              ))}
            </div>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Tabla de promedios, desplazable horizontalmente"
            >
              <table>
                <caption className="sr-only">
                  Valores del gráfico de promedios por materia y estudiante
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Estudiante y materia</th>
                    <th scope="col">Notas incluidas</th>
                    <th scope="col">Promedio sobre 100</th>
                  </tr>
                </thead>
                <tbody>
                  {averages.map((item) => (
                    <tr key={item.id}>
                      <th scope="row">
                        {item.name}
                        <small className="results-table-secondary">
                          {item.subject.name} · {item.subject.course} · {item.subject.year}
                        </small>
                      </th>
                      <td>{item.count}</td>
                      <td className="grade-number">
                        {item.average === null ? (
                          <span className="results-note">Sin notas publicadas</span>
                        ) : (
                          number(item.average)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {teacher && <ResultDistribution rows={rows} />}
          <div className="section-head">
            <h2>Calificaciones por actividad</h2>
            <Badge>{rows.filter((row) => row.status === 'published').length} publicadas</Badge>
          </div>
          <p className="results-scroll-help" id="results-scroll-help">
            <ArrowLeftRight size={16} aria-hidden="true" />
            Desliza la tabla para ver las notas y el detalle. También puedes usar las flechas del
            teclado.
          </p>
          <div
            className="table-wrap results-activity-table"
            tabIndex={0}
            role="region"
            aria-label="Tabla de calificaciones, desplazable horizontalmente"
            aria-describedby="results-scroll-help"
          >
            <table>
              <caption className="sr-only">Resultados filtrados por materia, curso y año</caption>
              <thead>
                <tr>
                  {teacher && <th scope="col">Estudiante</th>}
                  <th scope="col">Actividad</th>
                  <th scope="col">Materia y grupo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Nota</th>
                  <th scope="col">Fecha de actividad</th>
                  <th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {teacher && <td>{studentName(state, row.studentId)}</td>}
                    <td>
                      <strong>{row.title}</strong>
                      <small className="results-table-secondary">
                        {row.kind === 'task'
                          ? 'Tarea'
                          : row.kind === 'manual'
                            ? 'Actividad manual'
                            : 'Quiz'}
                      </small>
                    </td>
                    <td>
                      {row.subject.name}
                      <small className="results-table-secondary">
                        {row.subject.course} · {row.subject.year}
                      </small>
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      {row.grade === null ? (
                        <span className="results-note">—</span>
                      ) : (
                        <>
                          <strong className="grade-number">{number(row.grade)}</strong>
                          <span className="results-note"> / {number(row.maxGrade)}</span>
                        </>
                      )}
                    </td>
                    <td>
                      <time dateTime={days.get(row.activityId)}>
                        {days.get(row.activityId)?.split('-').reverse().join('/') ?? 'Sin fecha'}
                      </time>
                    </td>
                    <td>
                      {teacher ? (
                        <Link href={row.kind === 'task' ? '/demo/tareas' : '/demo/revision'}>
                          Revisar
                        </Link>
                      ) : row.status === 'published' && (row.comment || row.answers?.length) ? (
                        <details className="results-feedback">
                          <summary>Ver comentarios</summary>
                          {row.comment && <p>{row.comment}</p>}
                          {row.answers?.map((answer, index) => (
                            <p key={answer.questionId}>
                              <strong>
                                Pregunta {index + 1}: {number(answer.points)} /{' '}
                                {number(answer.maximum)}
                              </strong>
                              {answer.comment && (
                                <>
                                  <br />
                                  {answer.comment}
                                </>
                              )}
                              {answer.explanation && (
                                <>
                                  <br />
                                  {answer.explanation}
                                </>
                              )}
                            </p>
                          ))}
                        </details>
                      ) : (
                        <span className="results-note">
                          {row.status === 'published'
                            ? 'Sin comentarios'
                            : 'Disponible al publicar'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function localDateTime(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function NewTaskForm({
  subjects,
  user,
  onDone,
}: {
  subjects: Subject[];
  user: User;
  onDone: () => void;
}) {
  const [initialDates] = useState(() => {
    const now = Date.now();
    return {
      opens: localDateTime(new Date(now)),
      closes: localDateTime(new Date(now + 7 * 86400000)),
    };
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await runDemo(
      (repo) =>
        repo.createTask(
          {
            subjectId: String(data.get('subject')),
            title: String(data.get('title')).trim(),
            instructions: String(data.get('instructions')).trim(),
            opensAt: new Date(String(data.get('opens'))).toISOString(),
            closesAt: new Date(String(data.get('closes'))).toISOString(),
            maxGrade: Number(data.get('maximum')),
            weight: Number(data.get('weight')),
            countsTowardAverage: data.has('counts'),
            allowLate: data.has('late'),
          },
          user.id,
        ),
      'Tarea creada para tu materia.',
    );
    if (result) onDone();
  }
  return (
    <section className="surface results-new-task">
      <h2>Prepara una tarea</h2>
      <form className="stack" onSubmit={submit}>
        <div className="grid-two">
          <Field label="Materia" id="new-task-subject">
            <select id="new-task-subject" name="subject" required>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} · {subject.course} · {subject.year}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Título" id="new-task-title">
            <input id="new-task-title" name="title" required maxLength={120} />
          </Field>
        </div>
        <Field label="Consigna" id="new-task-instructions">
          <textarea id="new-task-instructions" name="instructions" required maxLength={5000} />
        </Field>
        <div className="grid-two">
          <Field label="Disponible desde" id="new-task-opens">
            <input
              id="new-task-opens"
              name="opens"
              type="datetime-local"
              defaultValue={initialDates.opens}
              required
            />
          </Field>
          <Field label="Cierre de entrega" id="new-task-closes">
            <input
              id="new-task-closes"
              name="closes"
              type="datetime-local"
              defaultValue={initialDates.closes}
              required
            />
          </Field>
        </div>
        <div className="grid-two">
          <Field label="Nota máxima" id="new-task-maximum">
            <input
              id="new-task-maximum"
              name="maximum"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue="100"
              required
            />
          </Field>
          <Field label="Peso en el promedio" id="new-task-weight">
            <input
              id="new-task-weight"
              name="weight"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue="1"
              required
            />
          </Field>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" name="counts" defaultChecked />
          Incluir en el promedio cuando se publique la nota
        </label>
        <label className="checkbox-label">
          <input type="checkbox" name="late" />
          Admitir entregas después del cierre, marcadas como tardías
        </label>
        <div className="row wrap">
          <Button type="submit">Crear tarea</Button>
          <Button variant="ghost" onPress={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}

function StudentTask({ state, user, task }: ScreenProps & { task: Task }) {
  const [files, setFiles] = useState<File[]>([]);
  const live = usePathname().startsWith('/aula');
  const [uploading, setUploading] = useState(false);
  const uploaded = useRef(new WeakMap<File, SubmissionFile>());
  const submissions = state.submissions.filter(
    (item) => item.taskId === task.id && item.studentId === user.id,
  );
  const submission = submissions.toSorted((a, b) => a.version - b.version).at(-1);
  const evaluation = latestEvaluation(state, task.id, user.id);
  const reentry = getWorkspaceExtras().resubmissionWindows?.find(
    (window) => window.taskId === task.id && window.studentId === user.id,
  );
  const canSubmit = !submission?.gradedAt || Boolean(reentry);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setUploading(true);
    const result = await runDemo(
      async (repo) => {
        if (
          files.length < 1 ||
          files.length > 5 ||
          files.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024
        )
          throw new Error('Adjunta de 1 a 5 archivos, con un total de hasta 20 MiB.');
        const attachments: SubmissionFile[] = [];
        for (const file of files) {
          if (live) {
            const saved = uploaded.current.get(file) || (await uploadFile(file, 'submission'));
            uploaded.current.set(file, saved);
            attachments.push(saved);
          } else
            attachments.push({
              id: crypto.randomUUID(),
              name: file.name,
              size: file.size,
              mimeType: file.type,
            });
        }
        return repo.submitTask(task.id, attachments, String(data.get('note') ?? ''), user.id);
      },
      live
        ? 'Tu trabajo fue entregado.'
        : 'Entrega de muestra registrada. Se guardaron los datos de los archivos, no su contenido.',
    );
    setUploading(false);
    if (result) {
      setFiles([]);
      form.reset();
    }
  }
  return (
    <div className="task-student-content">
      {submission && (
        <div className="notice task-submission-state">
          <strong>
            {evaluation
              ? 'Nota publicada'
              : submission.gradedAt
                ? 'Corregida, pendiente de publicación'
                : 'Entrega pendiente de revisión'}
          </strong>
          <p>
            Versión {submission.version} · {date(submission.submittedAt)}
            {submission.late ? ' · Fuera de plazo' : ''}
          </p>
          <ul>
            {submission.files.map((file) => (
              <li key={file.id}>
                <FileName file={file} />{' '}
                <span className="results-note">({number(file.size / 1024)} KiB)</span>
              </li>
            ))}
          </ul>
          {evaluation && (
            <p>
              <strong>
                {number(evaluation.grade)} / {number(evaluation.maxGrade)}
              </strong>
              {evaluation.comment && <> · {evaluation.comment}</>}
            </p>
          )}
        </div>
      )}
      {reentry && (
        <p className="notice">
          El docente habilitó una nueva entrega hasta {date(reentry.closesAt)}. Tu evaluación
          anterior se conserva hasta que publique una nueva.
        </p>
      )}
      {canSubmit ? (
        <form className="stack" onSubmit={submit} aria-busy={uploading}>
          <Field
            label={submission ? 'Archivos para reemplazar la entrega' : 'Adjunta tu trabajo'}
            id={`task-files-${task.id}`}
            hint="De 1 a 5 archivos PDF, DOCX, JPG, PNG o WEBP. Máximo 10 MiB por archivo y 20 MiB en total."
          >
            <input
              id={`task-files-${task.id}`}
              type="file"
              multiple
              required
              accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
              aria-describedby={`task-files-${task.id}-hint`}
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
          </Field>
          {files.length > 0 && (
            <p className="results-note">
              {files.length} archivo{files.length > 1 ? 's' : ''} seleccionado
              {files.length > 1 ? 's' : ''} ·{' '}
              {number(files.reduce((total, file) => total + file.size, 0) / 1024)} KiB
            </p>
          )}
          <Field label="Comentario para tu docente" id={`task-note-${task.id}`}>
            <textarea id={`task-note-${task.id}`} name="note" maxLength={3000} rows={2} />
          </Field>
          <p className="results-note">
            {live
              ? 'Tus archivos solo estarán disponibles para ti y el docente de esta materia.'
              : 'En esta demostración se guardan el nombre, el tamaño y el tipo de archivo. El contenido no se sube ni estará disponible para descargar.'}
          </p>
          <Button type="submit" isDisabled={uploading}>
            <Upload size={17} aria-hidden="true" />
            {uploading
              ? 'Subiendo tu trabajo…'
              : submission
                ? 'Reemplazar entrega'
                : 'Entregar trabajo'}
          </Button>
        </form>
      ) : (
        <p className="results-note">
          Esta entrega ya fue corregida. Pide a tu docente que habilite una nueva entrega si
          necesitas hacer cambios.
        </p>
      )}
      {submissions.length > 1 && (
        <details className="results-history">
          <summary>Ver {submissions.length} versiones de la entrega</summary>
          <ul>
            {submissions.map((item) => (
              <li key={item.id}>
                Versión {item.version} · {date(item.submittedAt)} ·{' '}
                {item.files.map((file) => file.name).join(', ')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function TaskReview({
  state,
  user,
  task,
  submission,
}: ScreenProps & { task: Task; submission: TaskSubmission }) {
  const evaluation = latestEvaluation(state, task.id, submission.studentId);
  const published =
    evaluation?.submissionId === submission.id &&
    evaluation.grade === submission.grade &&
    evaluation.comment === (submission.comment ?? '');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    runDemo(
      (repo) =>
        repo.reviewTask(
          submission.id,
          Number(data.get('grade')),
          String(data.get('comment') ?? ''),
          user.id,
        ),
      'Corrección de la tarea guardada. Publica la nota cuando esté lista.',
    );
  }
  return (
    <div className="task-review-card">
      <div className="row wrap between">
        <h3>{studentName(state, submission.studentId)}</h3>
        <Badge tone={published ? 'green' : submission.gradedAt ? '' : 'amber'}>
          {published ? 'Publicada' : submission.gradedAt ? 'Sin publicar' : 'Por revisar'}
        </Badge>
      </div>
      <p className="results-note">
        Versión {submission.version} · {date(submission.submittedAt)}
        {submission.late ? ' · Entrega tardía' : ''}
      </p>
      {submission.note && <p className="answer-quote">{submission.note}</p>}
      <ul>
        {submission.files.map((file) => (
          <li key={file.id}>
            <FileName file={file} />{' '}
            <span className="results-note">· {number(file.size / 1024)} KiB</span>
          </li>
        ))}
      </ul>
      <form className="stack results-review-form" onSubmit={submit}>
        <Field label={`Nota, de 0 a ${task.maxGrade}`} id={`task-grade-${submission.id}`}>
          <input
            id={`task-grade-${submission.id}`}
            name="grade"
            type="number"
            min="0"
            max={task.maxGrade}
            step="0.01"
            required
            defaultValue={submission.grade ?? ''}
            className="grade-input"
          />
        </Field>
        <Field label="Comentario para el estudiante" id={`task-comment-${submission.id}`}>
          <textarea
            id={`task-comment-${submission.id}`}
            name="comment"
            defaultValue={submission.comment ?? ''}
            maxLength={3000}
            rows={2}
          />
        </Field>
        <div className="row wrap">
          <Button variant="secondary small" type="submit">
            Guardar corrección
          </Button>
          <Button
            variant="small"
            isDisabled={submission.grade === undefined || !submission.gradedAt || published}
            onPress={() =>
              runDemo(
                (repo) => repo.publishTaskGrade(submission.id, user.id),
                'Nota de la tarea publicada para el estudiante.',
              )
            }
          >
            {published ? 'Nota publicada' : 'Publicar nota'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FileName({ file }: { file: SubmissionFile }) {
  const live = usePathname().startsWith('/aula');
  return live ? (
    <a href={`/api/files/${file.id}?download=1`} target="_blank" rel="noreferrer">
      {file.name}
    </a>
  ) : (
    <>{file.name}</>
  );
}

export function TasksScreen({ state, user }: ScreenProps) {
  const live = usePathname().startsWith('/aula');
  const [creating, setCreating] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const teacher = user.role === 'teacher';
  const subjects = visibleSubjects(state, user);
  const tasks = state.tasks.filter(
    (task) =>
      subjects.some((subject) => subject.id === task.subjectId) &&
      (selectedSubject === 'all' || selectedSubject === task.subjectId),
  );
  return (
    <>
      <PageHeading
        title={teacher ? 'Aprender también es crear.' : 'Tu trabajo tiene un lugar.'}
        description={
          teacher
            ? 'Comparte una consigna, recibe entregas y acompaña con una revisión.'
            : 'Lee la consigna y prepara lo que quieres compartir con tu docente.'
        }
      >
        {teacher && subjects.length > 0 && (
          <Button onPress={() => setCreating((value) => !value)}>
            <Plus size={17} aria-hidden="true" />
            {creating ? 'Cerrar formulario' : 'Crear tarea'}
          </Button>
        )}
      </PageHeading>
      {creating && teacher && (
        <NewTaskForm subjects={subjects} user={user} onDone={() => setCreating(false)} />
      )}
      <div className="filters results-filters">
        <Field label="Materia" id="tasks-subject">
          <select
            id="tasks-subject"
            value={selectedSubject}
            onChange={(event) => setSelectedSubject(event.target.value)}
          >
            <option value="all">Todas las materias</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} · {subject.course}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!tasks.length ? (
        <EmptyState icon={FileText} title="Todavía no hay tareas aquí">
          {teacher
            ? 'Crea una tarea para una de tus materias.'
            : 'Las consignas de tus materias aparecerán aquí.'}
        </EmptyState>
      ) : (
        <div className="stack">
          {tasks.map((task) => {
            const subject = subjects.find((item) => item.id === task.subjectId)!;
            const latest = new Map<string, TaskSubmission>();
            state.submissions
              .filter((item) => item.taskId === task.id)
              .forEach((item) => {
                if (
                  !latest.has(item.studentId) ||
                  latest.get(item.studentId)!.version < item.version
                )
                  latest.set(item.studentId, item);
              });
            return (
              <article className="surface task-detail" key={task.id}>
                <div className="row wrap between">
                  <div>
                    <div className="eyebrow">
                      {subject.name} · {subject.course} · {subject.year}
                    </div>
                    <h2>{task.title}</h2>
                  </div>
                  <Badge>{number(task.maxGrade)} puntos</Badge>
                </div>
                <p className="task-instructions">{task.instructions}</p>
                <div className="task-deadlines">
                  <span>Disponible: {date(task.opensAt)}</span>
                  <span>Cierre: {date(task.closesAt)}</span>
                </div>
                {task.allowLate && (
                  <p className="results-note">
                    Se aceptan entregas tardías, identificadas como fuera de plazo.
                  </p>
                )}
                {teacher ? (
                  <>
                    <div className="section-head">
                      <h3>Entregas para revisar</h3>
                      <Badge>{latest.size} recibidas</Badge>
                    </div>
                    {latest.size ? (
                      [...latest.values()].map((submission) => (
                        <TaskReview
                          key={`${submission.id}-${submission.gradedAt ?? 'pending'}`}
                          state={state}
                          user={user}
                          task={task}
                          submission={submission}
                        />
                      ))
                    ) : (
                      <p className="results-note">
                        Aún no hay entregas. Los estudiantes aprobados en esta materia pueden
                        participar.
                      </p>
                    )}
                  </>
                ) : (
                  <StudentTask state={state} user={user} task={task} />
                )}
                {teacher && <TaskResubmission state={state} task={task} live={live} />}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
