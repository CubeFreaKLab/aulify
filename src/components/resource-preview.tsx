'use client';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { Leaf, ArrowRight } from 'lucide-react';
import { DialogPanel, Button, Badge } from './ui';
import { questionsOf, type Resource } from '@/domain';

export function ResourcePreview({ resource }: { resource: Resource }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLDivElement>(null);
  function toggle(next: boolean) {
    const card = button.current?.closest<HTMLElement>('.resource-card');
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
        <Button variant="secondary small" onPress={() => toggle(true)}>
          Vista previa
        </Button>
      </div>
      <DialogPanel open={open} onClose={() => toggle(false)} title="Un vistazo al recurso">
        <div
          className="preview-container"
          style={{ viewTransitionName: open ? 'resource-preview' : undefined }}
        >
          <div className="resource-cover">
            <Leaf size={60} strokeWidth={1.25} />
          </div>
          <div style={{ padding: 22 }}>
            <Badge tone="green">Recurso de clase</Badge>
            <h3 style={{ fontSize: 25, margin: '16px 0 12px' }}>{resource.title}</h3>
            <p className="muted">
              {resource.blocks.filter((b) => b.type !== 'quiz').length} bloques de explicación ·{' '}
              {questionsOf(resource).length} preguntas
            </p>
            <p style={{ margin: '16px 0 22px' }}>
              {resource.blocks.find((b) => b.type === 'text')?.text.slice(0, 220) ||
                'Una experiencia para leer, descubrir y participar.'}
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
