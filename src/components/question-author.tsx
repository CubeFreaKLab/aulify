'use client';
import { Plus, Trash2, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { Button, Field, DialogPanel } from './ui';
import { useState } from 'react';
import type { Question } from '@/domain/types';
import { validateQuestion } from '@/domain';
import { blankIds } from '@/lib/rich-document';
import '@/styles/rich-editor.css';

export const questionNames: Record<Question['type'], string> = {
  single: 'Una respuesta',
  multiple: 'Varias respuestas',
  'true-false': 'Verdadero o falso',
  matching: 'Relacionar',
  ordering: 'Ordenar',
  'fill-options': 'Completar con opciones',
  'fill-text': 'Completar escribiendo',
  open: 'Respuesta abierta',
};
function newQuestion(type: Question['type']): Question {
  const base = { id: crypto.randomUUID(), prompt: '', points: 1, explanation: '', hint: '' };
  const blankId = crypto.randomUUID();
  const options = [
    { id: crypto.randomUUID(), text: '' },
    { id: crypto.randomUUID(), text: '' },
  ];
  if (type === 'single') return { ...base, type, options, correctOptionId: options[0].id };
  if (type === 'multiple') return { ...base, type, options, correctOptionIds: [options[0].id] };
  if (type === 'true-false') return { ...base, type, correct: true };
  if (type === 'open') return { ...base, type, manual: true, manualGuide: '' };
  if (type === 'fill-text')
    return {
      ...base,
      type,
      manual: true,
      template: `Completa la frase: {${blankId}}`,
      blanks: [{ id: blankId, label: 'Palabra' }],
      manualGuide: '',
    };
  if (type === 'fill-options')
    return {
      ...base,
      type,
      template: `Completa la frase: {${blankId}}`,
      blanks: [{ id: blankId, options, correctOptionId: options[0].id }],
    };
  if (type === 'matching') {
    const right = options.map(() => ({ id: crypto.randomUUID(), text: '' }));
    return {
      ...base,
      type,
      left: options,
      right,
      pairs: Object.fromEntries(options.map((option, i) => [option.id, right[i].id])),
    };
  }
  return { ...base, type: 'ordering', items: options, correctOrder: options.map((o) => o.id) };
}
function cloneQuestion(question: Question): Question {
  const ids = new Map<string, string>();
  function collect(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if ('id' in value && typeof value.id === 'string' && /^[0-9a-f-]{36}$/i.test(value.id))
      ids.set(value.id, crypto.randomUUID());
    Object.values(value).forEach(collect);
  }
  collect(question);
  function replace(value: unknown): unknown {
    if (typeof value === 'string') return ids.get(value) || value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [ids.get(key) || key, replace(entry)]),
      );
    return value;
  }
  return { ...(replace(question) as Question), id: crypto.randomUUID() };
}
export function QuestionAuthor({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}) {
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const groups = [...new Set(questions.map((q) => q.groupId).filter((id): id is string => !!id))];
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const update = (question: Question) =>
    onChange(questions.map((q) => (q.id === question.id ? question : q)));
  const move = (i: number, d: number) => {
    const next = [...questions];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <section className="quiz-block" id="preguntas" aria-label="Preguntas del recurso">
      <div className="row between">
        <div>
          <h2>Preguntas del recurso</h2>
        </div>
        <span className="badge">{questions.length} preguntas</span>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 9 }}>
        Combina preguntas. Las respuestas escritas las revisas tú.
      </p>
      {questions.map((q, i) => (
        <div className="question-author" key={q.id}>
          <div className="row between question-author-heading">
            <button
              className="button ghost small"
              type="button"
              style={{ paddingLeft: 0, textAlign: 'left', justifyContent: 'start' }}
              aria-expanded={editing === q.id}
              aria-controls={`question-fields-${q.id}`}
              onClick={() => {
                setEditing(editing === q.id ? null : q.id);
                setError(null);
              }}
            >
              {i + 1}. {q.prompt || questionNames[q.type]}
            </button>
            <div className="row" style={{ gap: 0 }}>
              <button
                type="button"
                className="icon-button"
                disabled={i === 0}
                aria-label={`Subir pregunta ${i + 1}`}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={i === questions.length - 1}
                aria-label={`Bajar pregunta ${i + 1}`}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={questions.length >= 100}
                aria-label={`Duplicar pregunta ${i + 1}`}
                onClick={() => {
                  const next = cloneQuestion(q);
                  onChange([...questions.slice(0, i + 1), next, ...questions.slice(i + 1)]);
                  setEditing(next.id);
                }}
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Eliminar pregunta ${i + 1}`}
                onClick={() => onChange(questions.filter((item) => item.id !== q.id))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 11 }}>
            {questionNames[q.type]} · {q.points} puntos {q.manual ? '· Revisión manual' : ''}
          </div>
          {editing === q.id && (
            <div id={`question-fields-${q.id}`} style={{ marginTop: 18 }}>
              <Field id={`prompt-${q.id}`} label="Pregunta">
                <textarea
                  id={`prompt-${q.id}`}
                  value={q.prompt}
                  onChange={(e) => update({ ...q, prompt: e.target.value })}
                  placeholder="¿Qué quieres preguntar?"
                />
              </Field>
              <div className="grid-two">
                <Field id={`points-${q.id}`} label="Valor en puntos">
                  <input
                    id={`points-${q.id}`}
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={q.points}
                    onChange={(e) => update({ ...q, points: Number(e.target.value) })}
                  />
                </Field>
                <Field id={`hint-${q.id}`} label="Pista (opcional)">
                  <input
                    id={`hint-${q.id}`}
                    value={q.hint || ''}
                    onChange={(e) => update({ ...q, hint: e.target.value })}
                  />
                </Field>
              </div>
              <Field
                id={`group-${q.id}`}
                label="Grupo de preguntas"
                hint="Las preguntas del mismo grupo conservan su orden interno cuando se mezclan. Úsalo si comparten una lectura o dependen unas de otras."
              >
                <select
                  id={`group-${q.id}`}
                  value={q.groupId || ''}
                  aria-describedby={`group-${q.id}-hint`}
                  onChange={(e) =>
                    update({
                      ...q,
                      groupId:
                        e.target.value === 'new'
                          ? crypto.randomUUID()
                          : e.target.value || undefined,
                    })
                  }
                >
                  <option value="">Pregunta independiente</option>
                  {groups.map((id, index) => (
                    <option key={id} value={id}>
                      Grupo {index + 1}
                    </option>
                  ))}
                  <option value="new">Crear otro grupo</option>
                </select>
              </Field>
              <QuestionDetails question={q} update={update} />
              {q.type !== 'open' && q.type !== 'fill-text' && (
                <label className="row" style={{ gap: 8, margin: '16px 0' }}>
                  <input
                    type="checkbox"
                    checked={!!q.manual}
                    onChange={(e) => update({ ...q, manual: e.target.checked })}
                  />{' '}
                  Revisar esta respuesta manualmente
                </label>
              )}
              {(q.type === 'open' || q.type === 'fill-text' || q.manual) && (
                <div className="question-private-guide">
                  <Field
                    id={`guide-${q.id}`}
                    label="Guía de corrección (solo docente)"
                    hint="Obligatoria para respuestas escritas. Describe qué debe incluir la respuesta y cómo repartir los puntos; no se muestra al estudiante."
                  >
                    <textarea
                      id={`guide-${q.id}`}
                      value={q.manualGuide || ''}
                      aria-describedby={`guide-${q.id}-hint`}
                      onChange={(e) => update({ ...q, manualGuide: e.target.value })}
                      placeholder="Respuesta esperada y criterios para dar puntos parciales…"
                    />
                  </Field>
                </div>
              )}
              <Field
                id={`explanation-${q.id}`}
                label="Explicación de la respuesta (opcional)"
                hint="Se muestra según la retroalimentación configurada para la actividad."
              >
                <textarea
                  id={`explanation-${q.id}`}
                  value={q.explanation || ''}
                  onChange={(e) => update({ ...q, explanation: e.target.value })}
                />
              </Field>
              {error?.id === q.id && (
                <p role="alert" className="question-author-error">
                  {error.message}
                </p>
              )}
              <Button
                variant="secondary small"
                onPress={() => {
                  try {
                    validateQuestion(q);
                    if (
                      (q.type === 'fill-text' || q.type === 'fill-options') &&
                      blankIds(q.template).join('|') !== q.blanks.map((b) => b.id).join('|')
                    )
                      throw new Error('Actualiza los espacios para que coincidan con la frase.');
                    if (
                      (q.type === 'open' || q.type === 'fill-text' || q.manual) &&
                      !q.manualGuide?.trim()
                    )
                      throw new Error('Añade una guía privada para corregir la respuesta.');
                    setError(null);
                    setEditing(null);
                  } catch (cause) {
                    setError({
                      id: q.id,
                      message: cause instanceof Error ? cause.message : 'Revisa esta pregunta.',
                    });
                  }
                }}
              >
                Listo
              </Button>
            </div>
          )}
        </div>
      ))}
      <Button
        variant="secondary"
        style={{ marginTop: 18 }}
        isDisabled={questions.length >= 100}
        onPress={() => setAdding(true)}
      >
        <Plus size={17} /> Añadir pregunta
      </Button>
      <DialogPanel
        open={adding}
        onClose={() => setAdding(false)}
        title="¿Cómo participará tu clase?"
      >
        <div className="question-type-grid">
          {Object.entries(questionNames).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                const q = newQuestion(type as Question['type']);
                onChange([...questions, q]);
                setEditing(q.id);
                setAdding(false);
              }}
            >
              <Plus size={16} />
              {label}
            </button>
          ))}
        </div>
      </DialogPanel>
    </section>
  );
}
function QuestionDetails({
  question: q,
  update,
}: {
  question: Question;
  update: (q: Question) => void;
}) {
  if (q.type === 'single' || q.type === 'multiple')
    return (
      <fieldset style={{ border: 0, padding: 0, margin: '14px 0' }}>
        <legend className="field-label">Opciones · marca la respuesta correcta</legend>
        {q.options.map((o, i) => (
          <div className="option-editor" key={o.id}>
            <input
              type={q.type === 'single' ? 'radio' : 'checkbox'}
              name={`correct-${q.id}`}
              aria-label={`Opción ${i + 1} correcta`}
              checked={
                q.type === 'single' ? q.correctOptionId === o.id : q.correctOptionIds.includes(o.id)
              }
              onChange={() =>
                update(
                  q.type === 'single'
                    ? { ...q, correctOptionId: o.id }
                    : {
                        ...q,
                        correctOptionIds: q.correctOptionIds.includes(o.id)
                          ? q.correctOptionIds.filter((id) => id !== o.id)
                          : [...q.correctOptionIds, o.id],
                      },
                )
              }
            />
            <input
              type="text"
              aria-label={`Texto de opción ${i + 1}`}
              value={o.text}
              placeholder={`Opción ${i + 1}`}
              onChange={(e) =>
                update({
                  ...q,
                  options: q.options.map((v) =>
                    v.id === o.id ? { ...v, text: e.target.value } : v,
                  ),
                })
              }
            />
            <button
              type="button"
              className="icon-button"
              style={{ width: 32 }}
              aria-label={`Eliminar opción ${i + 1}`}
              disabled={q.options.length <= 2}
              onClick={() => {
                const options = q.options.filter((v) => v.id !== o.id);
                update(
                  q.type === 'single'
                    ? {
                        ...q,
                        options,
                        correctOptionId:
                          q.correctOptionId === o.id ? options[0].id : q.correctOptionId,
                      }
                    : {
                        ...q,
                        options,
                        correctOptionIds: q.correctOptionIds.filter((id) => id !== o.id),
                      },
                );
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Button
          variant="ghost small"
          isDisabled={q.options.length >= 8}
          onPress={() =>
            update({ ...q, options: [...q.options, { id: crypto.randomUUID(), text: '' }] })
          }
        >
          <Plus size={14} />
          Otra opción
        </Button>
      </fieldset>
    );
  if (q.type === 'true-false')
    return (
      <Field id={`correct-${q.id}`} label="Respuesta correcta">
        <select
          id={`correct-${q.id}`}
          value={String(q.correct)}
          onChange={(e) => update({ ...q, correct: e.target.value === 'true' })}
        >
          <option value="true">Verdadero</option>
          <option value="false">Falso</option>
        </select>
      </Field>
    );
  if (q.type === 'matching')
    return (
      <div className="stack" style={{ gap: 9, margin: '16px 0' }}>
        <p className="field-label">Parejas correctas</p>
        {q.left.map((left, i) => (
          <div key={left.id} className="author-pair">
            <input
              className="input"
              aria-label={`Elemento ${i + 1}`}
              value={left.text}
              onChange={(e) =>
                update({
                  ...q,
                  left: q.left.map((v) => (v.id === left.id ? { ...v, text: e.target.value } : v)),
                })
              }
            />
            <input
              className="input"
              aria-label={`Relación correcta ${i + 1}`}
              value={q.right.find((v) => v.id === q.pairs[left.id])?.text || ''}
              onChange={(e) =>
                update({
                  ...q,
                  right: q.right.map((v) =>
                    v.id === q.pairs[left.id] ? { ...v, text: e.target.value } : v,
                  ),
                })
              }
            />
            <button
              type="button"
              className="icon-button"
              disabled={q.left.length <= 2}
              aria-label={`Eliminar pareja ${i + 1}`}
              onClick={() => {
                const pairs = { ...q.pairs };
                delete pairs[left.id];
                update({
                  ...q,
                  left: q.left.filter((v) => v.id !== left.id),
                  right: q.right.filter((v) => v.id !== q.pairs[left.id]),
                  pairs,
                });
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <Button
          variant="ghost small"
          isDisabled={q.left.length >= 12}
          onPress={() => {
            const a = crypto.randomUUID(),
              b = crypto.randomUUID();
            update({
              ...q,
              left: [...q.left, { id: a, text: '' }],
              right: [...q.right, { id: b, text: '' }],
              pairs: { ...q.pairs, [a]: b },
            });
          }}
        >
          Añadir pareja
        </Button>
      </div>
    );
  if (q.type === 'ordering')
    return (
      <div className="stack" style={{ gap: 9, margin: '16px 0' }}>
        <p className="field-label">Orden correcto de los elementos</p>
        {q.correctOrder.map((id, i) => (
          <div className="author-item-row" key={id}>
            <input
              className="input"
              aria-label={`Elemento en posición ${i + 1}`}
              value={q.items.find((v) => v.id === id)?.text || ''}
              onChange={(e) =>
                update({
                  ...q,
                  items: q.items.map((v) => (v.id === id ? { ...v, text: e.target.value } : v)),
                })
              }
            />
            <button
              type="button"
              className="icon-button"
              disabled={i === 0}
              aria-label={`Adelantar elemento ${i + 1}`}
              onClick={() => {
                const order = [...q.correctOrder];
                [order[i - 1], order[i]] = [order[i], order[i - 1]];
                update({ ...q, correctOrder: order });
              }}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              disabled={i === q.correctOrder.length - 1}
              aria-label={`Atrasar elemento ${i + 1}`}
              onClick={() => {
                const order = [...q.correctOrder];
                [order[i + 1], order[i]] = [order[i], order[i + 1]];
                update({ ...q, correctOrder: order });
              }}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              disabled={q.items.length <= 2}
              aria-label={`Eliminar elemento ${i + 1}`}
              onClick={() =>
                update({
                  ...q,
                  items: q.items.filter((v) => v.id !== id),
                  correctOrder: q.correctOrder.filter((v) => v !== id),
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <Button
          variant="ghost small"
          isDisabled={q.items.length >= 12}
          onPress={() => {
            const id = crypto.randomUUID();
            update({
              ...q,
              items: [...q.items, { id, text: '' }],
              correctOrder: [...q.correctOrder, id],
            });
          }}
        >
          Añadir elemento
        </Button>
      </div>
    );
  if (q.type === 'fill-text' || q.type === 'fill-options') {
    const ids = blankIds(q.template);
    const synced = ids.join('|') === q.blanks.map((b) => b.id).join('|');
    const readable = q.blanks.reduce(
      (text, blank, i) => text.replaceAll(`{${blank.id}}`, `{espacio_${i + 1}}`),
      q.template,
    );
    return (
      <div style={{ margin: '16px 0' }}>
        <Field
          id={`template-${q.id}`}
          label="Frase con espacios"
          hint="Escribe espacios distintos entre llaves, como {palabra} y {lugar}. Luego actualiza los espacios para configurar cada uno."
        >
          <textarea
            id={`template-${q.id}`}
            value={readable}
            onChange={(e) =>
              update({
                ...q,
                template: q.blanks.reduce(
                  (text, blank, i) => text.replaceAll(`{espacio_${i + 1}}`, `{${blank.id}}`),
                  e.target.value,
                ),
              })
            }
          />
        </Field>
        <Button
          variant="secondary small"
          isDisabled={!ids.length || ids.length > 10}
          onPress={() => {
            const idMap = new Map(
              ids.map((id) => [id, /^[0-9a-f-]{36}$/i.test(id) ? id : crypto.randomUUID()]),
            );
            const template = ids.reduce(
              (text, id) => text.replaceAll(`{${id}}`, `{${idMap.get(id)}}`),
              q.template,
            );
            if (q.type === 'fill-text')
              update({
                ...q,
                template,
                blanks: ids.map((id, i) => ({
                  ...q.blanks.find((b) => b.id === id),
                  id: idMap.get(id)!,
                  label: q.blanks.find((b) => b.id === id)?.label || `Espacio ${i + 1}`,
                })),
              });
            else
              update({
                ...q,
                template,
                blanks: ids.map((id) => {
                  const old = q.blanks.find((b) => b.id === id);
                  if (old) return { ...old, id: idMap.get(id)! };
                  const options = [
                    { id: crypto.randomUUID(), text: '' },
                    { id: crypto.randomUUID(), text: '' },
                  ];
                  return { id: idMap.get(id)!, options, correctOptionId: options[0].id };
                }),
              });
          }}
        >
          Actualizar espacios
        </Button>
        {!synced && (
          <p className="question-author-error" role="status">
            La frase cambió. Actualiza los espacios antes de terminar.
          </p>
        )}
        {(!ids.length || ids.length > 10) && (
          <p className="question-author-error">Incluye entre uno y diez espacios diferentes.</p>
        )}
        {q.type === 'fill-text'
          ? q.blanks.map((blank, i) => (
              <Field
                key={blank.id}
                id={`blank-${q.id}-${blank.id}`}
                label={`Nombre del espacio ${i + 1}`}
              >
                <input
                  id={`blank-${q.id}-${blank.id}`}
                  value={blank.label}
                  onChange={(e) =>
                    update({
                      ...q,
                      blanks: q.blanks.map((b) =>
                        b.id === blank.id ? { ...b, label: e.target.value } : b,
                      ),
                    })
                  }
                />
              </Field>
            ))
          : q.blanks.map((blank, i) => (
              <fieldset key={blank.id} style={{ border: 0, padding: 0, margin: '20px 0' }}>
                <legend className="field-label">
                  Espacio {i + 1}: {'{espacio_' + (i + 1) + '}'}
                </legend>
                {blank.options.map((option, j) => (
                  <div key={option.id} className="option-editor">
                    <input
                      type="radio"
                      name={`${q.id}-${blank.id}`}
                      aria-label={`Palabra ${j + 1} correcta del espacio ${i + 1}`}
                      checked={blank.correctOptionId === option.id}
                      onChange={() =>
                        update({
                          ...q,
                          blanks: q.blanks.map((b) =>
                            b.id === blank.id ? { ...b, correctOptionId: option.id } : b,
                          ),
                        })
                      }
                    />
                    <input
                      type="text"
                      aria-label={`Palabra ${j + 1} del espacio ${i + 1}`}
                      value={option.text}
                      onChange={(e) =>
                        update({
                          ...q,
                          blanks: q.blanks.map((b) =>
                            b.id === blank.id
                              ? {
                                  ...b,
                                  options: b.options.map((o) =>
                                    o.id === option.id ? { ...o, text: e.target.value } : o,
                                  ),
                                }
                              : b,
                          ),
                        })
                      }
                    />
                    <button
                      className="icon-button"
                      type="button"
                      disabled={blank.options.length <= 2}
                      aria-label={`Eliminar palabra ${j + 1} del espacio ${i + 1}`}
                      onClick={() => {
                        const options = blank.options.filter((o) => o.id !== option.id);
                        update({
                          ...q,
                          blanks: q.blanks.map((b) =>
                            b.id === blank.id
                              ? {
                                  ...b,
                                  options,
                                  correctOptionId:
                                    b.correctOptionId === option.id
                                      ? options[0].id
                                      : b.correctOptionId,
                                }
                              : b,
                          ),
                        });
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost small"
                  isDisabled={blank.options.length >= 8}
                  onPress={() =>
                    update({
                      ...q,
                      blanks: q.blanks.map((b) =>
                        b.id === blank.id
                          ? { ...b, options: [...b.options, { id: crypto.randomUUID(), text: '' }] }
                          : b,
                      ),
                    })
                  }
                >
                  Otra opción para el espacio {i + 1}
                </Button>
              </fieldset>
            ))}
      </div>
    );
  }
  return (
    <p className="notice" style={{ margin: '15px 0' }}>
      La respuesta escrita se revisará manualmente con la guía que definas.
    </p>
  );
}
