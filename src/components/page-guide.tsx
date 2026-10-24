'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react';
import type { DemoState, User } from '@/domain';
import { helpState, HELP_VERSION } from '@/domain/help';
import { runDemo } from '@/demo/store';
import { Button } from './ui';
import { pageGuideSteps, type GuideStep } from './page-guide-steps';
import '@/styles/page-guide.css';

export function OpenPageGuide({
  children = 'Guía de esta página',
}: {
  children?: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost small page-guide-trigger"
      aria-label={typeof children === 'string' ? children : 'Guía de esta página'}
      data-guide="repeat"
      onPress={() => window.dispatchEvent(new Event('aulify:guide'))}
    >
      <Compass size={17} aria-hidden="true" />
      <span>{children}</span>
    </Button>
  );
}
type Box = { x: number; y: number; w: number; h: number; vw: number; vh: number };
const visibleTarget = (selector: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden',
  );

export function PageGuide({ page, user, state }: { page: string; user: User; state: DemoState }) {
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [open, setOpen] = useState(false);
  const maskId = useId();
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [disableAuto, setDisableAuto] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(290);
  const returnFocus = useRef<HTMLElement | null>(null);
  const storageKey = `aulify:page-guide:v1:${user.id}:${user.role}:${page}`;
  const autoKey = `aulify:page-guide:manual:${user.id}:${user.role}`;
  const { activeAttempt, current } = helpState(state, user);

  useEffect(() => {
    function start() {
      if (document.querySelector('[role="dialog"]')) return;
      const available = pageGuideSteps(page, user.role === 'teacher').filter((s) =>
        visibleTarget(s.target),
      );
      if (!available.length) return;
      try {
        setDisableAuto(localStorage.getItem(autoKey) === 'true');
      } catch {
        setDisableAuto(false);
      }
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setIndex(0);
      setSteps(available);
      setOpen(true);
    }
    const timer = setTimeout(() => {
      if (activeAttempt) return;
      if (page === 'inicio' && current && current.status !== 'offered') return;
      try {
        if (localStorage.getItem(storageKey) || localStorage.getItem(autoKey)) return;
      } catch {
        /* Help remains available without storage. */
      }
      start();
    }, 650);
    window.addEventListener('aulify:guide', start);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('aulify:guide', start);
    };
  }, [page, user.role, storageKey, autoKey, activeAttempt, current]);

  useEffect(() => {
    if (!open) return;
    const element = visibleTarget(steps[index].target);
    if (element)
      element.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    const measure = () => {
      const rect = element?.getBoundingClientRect();
      setBox({
        x: Math.max(8, (rect?.left ?? 16) - 7),
        y: Math.max(8, (rect?.top ?? 16) - 7),
        w: Math.min((rect?.width ?? 0) + 14, innerWidth - 16),
        h: Math.min((rect?.height ?? 0) + 14, innerHeight - 16),
        vw: innerWidth,
        vh: innerHeight,
      });
    };
    const frame = requestAnimationFrame(() => {
      measure();
      heading.current?.focus({ preventScroll: true });
    });
    const observer = new ResizeObserver(measure);
    if (element) observer.observe(element);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, index, steps]);
  useEffect(() => {
    if (!open || !panel.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setPanelHeight(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height),
    );
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, [open]);

  function close(completed = false) {
    try {
      localStorage.setItem(storageKey, completed ? 'completed' : 'skipped');
      if (disableAuto) localStorage.setItem(autoKey, 'true');
      else localStorage.removeItem(autoKey);
    } catch {
      /* Storage is optional. */
    }
    if (page === 'inicio')
      void runDemo((repo) =>
        repo.setHelpPreference(
          user.id,
          completed || current?.status === 'completed' ? 'completed' : 'skipped',
          HELP_VERSION,
        ),
      );
    setOpen(false);
    requestAnimationFrame(() => {
      if (returnFocus.current?.isConnected && returnFocus.current !== document.body)
        returnFocus.current.focus({ preventScroll: true });
      else {
        const title = document.querySelector<HTMLElement>('main h1');
        if (title) {
          title.tabIndex = -1;
          title.focus({ preventScroll: true });
        }
      }
    });
  }
  const panelWidth = Math.min(390, (box?.vw ?? 420) - 24);
  const below = box ? box.y + box.h + 18 : 16;
  const top = box
    ? Math.max(
        12,
        Math.min(
          below + panelHeight < box.vh - 12 ? below : box.y - panelHeight - 18,
          box.vh - panelHeight - 12,
        ),
      )
    : 16;
  const left = box ? Math.max(12, Math.min(box.x, box.vw - panelWidth - 12)) : 12;
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
      isDismissable
      className="page-guide-overlay"
    >
      {box && (
        <svg className="page-guide-shade" width="100%" height="100%" aria-hidden="true">
          <defs>
            <mask id={maskId}>
              <rect width="100%" height="100%" fill="white" />
              <rect
                className="page-guide-hole"
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx="10"
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="#000" fillOpacity=".67" mask={`url(#${maskId})`} />
          <rect
            className="page-guide-highlight"
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx="10"
            fill="none"
            stroke="#85bd6e"
            strokeWidth="3"
          />
        </svg>
      )}
      <Modal className="page-guide-modal" style={{ left, top, width: panelWidth }}>
        <Dialog ref={panel} className="page-guide-dialog" aria-describedby="page-guide-description">
          <div className="page-guide-meta">
            <span>
              {user.role === 'teacher' ? 'Guía docente' : 'Guía estudiante'} · {index + 1}/
              {steps.length}
            </span>
            <Button variant="ghost small" aria-label="Cerrar guía" onPress={() => close()}>
              <X size={21} />
            </Button>
          </div>
          <div key={index} className="page-guide-copy">
            <Heading ref={heading} tabIndex={-1} slot="title">
              {steps[index]?.title}
            </Heading>
            <p id="page-guide-description">{steps[index]?.body}</p>
          </div>
          <div className="page-guide-actions">
            <Button
              variant="secondary small"
              isDisabled={index === 0}
              onPress={() => setIndex((i) => i - 1)}
            >
              <ArrowLeft size={16} />
              Anterior
            </Button>
            <Button
              variant="small"
              onPress={() => (index === steps.length - 1 ? close(true) : setIndex((i) => i + 1))}
            >
              {index === steps.length - 1 ? 'Terminar guía' : 'Siguiente'}
              <ArrowRight size={16} />
            </Button>
          </div>
          <label className="page-guide-auto">
            <input
              type="checkbox"
              checked={disableAuto}
              onChange={(e) => setDisableAuto(e.target.checked)}
            />
            Abrir las próximas guías solo cuando las pida
          </label>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
