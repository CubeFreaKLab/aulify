'use client';
import { useState } from 'react';
import { ArrowUp, ArrowDown, Check, ListOrdered, Link2 } from 'lucide-react';
import type { AnswerValue, StudentQuestion } from '@/domain/types';

export function QuestionInput({
  question,
  onChange,
  value,
  disabled = false,
}: {
  question: StudentQuestion;
  onChange: (value: AnswerValue) => void;
  value?: AnswerValue;
  disabled?: boolean;
}) {
  const [order, setOrder] = useState(() =>
    question.type === 'ordering' ? question.items.map((i) => i.id) : [],
  );
  const move = (index: number, delta: number) => {
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setOrder(next);
    onChange({ type: 'ordering', itemIds: next });
  };
  if (question.type === 'single' || question.type === 'multiple')
    return (
      <fieldset className="answer-options" disabled={disabled}>
        <legend className="sr-only">
          Elige{' '}
          {question.type === 'multiple' ? 'todas las respuestas que correspondan' : 'una respuesta'}
        </legend>
        {question.options.map((option, i) => {
          const selected =
            value?.type === 'single'
              ? value.optionId === option.id
              : value?.type === 'multiple'
                ? value.optionIds.includes(option.id)
                : false;
          return (
            <label className={`answer-option ${selected ? 'selected' : ''}`} key={option.id}>
              <input
                type={question.type === 'multiple' ? 'checkbox' : 'radio'}
                name={question.id}
                checked={selected}
                onChange={() =>
                  onChange(
                    question.type === 'multiple'
                      ? {
                          type: 'multiple',
                          optionIds: selected
                            ? value?.type === 'multiple'
                              ? value.optionIds.filter((id) => id !== option.id)
                              : []
                            : [...(value?.type === 'multiple' ? value.optionIds : []), option.id],
                        }
                      : { type: 'single', optionId: option.id },
                  )
                }
              />
              <span className="option-letter">
                {selected ? <Check size={18} /> : String.fromCharCode(65 + i)}
              </span>
              <span>{option.text}</span>
            </label>
          );
        })}
      </fieldset>
    );
  if (question.type === 'true-false')
    return (
      <fieldset className="answer-options" disabled={disabled}>
        <legend className="sr-only">Elige verdadero o falso</legend>
        {[true, false].map((v) => (
          <label
            key={String(v)}
            className={`answer-option ${value?.type === 'true-false' && value.value === v ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name={question.id}
              checked={value?.type === 'true-false' && value.value === v}
              onChange={() => onChange({ type: 'true-false', value: v })}
            />
            <span className="option-letter">{v ? 'V' : 'F'}</span>
            <span>{v ? 'Verdadero' : 'Falso'}</span>
          </label>
        ))}
      </fieldset>
    );
  if (question.type === 'open')
    return (
      <div className="field">
        <label htmlFor={`answer-${question.id}`}>Tu respuesta</label>
        <textarea
          id={`answer-${question.id}`}
          rows={6}
          maxLength={5000}
          disabled={disabled}
          value={value?.type === 'open' ? value.text : ''}
          onChange={(e) => onChange({ type: 'open', text: e.target.value })}
          placeholder="Explica con tus palabras…"
        />
        <small>Tu docente revisará esta respuesta.</small>
      </div>
    );
  if (question.type === 'matching')
    return (
      <div className="match-items">
        {question.left.map((item) => (
          <div className="match-row" key={item.id}>
            <span>{item.text}</span>
            <Link2 size={17} aria-hidden="true" />
            <select
              className="input"
              aria-label={`Relacionar ${item.text}`}
              disabled={disabled}
              value={value?.type === 'matching' ? value.pairs[item.id] || '' : ''}
              onChange={(e) =>
                onChange({
                  type: 'matching',
                  pairs: {
                    ...(value?.type === 'matching' ? value.pairs : {}),
                    [item.id]: e.target.value,
                  },
                })
              }
            >
              <option value="">Elegir relación</option>
              {question.right.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.text}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  if (question.type === 'ordering')
    return (
      <div className="ordering-items">
        <p className="muted">
          <ListOrdered size={15} /> Usa las flechas para ordenar la secuencia.
        </p>
        {order.map((id, i) => (
          <div className="ordering-row" key={id}>
            <span className="option-letter">{i + 1}</span>
            <span>{question.items.find((item) => item.id === id)?.text}</span>
            <div className="row">
              <button
                type="button"
                className="icon-button"
                disabled={disabled || i === 0}
                aria-label={`Subir ${question.items.find((item) => item.id === id)?.text}`}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={disabled || i === order.length - 1}
                aria-label={`Bajar ${question.items.find((item) => item.id === id)?.text}`}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={17} />
              </button>
            </div>
          </div>
        ))}
        {!value && (
          <button
            className="button secondary small"
            type="button"
            onClick={() => onChange({ type: 'ordering', itemIds: order })}
          >
            Mantener este orden
          </button>
        )}
      </div>
    );
  if (question.type === 'fill-options')
    return (
      <div className="stack">
        <p className="fill-template">{question.template}</p>
        {question.blanks.map((blank, i) => (
          <div className="field" key={blank.id}>
            <label htmlFor={`${question.id}-${blank.id}`}>Espacio {i + 1}</label>
            <select
              id={`${question.id}-${blank.id}`}
              disabled={disabled}
              value={value?.type === 'fill-options' ? value.choices[blank.id] || '' : ''}
              onChange={(e) =>
                onChange({
                  type: 'fill-options',
                  choices: {
                    ...(value?.type === 'fill-options' ? value.choices : {}),
                    [blank.id]: e.target.value,
                  },
                })
              }
            >
              <option value="">Elige una palabra</option>
              {blank.options.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.text}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  if (question.type === 'fill-text')
    return (
      <div className="stack">
        <p className="fill-template">{question.template}</p>
        {question.blanks.map((blank, i) => (
          <div className="field" key={blank.id}>
            <label htmlFor={`${question.id}-${blank.id}`}>
              {blank.label || `Espacio ${i + 1}`}
            </label>
            <input
              id={`${question.id}-${blank.id}`}
              maxLength={5000}
              disabled={disabled}
              value={value?.type === 'fill-text' ? value.texts[blank.id] || '' : ''}
              onChange={(e) =>
                onChange({
                  type: 'fill-text',
                  texts: {
                    ...(value?.type === 'fill-text' ? value.texts : {}),
                    [blank.id]: e.target.value,
                  },
                })
              }
            />
          </div>
        ))}
        <p className="muted">Las palabras escritas requieren revisión de tu docente.</p>
      </div>
    );
  return null;
}
