'use client';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button, Field, DialogPanel } from './ui';
import { useState } from 'react';
import type { Question } from '@/domain/types';

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
      template: 'Completa la frase: {palabra}',
      blanks: [{ id: 'palabra', label: 'Palabra' }],
      manualGuide: '',
    };
  if (type === 'fill-options')
    return {
      ...base,
      type,
      template: 'Completa la frase: {palabra}',
      blanks: [{ id: 'palabra', options, correctOptionId: options[0].id }],
    };
  if (type === 'matching')
    return {
      ...base,
      type,
      left: [
        { id: 'a', text: 'Elemento A' },
        { id: 'b', text: 'Elemento B' },
      ],
      right: [
        { id: 'one', text: 'Relación A' },
        { id: 'two', text: 'Relación B' },
      ],
      pairs: { a: 'one', b: 'two' },
    };
  return { ...base, type: 'ordering', items: options, correctOrder: options.map((o) => o.id) };
}
export function QuestionAuthor({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}) {
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
          <div className="eyebrow">Participación</div>
          <h2>Tu clase también responde.</h2>
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
              onClick={() => setEditing(editing === q.id ? null : q.id)}
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
            <div style={{ marginTop: 18 }}>
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
              <QuestionDetails question={q} update={update} />
              <Field
                id={`explanation-${q.id}`}
                label={
                  q.manual ? 'Guía de corrección (solo docente)' : 'Explicación de la respuesta'
                }
              >
                <textarea
                  id={`explanation-${q.id}`}
                  value={(q.manual ? q.manualGuide : q.explanation) || ''}
                  onChange={(e) =>
                    update(
                      q.manual
                        ? { ...q, manualGuide: e.target.value }
                        : { ...q, explanation: e.target.value },
                    )
                  }
                />
              </Field>
              <Button variant="secondary small" onPress={() => setEditing(null)}>
                Listo
              </Button>
            </div>
          )}
        </div>
      ))}
      <Button variant="secondary" style={{ marginTop: 18 }} onPress={() => setAdding(true)}>
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
        {q.left.map((l, i) => (
          <div key={l.id} className="grid-two">
            <input
              className="input"
              aria-label={`Elemento ${i + 1}`}
              value={l.text}
              onChange={(e) =>
                update({
                  ...q,
                  left: q.left.map((v) => (v.id === l.id ? { ...v, text: e.target.value } : v)),
                })
              }
            />
            <input
              className="input"
              aria-label={`Relación correcta ${i + 1}`}
              value={q.right.find((r) => r.id === q.pairs[l.id])?.text || ''}
              onChange={(e) =>
                update({
                  ...q,
                  right: q.right.map((v) =>
                    v.id === q.pairs[l.id] ? { ...v, text: e.target.value } : v,
                  ),
                })
              }
            />
          </div>
        ))}
        <Button
          variant="ghost small"
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
        <p className="field-label">Escribe los elementos en el orden correcto</p>
        {q.correctOrder.map((id, i) => (
          <input
            key={id}
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
        ))}
        <Button
          variant="ghost small"
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
  if (q.type === 'fill-text' || q.type === 'fill-options')
    return (
      <div style={{ margin: '16px 0' }}>
        <Field
          id={`template-${q.id}`}
          label="Frase con espacios"
          hint="Identifica cada espacio entre llaves, por ejemplo {palabra}."
        >
          <textarea
            id={`template-${q.id}`}
            value={q.template}
            onChange={(e) => update({ ...q, template: e.target.value })}
          />
        </Field>
        {q.blanks.map((blank, i) => (
          <div key={blank.id} style={{ marginTop: 10 }}>
            <p className="field-label">
              Espacio {i + 1}: {'{' + blank.id + '}'}
            </p>
            {q.type === 'fill-options' &&
              'options' in blank &&
              blank.options.map((option, j) => (
                <div key={option.id} className="option-editor">
                  <input
                    type="radio"
                    name={`${q.id}-${blank.id}`}
                    aria-label={`Palabra ${j + 1} correcta`}
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
                </div>
              ))}
          </div>
        ))}
      </div>
    );
  return (
    <p className="notice" style={{ margin: '15px 0' }}>
      La respuesta se calificará manualmente.
    </p>
  );
}
