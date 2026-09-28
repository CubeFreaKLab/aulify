'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Archive, Clock, Plus, RotateCcw, Settings, Users } from 'lucide-react';
import { remoteCommand, runDemo } from '@/demo/store';
import type {
  Activity,
  Attempt,
  DemoState,
  Evaluation,
  ManualActivity,
  Subject,
  Task,
  User,
} from '@/domain';
import { Button, DialogPanel, Field } from './ui';

export interface ClassroomExtras {
  teams?: { id: string; activityId: string; name: string; studentIds: string[] }[];
  incidents?: { attempt_id: string; status: string; comment: string | null; signalCount: number }[];
  participants?: { id: string; activityId: string; studentId: string; alias: string }[];
  draftEvaluations?: Evaluation[];
}

interface CommonProps {
  state: DemoState;
  user: User;
  live: boolean;
}
const stack = { display: 'grid', gap: 20 } as const;
const columns = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 16,
} as const;
const fieldset = {
  border: 0,
  padding: 0,
  margin: 0,
  minWidth: 0,
  display: 'grid',
  gap: 16,
} as const;
const nameOf = (state: DemoState, id: string) =>
  state.users.find((u) => u.id === id)?.name || 'Estudiante';
const date = (value: string) =>
  new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
const number = (value: number) =>
  new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(value);
const inputDate = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const stringOf = (form: FormData, key: string) => String(form.get(key) || '').trim();
const futureDate = () => inputDate(new Date(Date.now() + 86_400_000).toISOString());

function useDisplayTime() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function useAction(live: boolean) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function execute(action: string, args: unknown[], message: string) {
    if (!live || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await runDemo(async () => {
        try {
          await remoteCommand(action, args);
          return true;
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : 'No se pudo guardar. Vuelve a intentarlo.',
          );
          throw cause;
        }
      }, message);
      return result === true;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, execute };
}

function DemoNotice({ live }: { live: boolean }) {
  return live ? null : (
    <p className="notice">
      Esta gestión está disponible al entrar con tu cuenta. La demostración conserva los datos de
      ejemplo.
    </p>
  );
}
function ActionError({ error }: { error: string }) {
  return error ? (
    <p className="notice error" role="alert">
      {error}
    </p>
  ) : null;
}
function Group({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="surface" open={open || undefined}>
      <summary style={{ cursor: 'pointer', fontWeight: 750, paddingBlock: 8 }}>{title}</summary>
      <div style={{ ...stack, marginTop: 18 }}>{children}</div>
    </details>
  );
}

/** Materia, invitación y conservación. Solo se muestra al propietario. */
export function SubjectManagement({
  state,
  user,
  subject,
  live,
}: CommonProps & { subject: Subject }) {
  const uid = useId();
  const action = useAction(live);
  const now = useDisplayTime();
  const [confirmation, setConfirmation] = useState<'archive' | 'renew' | 'disable' | string | null>(
    null,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  if (subject.ownerId !== user.id) return null;
  const archived = subject.status === 'archived';
  const expiry = subject.archivedAt
    ? new Date(new Date(subject.archivedAt).getTime() + 30 * 86_400_000)
    : null;
  const restorable = archived && expiry && expiry.getTime() > now;
  const approved = state.memberships.filter(
    (m) => m.subjectId === subject.id && m.status === 'approved',
  );
  const withdrawing = approved.find((m) => m.id === confirmation);
  const open = (value: string) => {
    setAcknowledged(false);
    setConfirmation(value);
  };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.execute(
      'updateSubject',
      [
        subject.id,
        {
          name: stringOf(form, 'name'),
          course: stringOf(form, 'course'),
          year: Number(form.get('year')),
          description: stringOf(form, 'description'),
        },
      ],
      'Detalles de la materia guardados.',
    );
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result =
      confirmation === 'archive'
        ? await action.execute(
            'archiveSubject',
            [subject.id],
            'Materia archivada. Puedes restaurarla durante treinta días.',
          )
        : withdrawing
          ? await action.execute(
              'withdrawMembership',
              [withdrawing.id, stringOf(form, 'reason')],
              'Inscripción retirada. Los intentos cerrados quedan para revisión.',
            )
          : await action.execute(
              'renewCode',
              [subject.id, confirmation !== 'disable'],
              confirmation === 'disable'
                ? 'Invitaciones desactivadas.'
                : 'Código renovado. Comparte el nuevo código con tu clase.',
            );
    if (result) setConfirmation(null);
  }
  return (
    <div style={stack}>
      <DemoNotice live={live} />
      <ActionError error={action.error} />
      {archived && (
        <div className="notice">
          <strong>Materia archivada.</strong> El alumnado no tiene acceso.{' '}
          {expiry && <>La restauración está disponible hasta el {date(expiry.toISOString())}.</>}
        </div>
      )}
      <section className="surface">
        <h2>Detalles de la materia</h2>
        <form onSubmit={save}>
          <fieldset disabled={!live || action.busy || archived} style={fieldset}>
            <div style={columns}>
              <Field label="Nombre de la materia" id={`${uid}-name`}>
                <input
                  id={`${uid}-name`}
                  name="name"
                  defaultValue={subject.name}
                  required
                  maxLength={120}
                />
              </Field>
              <Field label="Curso o paralelo" id={`${uid}-course`}>
                <input
                  id={`${uid}-course`}
                  name="course"
                  defaultValue={subject.course}
                  required
                  maxLength={80}
                />
              </Field>
              <Field label="Año" id={`${uid}-year`}>
                <input
                  id={`${uid}-year`}
                  name="year"
                  type="number"
                  defaultValue={subject.year}
                  min={2000}
                  max={2200}
                  required
                />
              </Field>
            </div>
            <Field label="Descripción" id={`${uid}-description`}>
              <textarea
                id={`${uid}-description`}
                name="description"
                defaultValue={subject.description}
                rows={3}
                maxLength={2000}
              />
            </Field>
            <div>
              <Button type="submit" isDisabled={!live || action.busy || archived}>
                Guardar detalles
              </Button>
            </div>
          </fieldset>
        </form>
      </section>
      {!archived && (
        <Group title="Invitar y gestionar integrantes">
          <p>
            {subject.code ? (
              <>
                Código actual: <strong style={{ letterSpacing: 2 }}>{subject.code}</strong>. Cada
                solicitud necesita tu aprobación.
              </>
            ) : (
              'Las nuevas invitaciones están desactivadas.'
            )}
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              isDisabled={!live || action.busy}
              onPress={() => open('renew')}
            >
              <RotateCcw size={16} />
              {subject.code ? 'Renovar código' : 'Activar invitaciones'}
            </Button>
            {subject.code && (
              <Button
                variant="ghost"
                isDisabled={!live || action.busy}
                onPress={() => open('disable')}
              >
                Desactivar invitaciones
              </Button>
            )}
          </div>
          {approved.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {approved.map((m) => (
                <li className="list-item" key={m.id} style={{ gap: 12, flexWrap: 'wrap' }}>
                  <span>{nameOf(state, m.studentId)}</span>
                  <Button
                    variant="ghost small"
                    isDisabled={!live || action.busy}
                    onPress={() => open(m.id)}
                  >
                    Retirar inscripción
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Todavía no hay integrantes aprobados.</p>
          )}
        </Group>
      )}
      <Group title={archived ? 'Restaurar materia' : 'Archivo y conservación'}>
        {archived ? (
          <>
            <p>
              Restaurar devuelve el acceso a la clase. Los intentos cerrados y las fechas de entrega
              se conservan: revisa los plazos antes de continuar.
            </p>
            <Button
              isDisabled={!live || action.busy || !restorable}
              onPress={() =>
                action.execute(
                  'restoreSubject',
                  [subject.id],
                  'Materia restaurada. Revisa plazos e intentos antes de continuar.',
                )
              }
            >
              <RotateCcw size={16} />
              Restaurar materia
            </Button>
            {!restorable && <p>El plazo de restauración finalizó.</p>}
          </>
        ) : (
          <>
            <p>
              Archiva una materia cuando ya no esté en uso. Podrás restaurarla durante treinta días;
              después se eliminarán sus datos y archivos exclusivos. Tu biblioteca y las otras
              materias se conservan.
            </p>
            <div>
              <Button
                variant="secondary"
                isDisabled={!live || action.busy}
                onPress={() => open('archive')}
              >
                <Archive size={16} />
                Archivar materia
              </Button>
            </div>
          </>
        )}
      </Group>
      <DialogPanel
        open={confirmation !== null}
        onClose={() => {
          if (!action.busy) setConfirmation(null);
        }}
        title={
          confirmation === 'archive'
            ? 'Archivar esta materia'
            : withdrawing
              ? 'Retirar inscripción'
              : confirmation === 'disable'
                ? 'Desactivar invitaciones'
                : 'Renovar el código'
        }
      >
        <form onSubmit={confirm} style={stack}>
          <p>
            {confirmation === 'archive'
              ? 'Los estudiantes perderán el acceso. Los intentos en curso se cerrarán y necesitarán tu revisión. La materia se eliminará al finalizar los treinta días de conservación.'
              : withdrawing
                ? `${nameOf(state, withdrawing.studentId)} perderá el acceso. Sus respuestas y notas se conservan; los intentos en curso se cierran y requieren revisión.`
                : 'El código anterior dejará de aceptar solicitudes. Los integrantes y las solicitudes pendientes se conservan.'}
          </p>
          {withdrawing && (
            <Field id={`${uid}-reason`} label="Motivo del retiro">
              <textarea
                id={`${uid}-reason`}
                name="reason"
                required
                minLength={3}
                maxLength={1000}
                rows={3}
              />
            </Field>
          )}
          <label className="row">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              required
            />
            Entiendo lo que cambiará.
          </label>
          <ActionError error={action.error} />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Button type="submit" isDisabled={action.busy || !acknowledged}>
              {action.busy ? 'Guardando…' : 'Confirmar'}
            </Button>
            <Button variant="ghost" isDisabled={action.busy} onPress={() => setConfirmation(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogPanel>
    </div>
  );
}

/** Creación y notas de actividades que no requieren archivo ni intento de quiz. */
export function ManualActivities({
  state,
  user,
  live,
  subjectId,
  draftEvaluations = [],
}: CommonProps & { subjectId?: string; draftEvaluations?: Evaluation[] }) {
  const uid = useId();
  const action = useAction(live);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState('');
  const subjects = state.subjects.filter(
    (s) => s.ownerId === user.id && s.status === 'active' && (!subjectId || s.id === subjectId),
  );
  const activities = state.manualActivities.filter((a) =>
    subjects.some((s) => s.id === a.subjectId),
  );
  const active = activities.find((a) => a.id === selected) || activities[0];
  if (user.role !== 'teacher') return null;
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await action.execute(
        'createManualActivity',
        [
          {
            subjectId: stringOf(form, 'subjectId'),
            title: stringOf(form, 'title'),
            description: stringOf(form, 'description'),
            occursAt: stringOf(form, 'occursAt'),
            maxGrade: Number(form.get('maxGrade')),
            weight: Number(form.get('weight')),
            countsTowardAverage: form.has('counts'),
          },
        ],
        'Actividad manual creada. Ya puedes registrar las notas.',
      )
    )
      setCreating(false);
  }
  return (
    <section className="surface" style={stack}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <h2>Actividades de clase</h2>
          <p className="muted">Registra una exposición, una práctica o una participación.</p>
        </div>
        <Button
          variant="secondary"
          isDisabled={!live || !subjects.length}
          onPress={() => setCreating(true)}
        >
          <Plus size={17} />
          Crear actividad manual
        </Button>
      </div>
      <DemoNotice live={live} />
      {active ? (
        <>
          <Field label="Actividad para calificar" id={`${uid}-activity`}>
            <select
              id={`${uid}-activity`}
              value={active.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} · {state.subjects.find((s) => s.id === a.subjectId)?.name}
                </option>
              ))}
            </select>
          </Field>
          <p>
            Máximo: <strong>{number(active.maxGrade)}</strong> · Peso: {number(active.weight)} ·{' '}
            {active.countsTowardAverage ? 'Incluida en el promedio' : 'Fuera del promedio'}. Las
            notas se muestran al estudiante cuando las publicas.
          </p>
          {!state.memberships.some(
            (m) => m.subjectId === active.subjectId && m.status === 'approved',
          ) && (
            <p className="muted">Aprueba integrantes de esta materia para registrar sus notas.</p>
          )}
          {state.memberships
            .filter((m) => m.subjectId === active.subjectId && m.status === 'approved')
            .map((m) => (
              <ManualGradeRow
                key={`${active.id}:${m.studentId}`}
                state={state}
                activity={active}
                studentId={m.studentId}
                live={live}
                draftEvaluations={draftEvaluations}
              />
            ))}
        </>
      ) : (
        <p className="muted">
          Crea una actividad para registrar notas sin pedir un archivo ni iniciar un quiz.
        </p>
      )}
      <DialogPanel
        open={creating}
        onClose={() => {
          if (!action.busy) setCreating(false);
        }}
        title="Nueva actividad manual"
      >
        <form onSubmit={create} style={stack}>
          <fieldset disabled={action.busy} style={fieldset}>
            <Field label="Materia" id={`${uid}-subject`}>
              <select
                id={`${uid}-subject`}
                name="subjectId"
                defaultValue={subjectId || subjects[0]?.id}
                required
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.course}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Título" id={`${uid}-title`}>
              <input
                id={`${uid}-title`}
                name="title"
                required
                maxLength={120}
                placeholder="Por ejemplo: exposición sobre ecosistemas"
              />
            </Field>
            <Field label="Descripción" id={`${uid}-description`}>
              <textarea id={`${uid}-description`} name="description" rows={3} maxLength={3000} />
            </Field>
            <Field label="Fecha de la actividad" id={`${uid}-date`}>
              <input
                id={`${uid}-date`}
                type="date"
                name="occursAt"
                defaultValue={inputDate(new Date().toISOString()).slice(0, 10)}
                required
              />
            </Field>
            <div style={columns}>
              <Field label="Nota máxima" id={`${uid}-maximum`}>
                <input
                  id={`${uid}-maximum`}
                  type="number"
                  name="maxGrade"
                  defaultValue={100}
                  min={0.01}
                  max={1000}
                  step="0.01"
                  required
                />
              </Field>
              <Field label="Peso en el promedio" id={`${uid}-weight`}>
                <input
                  id={`${uid}-weight`}
                  type="number"
                  name="weight"
                  defaultValue={1}
                  min={0.01}
                  max={100}
                  step="0.01"
                  required
                />
              </Field>
            </div>
            <label className="row">
              <input type="checkbox" name="counts" defaultChecked />
              Incluir en el promedio de la materia
            </label>
            <p className="muted">
              El máximo, el peso y la inclusión quedan fijados cuando registras la primera nota.
            </p>
          </fieldset>
          <ActionError error={action.error} />
          <Button type="submit" isDisabled={action.busy}>
            {action.busy ? 'Creando…' : 'Crear actividad'}
          </Button>
        </form>
      </DialogPanel>
    </section>
  );
}

function ManualGradeRow({
  state,
  activity,
  studentId,
  live,
  draftEvaluations,
}: {
  state: DemoState;
  activity: ManualActivity;
  studentId: string;
  live: boolean;
  draftEvaluations: Evaluation[];
}) {
  const uid = useId();
  const action = useAction(live);
  const [formError, setFormError] = useState('');
  const all = [...state.evaluations, ...draftEvaluations]
    .filter((e) => e.activityId === activity.id && e.studentId === studentId)
    .sort((a, b) => b.revision - a.revision);
  const latest = all[0],
    published = all.find((e) => Boolean(e.publishedAt));
  const draft = draftEvaluations
    .filter((e) => e.activityId === activity.id && e.studentId === studentId)
    .sort((a, b) => b.revision - a.revision)[0];
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFormError('');
    if (Number(form.get('grade')) === 0 && !stringOf(form, 'reason')) {
      setFormError('Añade el motivo antes de registrar una nota de cero.');
      return;
    }
    await action.execute(
      'gradeManual',
      [
        activity.id,
        studentId,
        Number(form.get('grade')),
        stringOf(form, 'comment'),
        stringOf(form, 'reason') || null,
        form.has('publish'),
      ],
      form.has('publish')
        ? 'Nota publicada para el estudiante.'
        : 'Corrección guardada. Todavía no es visible para el estudiante.',
    );
  }
  return (
    <details style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
      <summary style={{ cursor: 'pointer', paddingBlock: 8 }}>
        <strong>{nameOf(state, studentId)}</strong> ·{' '}
        {published
          ? `${number(published.grade)} / ${number(activity.maxGrade)} publicada`
          : 'Sin nota publicada'}
        {draft && ' · Corrección pendiente de publicar'}
      </summary>
      <form key={latest?.id || 'new'} onSubmit={save} style={{ ...stack, marginTop: 16 }}>
        <fieldset style={fieldset} disabled={!live || action.busy}>
          <div style={columns}>
            <Field label={`Nota sobre ${number(activity.maxGrade)}`} id={`${uid}-grade`}>
              <input
                id={`${uid}-grade`}
                name="grade"
                type="number"
                min={0}
                max={activity.maxGrade}
                step="0.01"
                defaultValue={latest?.grade ?? ''}
                required
              />
            </Field>
            <Field label="Comentario para el estudiante" id={`${uid}-comment`}>
              <textarea
                id={`${uid}-comment`}
                name="comment"
                defaultValue={latest?.comment || ''}
                rows={2}
                maxLength={2000}
              />
            </Field>
          </div>
          <Field
            label={
              latest
                ? 'Motivo de la nueva corrección'
                : 'Motivo, si registras cero por no participar'
            }
            id={`${uid}-reason`}
          >
            <textarea
              id={`${uid}-reason`}
              name="reason"
              required={Boolean(latest)}
              rows={2}
              maxLength={1000}
            />
          </Field>
          <label className="row">
            <input name="publish" type="checkbox" />
            Publicar esta nota al guardarla
          </label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Button type="submit" isDisabled={!live || action.busy}>
              Guardar nota
            </Button>
            {draft && (
              <Button
                variant="secondary"
                isDisabled={!live || action.busy}
                onPress={() =>
                  action.execute(
                    'publishEvaluation',
                    [draft.id],
                    'Nota publicada para el estudiante.',
                  )
                }
              >
                Publicar corrección guardada
              </Button>
            )}
          </div>
        </fieldset>
        <ActionError error={formError || action.error} />
      </form>
    </details>
  );
}

/** Se integra en la ficha de tarea del propietario, debajo de las entregas. */
export function TaskResubmission({
  state,
  task,
  live,
}: {
  state: DemoState;
  task: Task;
  live: boolean;
}) {
  const uid = useId();
  const action = useAction(live);
  const studentIds = [
    ...new Set(state.submissions.filter((s) => s.taskId === task.id).map((s) => s.studentId)),
  ];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.execute(
      'allowResubmission',
      [
        task.id,
        stringOf(form, 'student'),
        new Date(stringOf(form, 'deadline')).toISOString(),
        stringOf(form, 'reason'),
      ],
      'Reentrega autorizada hasta el plazo indicado.',
    );
  }
  return (
    <div style={stack}>
      <Group title="Autorizar una reentrega">
        <p>
          Abre una oportunidad individual con su propia fecha límite. La entrega y la nota
          anteriores se conservan hasta que revises y publiques la nueva versión.
        </p>
        <DemoNotice live={live} />
        {!studentIds.length ? (
          <p className="muted">Esta tarea todavía no tiene entregas.</p>
        ) : (
          <form onSubmit={submit} style={stack}>
            <fieldset disabled={!live || action.busy} style={fieldset}>
              <div style={columns}>
                <Field label="Estudiante" id={`${uid}-student`}>
                  <select id={`${uid}-student`} name="student" required>
                    {studentIds.map((id) => (
                      <option key={id} value={id}>
                        {nameOf(state, id)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nueva fecha límite (hora local)" id={`${uid}-deadline`}>
                  <input
                    id={`${uid}-deadline`}
                    type="datetime-local"
                    name="deadline"
                    defaultValue={futureDate()}
                    min={inputDate(new Date().toISOString())}
                    required
                  />
                </Field>
              </div>
              <Field label="Motivo de la reentrega" id={`${uid}-reason`}>
                <textarea
                  id={`${uid}-reason`}
                  name="reason"
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={2}
                />
              </Field>
              <div>
                <Button type="submit" isDisabled={!live || action.busy}>
                  Autorizar reentrega
                </Button>
              </div>
            </fieldset>
            <ActionError error={action.error} />
          </form>
        )}
      </Group>
      <NonparticipationGrades
        state={state}
        activityId={task.id}
        subjectId={task.subjectId}
        live={live}
        closesAt={task.closesAt}
      />
    </div>
  );
}

/** Controles del propietario; se puede integrar también en una lista de actividades. */
export function ActivityManagement({
  state,
  user,
  activity,
  live,
  extras = {},
}: CommonProps & { activity: Activity; extras?: ClassroomExtras }) {
  const uid = useId();
  const action = useAction(live);
  const now = useDisplayTime();
  if (state.subjects.find((s) => s.id === activity.subjectId)?.ownerId !== user.id) return null;
  const archived = state.subjects.find((s) => s.id === activity.subjectId)?.status === 'archived';
  const attempts = state.attempts.filter((a) => a.activityId === activity.id);
  const administrative = attempts.filter(
    (a) => ['removed', 'archived', 'teacher-ended'].includes(a.closeReason || '') && !a.resolution,
  );
  const participants =
    extras.participants?.filter(
      (p) =>
        p.activityId === activity.id &&
        attempts.some((a) => a.studentId === p.studentId && a.status === 'in-progress'),
    ) || [];
  const incidents =
    extras.incidents?.filter((i) => attempts.some((a) => a.id === i.attempt_id)) || [];
  const closed = new Date(activity.settings.closesAt).getTime() <= now;
  async function extend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.execute(
      'extendDeadline',
      [
        activity.id,
        new Date(stringOf(form, 'deadline')).toISOString(),
        stringOf(form, 'reason'),
        stringOf(form, 'participant') || null,
      ],
      'Plazo ampliado. Los intentos ya cerrados se conservan.',
    );
  }
  return (
    <div style={stack}>
      <DemoNotice live={live} />
      {archived && (
        <p className="notice">
          Esta materia es de solo lectura. Restáurala para gestionar sus actividades.
        </p>
      )}
      {activity.settings.teams && (
        <TeamsManagement
          state={state}
          activity={activity}
          live={live && !archived}
          teams={extras.teams || []}
        />
      )}
      <Group title="Ampliar un plazo">
        <p>
          Cierre actual: {date(activity.settings.closesAt)}. Puedes ampliar antes del cierre; los
          intentos ya cerrados no se reabren. Para superar el cierre general en una ampliación
          individual, amplía primero el cierre de la actividad.
        </p>
        {closed ? (
          <p className="muted">
            El plazo general ya finalizó. Crea una actividad nueva si necesitas otra ronda.
          </p>
        ) : (
          <form onSubmit={extend} style={stack}>
            <fieldset disabled={!live || action.busy || archived} style={fieldset}>
              <div style={columns}>
                <Field label="Aplicar la ampliación" id={`${uid}-participant`}>
                  <select id={`${uid}-participant`} name="participant">
                    <option value="">Cierre general de la actividad</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {nameOf(state, p.studentId)} · intento en curso
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nuevo límite (hora local)" id={`${uid}-deadline`}>
                  <input
                    id={`${uid}-deadline`}
                    name="deadline"
                    type="datetime-local"
                    min={inputDate(new Date().toISOString())}
                    defaultValue={inputDate(
                      new Date(
                        new Date(activity.settings.closesAt).getTime() + 3_600_000,
                      ).toISOString(),
                    )}
                    required
                  />
                </Field>
              </div>
              <Field label="Motivo de la ampliación" id={`${uid}-reason`}>
                <textarea
                  id={`${uid}-reason`}
                  name="reason"
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={2}
                />
              </Field>
              <div>
                <Button type="submit" isDisabled={!live || action.busy || archived}>
                  <Clock size={16} />
                  Ampliar plazo
                </Button>
              </div>
            </fieldset>
            <ActionError error={action.error} />
          </form>
        )}
      </Group>
      {administrative.length > 0 && (
        <Group title={`Intentos que necesitan una decisión (${administrative.length})`} open>
          <p>
            Estos intentos se cerraron al retirar una inscripción, archivar la materia o finalizar
            antes la sesión. Decide cómo tratarlos antes de publicar resultados definitivos.
          </p>
          {administrative.map((a) => (
            <AttemptResolution key={a.id} attempt={a} state={state} live={live && !archived} />
          ))}
        </Group>
      )}
      {activity.settings.reportVisibility && (
        <Group title={`Señales para revisar (${incidents.length})`}>
          <p>
            Una pestaña oculta puede deberse a una notificación o a otra situación. Estas señales no
            prueban una falta y no cambian la nota automáticamente.
          </p>
          {incidents.length ? (
            incidents.map((i) => (
              <IncidentReview
                key={i.attempt_id}
                incident={i}
                state={state}
                live={live && !archived}
              />
            ))
          ) : (
            <p className="muted">No hay señales registradas en esta actividad.</p>
          )}
        </Group>
      )}
      {activity.guided?.status === 'running' && (
        <EarlySessionClose activityId={activity.id} live={live && !archived} />
      )}
      <NonparticipationGrades
        state={state}
        activityId={activity.id}
        subjectId={activity.subjectId}
        live={live && !archived}
        closesAt={activity.settings.closesAt}
      />
      <ActivityRanking activityId={activity.id} live={live} state={state} />
    </div>
  );
}

export function NonparticipationGrades({
  state,
  activityId,
  subjectId,
  live,
  closesAt,
}: {
  state: DemoState;
  activityId: string;
  subjectId: string;
  live: boolean;
  closesAt: string;
}) {
  const uid = useId();
  const action = useAction(live);
  const now = useDisplayTime();
  const closed = new Date(closesAt).getTime() <= now;
  const candidates = state.memberships.filter(
    (m) =>
      m.subjectId === subjectId &&
      m.status === 'approved' &&
      !state.attempts.some((a) => a.activityId === activityId && a.studentId === m.studentId) &&
      !state.submissions.some((s) => s.taskId === activityId && s.studentId === m.studentId) &&
      !state.evaluations.some((e) => e.activityId === activityId && e.studentId === m.studentId),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.execute(
      'recordNonparticipation',
      [
        activityId,
        stringOf(form, 'student'),
        0,
        stringOf(form, 'comment'),
        stringOf(form, 'reason'),
        true,
      ],
      'Nota de cero publicada por decisión docente, con su motivo registrado.',
    );
  }
  return (
    <Group title="Revisar a quienes no participaron">
      <p>
        La falta de entrega o participación queda pendiente y fuera del promedio. Si corresponde una
        nota de cero, debes decidirlo y registrar el motivo; no se asigna automáticamente.
      </p>
      {!closed ? (
        <p className="muted">Esta decisión estará disponible después del cierre de la actividad.</p>
      ) : !candidates.length ? (
        <p className="muted">No hay estudiantes sin participación y sin nota publicada.</p>
      ) : (
        <form onSubmit={submit} style={stack}>
          <fieldset disabled={!live || action.busy} style={fieldset}>
            <Field label="Estudiante sin participación" id={`${uid}-student`}>
              <select id={`${uid}-student`} name="student" required defaultValue="">
                <option value="" disabled>
                  Selecciona un estudiante
                </option>
                {candidates.map((m) => (
                  <option key={m.id} value={m.studentId}>
                    {nameOf(state, m.studentId)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Motivo de la nota de cero" id={`${uid}-reason`}>
              <textarea
                id={`${uid}-reason`}
                name="reason"
                required
                minLength={3}
                maxLength={1000}
                rows={3}
              />
            </Field>
            <Field label="Comentario para el estudiante" id={`${uid}-comment`}>
              <textarea id={`${uid}-comment`} name="comment" maxLength={1000} rows={2} />
            </Field>
            <label className="checkbox-label">
              <input type="checkbox" required />
              Confirmo que corresponde publicar una nota de cero para este estudiante.
            </label>
            <div>
              <Button type="submit" isDisabled={!live || action.busy}>
                Publicar cero con motivo
              </Button>
            </div>
          </fieldset>
          <ActionError error={action.error} />
        </form>
      )}
    </Group>
  );
}

function EarlySessionClose({ activityId, live }: { activityId: string; live: boolean }) {
  const uid = useId();
  const action = useAction(live);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.execute(
      'endGuidedSession',
      [activityId, stringOf(form, 'reason'), true],
      'Sesión finalizada antes de tiempo. Resuelve los intentos antes de publicar sus notas.',
    );
  }
  return (
    <Group title="Finalizar la sesión antes de tiempo">
      <p>
        Se cerrarán los intentos en curso. Deberás decidir si evalúas las respuestas confirmadas o
        excluyes cada intento. Las omisiones no se publican como ceros automáticamente.
      </p>
      <form onSubmit={submit} style={stack}>
        <fieldset disabled={!live || action.busy} style={fieldset}>
          <Field label="Motivo del cierre anticipado" id={`${uid}-reason`}>
            <textarea
              id={`${uid}-reason`}
              name="reason"
              required
              minLength={3}
              maxLength={1000}
              rows={3}
            />
          </Field>
          <label className="checkbox-label">
            <input type="checkbox" required />
            Confirmo que quiero finalizar esta sesión y revisar los intentos afectados.
          </label>
          <div>
            <Button type="submit" variant="secondary" isDisabled={!live || action.busy}>
              Finalizar sesión
            </Button>
          </div>
        </fieldset>
        <ActionError error={action.error} />
      </form>
    </Group>
  );
}

function AttemptResolution({
  attempt,
  state,
  live,
}: {
  attempt: Attempt;
  state: DemoState;
  live: boolean;
}) {
  const uid = useId();
  const action = useAction(live);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.execute(
      'resolveAttempt',
      [attempt.id, stringOf(form, 'decision'), stringOf(form, 'reason')],
      'Decisión guardada. Revisa las respuestas pendientes antes de publicar la nota.',
    );
  }
  return (
    <form
      onSubmit={submit}
      style={{ ...stack, borderTop: '1px solid var(--line)', paddingTop: 16 }}
    >
      <h3>
        {nameOf(state, attempt.studentId)} · intento {attempt.number}
      </h3>
      <p>
        {attempt.answers.length} respuestas confirmadas de {attempt.questionOrder.length} preguntas.
      </p>
      <fieldset disabled={!live || action.busy} style={fieldset}>
        <Field label="Decisión" id={`${uid}-decision`}>
          <select id={`${uid}-decision`} name="decision" required defaultValue="">
            <option value="" disabled>
              Selecciona una decisión
            </option>
            <option value="evaluate">Evaluar las respuestas confirmadas; omisiones con cero</option>
            <option value="exclude">Excluir este intento de nota y clasificación</option>
          </select>
        </Field>
        <p className="muted">
          Excluir no publica un cero ni devuelve intentos o potenciadores consumidos.
        </p>
        <Field label="Motivo" id={`${uid}-reason`}>
          <textarea
            id={`${uid}-reason`}
            name="reason"
            required
            minLength={3}
            maxLength={1000}
            rows={2}
          />
        </Field>
        <div>
          <Button type="submit" isDisabled={!live || action.busy}>
            Guardar decisión
          </Button>
        </div>
      </fieldset>
      <ActionError error={action.error} />
    </form>
  );
}

function IncidentReview({
  incident,
  state,
  live,
}: {
  incident: NonNullable<ClassroomExtras['incidents']>[number];
  state: DemoState;
  live: boolean;
}) {
  const uid = useId();
  const action = useAction(live);
  const attempt = state.attempts.find((a) => a.id === incident.attempt_id);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.execute(
      'reviewIncident',
      [incident.attempt_id, stringOf(form, 'status'), stringOf(form, 'comment')],
      'Revisión de la señal guardada. La calificación no se modifica.',
    );
  }
  return (
    <details style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <summary style={{ cursor: 'pointer', paddingBlock: 8 }}>
        {nameOf(state, attempt?.studentId || '')} · {incident.signalCount} señales ·{' '}
        {incident.status === 'pending' ? 'Pendiente' : 'Revisada'}
      </summary>
      <form onSubmit={submit} style={{ ...stack, marginTop: 16 }}>
        <fieldset disabled={!live || action.busy} style={fieldset}>
          <Field label="Resultado de la revisión" id={`${uid}-status`}>
            <select
              id={`${uid}-status`}
              name="status"
              defaultValue={incident.status === 'pending' ? '' : incident.status}
              required
            >
              <option value="" disabled>
                Selecciona un resultado
              </option>
              <option value="reviewed_no_action">Revisada, sin observación</option>
              <option value="reviewed_observation">Revisada, con observación</option>
            </select>
          </Field>
          <Field label="Comentario de revisión" id={`${uid}-comment`}>
            <textarea
              id={`${uid}-comment`}
              name="comment"
              defaultValue={incident.comment || ''}
              required
              minLength={3}
              maxLength={1000}
              rows={3}
            />
          </Field>
          <div>
            <Button type="submit" isDisabled={!live || action.busy}>
              Guardar revisión
            </Button>
          </div>
        </fieldset>
        <ActionError error={action.error} />
      </form>
    </details>
  );
}

function TeamsManagement({
  state,
  activity,
  live,
  teams,
}: {
  state: DemoState;
  activity: Activity;
  live: boolean;
  teams: NonNullable<ClassroomExtras['teams']>;
}) {
  const uid = useId();
  const action = useAction(live);
  const [open, setOpen] = useState(false);
  const current = teams.filter((t) => t.activityId === activity.id);
  const [draft, setDraft] = useState<{ name: string; studentIds: string[] }[]>([]);
  const students = state.memberships
    .filter((m) => m.subjectId === activity.subjectId && m.status === 'approved')
    .map((m) => m.studentId);
  const locked =
    Boolean(activity.lockedAt) || state.attempts.some((a) => a.activityId === activity.id);
  const [localError, setLocalError] = useState('');
  async function automatic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.execute(
      'autoTeams',
      [activity.id, Number(form.get('count'))],
      'Equipos repartidos. Puedes ajustar integrantes antes de iniciar.',
    );
  }
  function startEditing() {
    setDraft(current.map((t) => ({ name: t.name, studentIds: [...t.studentIds] })));
    setLocalError('');
    setOpen(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const final = draft.map((t) => ({
      name: t.name.trim(),
      studentIds: t.studentIds.filter((id) => students.includes(id)),
    }));
    if (
      final.some((t) => !t.name || !t.studentIds.length) ||
      students.some((id) => final.filter((t) => t.studentIds.includes(id)).length !== 1)
    ) {
      setLocalError(
        'Asigna cada integrante a un equipo y conserva al menos una persona por equipo.',
      );
      return;
    }
    if (
      await action.execute(
        'configureTeams',
        [activity.id, final],
        'Distribución de equipos guardada.',
      )
    )
      setOpen(false);
  }
  return (
    <Group title="Equipos de esta actividad">
      <p>
        Las respuestas y notas siguen siendo individuales. La clasificación de cada equipo usa el
        promedio de puntos de su lista; quien no participa aporta cero al equipo.
      </p>
      {current.map((t) => (
        <div key={t.id}>
          <strong>{t.name}</strong>
          <p className="muted">{(t.studentIds || []).map((id) => nameOf(state, id)).join(', ')}</p>
        </div>
      ))}
      {locked ? (
        <p className="notice">
          La actividad ya comenzó. La lista de equipos se conserva para mantener la clasificación.
        </p>
      ) : students.length ? (
        <>
          <form
            onSubmit={automatic}
            className="row"
            style={{ alignItems: 'end', flexWrap: 'wrap' }}
          >
            <Field label="Cantidad de equipos" id={`${uid}-count`}>
              <input
                id={`${uid}-count`}
                type="number"
                name="count"
                defaultValue={Math.min(2, students.length)}
                min={1}
                max={students.length}
                required
                disabled={!live || action.busy}
              />
            </Field>
            <Button type="submit" isDisabled={!live || action.busy}>
              <Users size={16} />
              Repartir automáticamente
            </Button>
            {current.length > 0 && (
              <Button variant="secondary" isDisabled={!live || action.busy} onPress={startEditing}>
                <Settings size={16} />
                Ajustar equipos
              </Button>
            )}
          </form>
          <p className="muted">
            El reparto automático sustituye la distribución actual y equilibra la cantidad de
            integrantes.
          </p>
        </>
      ) : (
        <p className="muted">Aprueba integrantes en la materia antes de repartir equipos.</p>
      )}
      <ActionError error={action.error} />
      <DialogPanel
        open={open}
        onClose={() => {
          if (!action.busy) setOpen(false);
        }}
        title="Ajustar equipos"
      >
        <form onSubmit={save} style={stack}>
          <fieldset disabled={action.busy} style={fieldset}>
            {draft.map((t, index) => (
              <Field
                key={index}
                label={`Nombre del equipo ${index + 1}`}
                id={`${uid}-team-${index}`}
              >
                <input
                  id={`${uid}-team-${index}`}
                  value={t.name}
                  maxLength={80}
                  required
                  onChange={(e) =>
                    setDraft(
                      draft.map((v, i) => (i === index ? { ...v, name: e.target.value } : v)),
                    )
                  }
                />
              </Field>
            ))}
            {students.map((id) => (
              <Field key={id} label={nameOf(state, id)} id={`${uid}-${id}`}>
                <select
                  id={`${uid}-${id}`}
                  value={draft.findIndex((t) => t.studentIds.includes(id))}
                  onChange={(e) => {
                    const index = Number(e.target.value);
                    setDraft(
                      draft.map((t, i) => ({
                        ...t,
                        studentIds:
                          i === index
                            ? [...t.studentIds.filter((v) => v !== id), id]
                            : t.studentIds.filter((v) => v !== id),
                      })),
                    );
                  }}
                  required
                >
                  <option value={-1} disabled>
                    Selecciona un equipo
                  </option>
                  {draft.map((t, i) => (
                    <option key={i} value={i}>
                      {t.name || `Equipo ${i + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </fieldset>
          <ActionError error={localError || action.error} />
          <Button type="submit" isDisabled={action.busy}>
            Guardar equipos
          </Button>
        </form>
      </DialogPanel>
    </Group>
  );
}

interface RankingResult {
  available: boolean;
  reason?: string;
  provisional?: boolean;
  individual?: {
    alias: string;
    team: string | null;
    studentId?: string;
    points: number;
    rank: number;
  }[];
  teams?: { name: string; points: number; rank: number }[];
}
/** La proyección remota decide la visibilidad; nunca reconstruye puntos ocultos. */
export function ActivityRanking({
  activityId,
  live,
  state,
}: {
  activityId: string;
  live: boolean;
  state?: DemoState;
}) {
  const [result, setResult] = useState<RankingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    if (!live || busy) return;
    setBusy(true);
    setError('');
    try {
      setResult(await remoteCommand<RankingResult>('ranking', [activityId]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar la clasificación.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Group title="Clasificación">
      <p>
        Los empates comparten puesto. El resultado puede ser provisional mientras haya respuestas
        por revisar o participantes en curso.
      </p>
      <div>
        <Button variant="secondary" onPress={load} isDisabled={!live || busy}>
          {busy ? 'Consultando…' : result ? 'Actualizar clasificación' : 'Ver clasificación'}
        </Button>
      </div>
      <ActionError error={error} />
      {result && !result.available && <p className="notice">{result.reason}</p>}
      {result?.available && (
        <>
          <p role="status">
            {result.provisional ? 'Clasificación provisional' : 'Clasificación definitiva'} ·{' '}
            {result.individual?.length || 0} participantes
          </p>
          <div
            className="table-wrap"
            role="region"
            aria-label="Clasificación individual"
            tabIndex={0}
          >
            <table>
              <caption className="sr-only">Puntos individuales</caption>
              <thead>
                <tr>
                  <th scope="col">Puesto</th>
                  <th scope="col">Participante</th>
                  <th scope="col">Equipo</th>
                  <th scope="col">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {result.individual?.map((row) => (
                  <tr key={row.alias}>
                    <td>{row.rank}</td>
                    <th scope="row">
                      {row.studentId && state ? nameOf(state, row.studentId) : row.alias}
                    </th>
                    <td>{row.team || '—'}</td>
                    <td>{number(row.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Boolean(result.teams?.length) && (
            <div
              className="table-wrap"
              role="region"
              aria-label="Clasificación por equipos"
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">Promedio de puntos de los equipos</caption>
                <thead>
                  <tr>
                    <th scope="col">Puesto</th>
                    <th scope="col">Equipo</th>
                    <th scope="col">Promedio de puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {result.teams?.map((row) => (
                    <tr key={row.name}>
                      <td>{row.rank}</td>
                      <th scope="row">{row.name}</th>
                      <td>{number(row.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Group>
  );
}
