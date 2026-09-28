'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspaceRouter as useRouter } from './workspace-link';
import {
  Eye,
  ArrowUpRight,
  Check,
  Cloud,
  Heading2,
  Type,
  List,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import {
  defaultActivitySettings,
  questionsOf,
  type ActivitySettings,
  type DemoState,
  type Resource,
  type User,
} from '@/domain';
import { runDemo, getDemoRepository, remoteCommand } from '@/demo/store';
import { Button, Badge, PageHeading, DialogPanel, Field, EmptyState } from './ui';
import { QuestionAuthor } from './question-author';
const RichEditor = dynamic(() => import('./rich-editor'), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" aria-label="Cargando editor" style={{ padding: 32 }}>
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" style={{ width: '60%' }} />
    </div>
  ),
});

export function EditorScreen({
  resourceId,
  state,
  user,
}: {
  resourceId: string;
  state: DemoState;
  user: User;
}) {
  const resource = state.resources.find((r) => r.id === resourceId && r.ownerId === user.id);
  if (!resource)
    return (
      <EmptyState icon={BookOpen} title="Este recurso no está disponible">
        Vuelve a la biblioteca para elegir uno de tus recursos.
      </EmptyState>
    );
  return <EditorForm key={resource.id} resource={resource} state={state} user={user} />;
}
function EditorForm({
  resource,
  state,
  user,
}: {
  resource: Resource;
  state: DemoState;
  user: User;
}) {
  const router = useRouter();
  const live = usePathname().startsWith('/aula');
  const [publishPending, setPublishPending] = useState(false);
  const publishLock = useRef(false);
  const [draft, setDraft] = useState<Resource>(() => structuredClone(resource));
  const [saving, setSaving] = useState<'saved' | 'pending' | 'error'>('saved');
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const dirty = useRef(false),
    revision = useRef(resource.revision),
    latest = useRef(draft);
  const [settings, setSettings] = useState<ActivitySettings>(() =>
    defaultActivitySettings(new Date().toISOString()),
  );
  const [subjectId, setSubjectId] = useState(
    state.subjects.find((s) => s.ownerId === user.id)?.id || '',
  );
  const inFlight = useRef<Promise<Resource | undefined> | null>(null);
  function update(value: Resource) {
    dirty.current = true;
    latest.current = value;
    setDraft(value);
    setSaving('pending');
  }
  async function save(): Promise<Resource | undefined> {
    if (inFlight.current) await inFlight.current;
    if (!dirty.current) return latest.current;
    const submitted = latest.current;
    const pending = runDemo((repo) => repo.saveDraft(submitted, revision.current, user.id));
    inFlight.current = pending;
    const result = await pending;
    inFlight.current = null;
    if (result) {
      revision.current = result.revision;
      if (latest.current === submitted) {
        latest.current = result;
        dirty.current = false;
      }
      setSaving(dirty.current ? 'pending' : 'saved');
      setConflict(false);
      return result;
    }
    setSaving('error');
    setConflict(true);
    return undefined;
  }
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => saveRef.current(), 1000);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(
    () => () => {
      if (dirty.current) saveRef.current();
    },
    [],
  );
  const publish = async () => {
    if (publishLock.current) return;
    publishLock.current = true;
    setPublishPending(true);
    try {
      const saved = await save();
      if (!saved) return;
      const activity = await runDemo(async (repo) => {
        const version = await repo.publishResource(saved.id, user.id);
        if (!questionsOf(saved).length) {
          if (!live)
            throw new Error(
              'Publica un recurso de lectura desde tu cuenta, o añade preguntas para explorar el quiz de demostración.',
            );
          return remoteCommand('publishReading', [version.id, subjectId]);
        }
        return repo.createActivity(version.id, subjectId, settings, saved.title, user.id);
      }, 'Recurso publicado en tu materia.');
      if (activity) {
        setPublishing(false);
        router.push(`/demo/materia/${subjectId}`);
      }
    } finally {
      publishLock.current = false;
      setPublishPending(false);
    }
  };
  const questions = questionsOf(draft);
  return (
    <>
      <PageHeading
        title="Dale forma a tu clase."
        description="Explica con claridad. Deja espacio para descubrir."
      >
        <Badge tone={saving === 'error' ? 'red' : saving === 'saved' ? 'green' : ''}>
          {saving === 'saved' ? <Check size={13} /> : <Cloud size={13} />}{' '}
          {saving === 'saved'
            ? 'Borrador guardado'
            : saving === 'pending'
              ? 'Guardando…'
              : 'No se pudo guardar'}
        </Badge>
        <Button
          variant="secondary"
          onPress={async () => {
            if (await save()) router.push(`/demo/previa/${draft.id}`);
          }}
        >
          <Eye size={16} />
          Vista previa
        </Button>
        <Button
          onPress={async () => {
            if (await save()) setPublishing(true);
          }}
        >
          Publicar
          <ArrowUpRight size={16} />
        </Button>
      </PageHeading>
      {conflict && (
        <div className="notice warning" role="alert" style={{ marginBottom: 20 }}>
          <strong>El borrador no se guardó.</strong>
          <p>
            Puedes reintentar. Si otra pestaña cambió el recurso, conserva una copia antes de
            recargar.
          </p>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <Button variant="secondary small" onPress={save}>
              Reintentar
            </Button>
            <Button
              variant="secondary small"
              onPress={async () => {
                const copy = await runDemo((repo) =>
                  repo.saveDraft(
                    {
                      ...latest.current,
                      id: crypto.randomUUID(),
                      title: `${latest.current.title} (copia)`,
                      revision: 0,
                    },
                    0,
                    user.id,
                  ),
                );
                if (copy) {
                  dirty.current = false;
                  router.push(`/demo/editor/${copy.id}`);
                }
              }}
            >
              Conservar una copia
            </Button>
            <Button
              variant="ghost small"
              onPress={() => {
                const actual = getDemoRepository()
                  .load()
                  .resources.find((r) => r.id === draft.id);
                if (actual) {
                  dirty.current = false;
                  revision.current = actual.revision;
                  latest.current = actual;
                  setDraft(actual);
                  setEditorKey((k) => k + 1);
                  setSaving('saved');
                  setConflict(false);
                }
              }}
            >
              Recargar borrador
            </Button>
          </div>
        </div>
      )}
      <div className="editor-layout">
        <div className="editor-sheet">
          <div className="editor-sheet-head">
            <label className="sr-only" htmlFor="resource-title">
              Título del recurso
            </label>
            <textarea
              className="editor-title"
              id="resource-title"
              rows={1}
              maxLength={120}
              value={draft.title}
              onChange={(e) => update({ ...draft, title: e.target.value.replace(/[\r\n]+/g, ' ') })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
            />
            <div className="editor-meta">
              <BookOpen size={14} />
              <span>Recurso de clase</span>
              <span>·</span>
              <span>Solo tú puedes editarlo</span>
            </div>
          </div>
          <RichEditor
            key={editorKey}
            blocks={draft.blocks}
            document={draft.editorDocument}
            onChange={(document, blocks) =>
              update({
                ...latest.current,
                editorDocument: document,
                blocks: [...blocks, ...latest.current.blocks.filter((b) => b.type === 'quiz')],
              })
            }
          />
          <QuestionAuthor
            questions={questions}
            onChange={(questions) =>
              update({
                ...draft,
                blocks: [
                  ...draft.blocks.filter((b) => b.type !== 'quiz'),
                  {
                    id: draft.blocks.find((b) => b.type === 'quiz')?.id || crypto.randomUUID(),
                    type: 'quiz',
                    questions,
                  },
                ],
              })
            }
          />
        </div>
        <aside className="editor-aside">
          <div className="surface">
            <h2>Tu caja de herramientas</h2>
            <p>
              Escribe <strong>/</strong> en una línea nueva para añadir un bloque.
            </p>
            <div className="tool-list">
              <div className="row">
                <Heading2 size={17} />
                Títulos
              </div>
              <div className="row">
                <Type size={17} />
                Texto
              </div>
              <div className="row">
                <List size={17} />
                Listas
              </div>
              <a href="#preguntas" className="row">
                <HelpCircle size={17} />
                Preguntas
              </a>
            </div>
            <div className="divider" />
            <h2>Un paso a la vez</h2>
            <p>Una explicación breve, un ejemplo cercano y una pregunta para pensar.</p>
            <div className="divider" />
            <p>
              Los cambios se guardan como borrador. La clase ve una versión nueva cuando la
              publicas.
            </p>
          </div>
          <p className="muted" style={{ marginTop: 15, fontSize: 11 }}>
            {live
              ? 'Borrador privado. La clase accede solo al contenido publicado.'
              : 'Edición local con datos de demostración.'}
          </p>
        </aside>
      </div>
      <DialogPanel
        open={publishing}
        onClose={() => setPublishing(false)}
        title="Comparte una nueva experiencia"
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            publish();
          }}
        >
          <Field id="publish-subject" label="Materia">
            <select
              id="publish-subject"
              value={subjectId}
              required
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {state.subjects
                .filter((s) => s.ownerId === user.id && !s.archivedAt)
                .map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name} · {s.course}
                  </option>
                ))}
            </select>
          </Field>
          {questions.length > 0 && (
            <>
              <div className="grid-two">
                <Field id="purpose" label="¿Para qué usarás la actividad?">
                  <select
                    id="purpose"
                    value={settings.purpose}
                    onChange={(e) =>
                      setSettings({
                        ...defaultActivitySettings(
                          new Date().toISOString(),
                          e.target.value as 'practice' | 'exam',
                        ),
                        closesAt: settings.closesAt,
                      })
                    }
                  >
                    <option value="practice">Práctica</option>
                    <option value="exam">Examen</option>
                  </select>
                </Field>
                <Field id="max-grade" label="Nota máxima">
                  <input
                    id="max-grade"
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={settings.maxGrade}
                    onChange={(e) => setSettings({ ...settings, maxGrade: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <Field id="close-date" label="Disponible hasta">
                <input
                  id="close-date"
                  type="datetime-local"
                  required
                  value={localInput(settings.closesAt)}
                  onChange={(e) => {
                    if (e.target.value)
                      setSettings({
                        ...settings,
                        closesAt: new Date(e.target.value).toISOString(),
                      });
                  }}
                />
                <small>
                  Zona de la actividad: {settings.timeZone}. El campo usa la hora de este
                  dispositivo.
                </small>
              </Field>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.countsTowardAverage}
                  onChange={(e) =>
                    setSettings({ ...settings, countsTowardAverage: e.target.checked })
                  }
                />
                Incluir en el promedio de la materia
              </label>
              <details className="advanced">
                <summary>Configuración avanzada</summary>
                <div className="advanced-content stack">
                  <div className="grid-two">
                    <Field id="attempts" label="Intentos por estudiante">
                      <input
                        id="attempts"
                        type="number"
                        disabled={settings.pace === 'guided'}
                        min="1"
                        max="20"
                        value={settings.maxAttempts}
                        onChange={(e) =>
                          setSettings({ ...settings, maxAttempts: Number(e.target.value) })
                        }
                      />
                    </Field>
                    <Field id="time-limit" label="Tiempo en minutos (0 = sin límite)">
                      <input
                        id="time-limit"
                        type="number"
                        min="0"
                        value={settings.timeLimitMinutes || 0}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            timeLimitMinutes: Number(e.target.value) || null,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field id="feedback" label="Cuándo mostrar las respuestas">
                    <select
                      id="feedback"
                      value={settings.feedback}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          feedback: e.target.value as ActivitySettings['feedback'],
                          ...(e.target.value === 'hidden'
                            ? { streaks: false, ranking: false }
                            : {}),
                        })
                      }
                    >
                      <option value="immediate">Después de responder</option>
                      <option value="after-close">Después del cierre y publicación</option>
                      <option value="hidden">Mantener ocultas</option>
                    </select>
                  </Field>
                  <Field id="pace" label="Ritmo de participación">
                    <select
                      id="pace"
                      value={settings.pace}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          pace: e.target.value as ActivitySettings['pace'],
                          ...(e.target.value === 'guided'
                            ? { maxAttempts: 1, shuffleQuestions: false }
                            : {}),
                        })
                      }
                    >
                      <option value="individual">Cada estudiante a su ritmo</option>
                      <option value="guided">Guiado por el docente</option>
                    </select>
                  </Field>
                  <Field id="weight" label="Peso en el promedio">
                    <input
                      id="weight"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={settings.weight}
                      onChange={(e) => setSettings({ ...settings, weight: Number(e.target.value) })}
                    />
                  </Field>
                  {(
                    [
                      ['shuffleQuestions', 'Mezclar preguntas'],
                      ['shuffleOptions', 'Mezclar opciones'],
                      ['manualCorrection', 'Revisar también las respuestas cerradas'],
                      ['allowHint', 'Permitir una pista durante la actividad'],
                      ['allowDouble', 'Permitir un doble durante la actividad'],
                      ['streaks', 'Mostrar rachas de aciertos cuando la corrección sea visible'],
                      ['sound', 'Permitir sonidos que cada estudiante puede desactivar'],
                      ['teams', 'Participar por equipos (se configuran antes de empezar)'],
                      ['ranking', 'Compartir clasificación con alias'],
                      [
                        'reportVisibility',
                        'Informar cambios de visibilidad de la pestaña, sin sanción automática',
                      ],
                      [
                        'bonusAffectsGrade',
                        'Incluir bonificación en la nota, sin superar el máximo',
                      ],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="checkbox-label" key={key}>
                      <input
                        type="checkbox"
                        disabled={
                          (key === 'shuffleQuestions' && settings.pace === 'guided') ||
                          ((key === 'ranking' || key === 'streaks') &&
                            settings.feedback === 'hidden')
                        }
                        checked={settings[key]}
                        onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </details>
            </>
          )}
          {!questions.length && (
            <p className="notice">
              Se compartirá como lectura. No genera intentos ni calificación.
            </p>
          )}
          <div className="notice">
            <strong>{draft.title}</strong>
            {questions.length > 0 && (
              <p>
                {questions.length} preguntas · {settings.maxAttempts}{' '}
                {settings.maxAttempts === 1 ? 'intento' : 'intentos'} · {settings.maxGrade} puntos
                de nota máxima.
              </p>
            )}
            <p>
              Las respuestas escritas quedan para tu revisión. Publicar crea una versión
              independiente del borrador.
            </p>
          </div>
          <div className="dialog-actions">
            <Button variant="secondary" onPress={() => setPublishing(false)}>
              Seguir editando
            </Button>
            <Button
              type="submit"
              isDisabled={!subjectId || publishPending || (!questions.length && !live)}
            >
              Publicar en la materia
            </Button>
          </div>
        </form>
      </DialogPanel>
    </>
  );
}
function localInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
