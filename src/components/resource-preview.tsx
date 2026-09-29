'use client';
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from './workspace-link';
import { ArrowRight, ImageOff } from 'lucide-react';
import { DialogPanel, Button } from './ui';
import { questionsOf, safeImageUrl, type Resource } from '@/domain';
import '@/styles/library.css';

/** The sample uses the resource itself, without decorative covers or answer keys. */
export function ResourceSample({
  resource,
  expanded = false,
}: {
  resource: Resource;
  expanded?: boolean;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = resource.blocks.find((block) => block.type === 'image' && safeImageUrl(block.url));
  const heading = resource.blocks.find((block) => block.type === 'heading');
  const text = resource.blocks.find((block) => block.type === 'text' && block.text.trim());
  const list = resource.blocks.find((block) => block.type === 'list');
  const video = resource.blocks.find((block) => block.type === 'video');
  const question = questionsOf(resource)[0];
  const isQuestion = resource.kind === 'quiz' || (!text && !image && !heading && question);
  if (isQuestion && question) {
    const options =
      question.type === 'single' || question.type === 'multiple'
        ? question.options.map((option) => option.text)
        : question.type === 'true-false'
          ? ['Verdadero', 'Falso']
          : [];
    return (
      <div className="resource-sample-text resource-sample-question">
        <p className="resource-sample-label">Primera pregunta</p>
        <p className="resource-sample-prompt">{question.prompt}</p>
        {options.length > 0 && (
          <ul className="resource-sample-options">
            {options.slice(0, expanded ? 6 : 3).map((option, index) => (
              <li key={index}>
                <span aria-hidden="true" />
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className={`resource-sample-content${expanded ? ' expanded' : ''}`}>
      {image?.type === 'image' && failedImage !== image.url ? (
        <img
          className="resource-sample-image"
          src={image.url}
          alt={image.alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedImage(image.url)}
        />
      ) : (
        image && (
          <p className="resource-sample-unavailable">
            <ImageOff size={18} aria-hidden="true" />
            Imagen no disponible
          </p>
        )
      )}
      {(expanded || !image) && (
        <div className="resource-sample-text">
          {heading?.type === 'heading' && <p className="resource-sample-heading">{heading.text}</p>}
          {text?.type === 'text' && <p className="resource-sample-excerpt">{text.text}</p>}
          {!text && list?.type === 'list' && (
            <ul className="resource-sample-list">
              {list.items.slice(0, expanded ? 5 : 3).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
          {!text && !list && video?.type === 'video' && (
            <>
              <p className="resource-sample-label">Video de clase</p>
              <p>{video.title}</p>
            </>
          )}
          {!heading && !text && !list && !image && !video && (
            <p className="resource-sample-empty">Este recurso todavía no tiene contenido.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ResourcePreview({ resource }: { resource: Resource }) {
  const [open, setOpen] = useState(false);
  const questionCount = questionsOf(resource).length;
  const button = useRef<HTMLDivElement>(null);
  function toggle(next: boolean) {
    const card = button.current?.closest<HTMLElement>('.library-item');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (card) card.style.viewTransitionName = next ? 'resource-preview' : 'none';
    if (!document.startViewTransition || reduced) {
      setOpen(next);
      if (card) card.style.viewTransitionName = 'none';
      return;
    }
    const transition = document.startViewTransition(() => {
      if (card) card.style.viewTransitionName = next ? 'none' : 'resource-preview';
      flushSync(() => setOpen(next));
    });
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (card) card.style.viewTransitionName = 'none';
      });
  }
  return (
    <>
      <div ref={button}>
        <Button variant="ghost small" onPress={() => toggle(true)}>
          Vista previa
        </Button>
      </div>
      <DialogPanel open={open} onClose={() => toggle(false)} title="Vista previa">
        <div
          className="resource-preview-content"
          style={{ viewTransitionName: open ? 'resource-preview' : undefined }}
        >
          <div className="resource-preview-heading">
            <p className="muted">
              {resource.kind === 'quiz' ? 'Quiz' : 'Recurso de clase'} ·{' '}
              {questionCount
                ? `${questionCount} ${questionCount === 1 ? 'pregunta' : 'preguntas'}`
                : 'Solo lectura'}
            </p>
            <h3>{resource.title}</h3>
          </div>
          <ResourceSample resource={resource} expanded />
          <div className="resource-preview-footer">
            <p className="muted">
              Estás viendo el borrador. La vista previa no publica cambios ni registra respuestas.
            </p>
            <Link
              href={`/demo/previa/${resource.id}`}
              className="button"
              onClick={() => setOpen(false)}
            >
              Explorar el recurso completo
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </DialogPanel>
    </>
  );
}
