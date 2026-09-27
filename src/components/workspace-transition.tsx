'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Direction = 'top-level' | 'forward' | 'backward';

function directionBetween(previous: string, next: string): Direction {
  const from = previous.split('/')[2];
  const to = next.split('/')[2];
  if (from === 'previa' && to === 'editor') return 'backward';
  if (['materia', 'editor', 'previa'].includes(to)) return 'forward';
  if (
    (from === 'materia' && to === 'materias') ||
    (['editor', 'previa'].includes(from) && to === 'biblioteca')
  )
    return 'backward';
  return 'top-level';
}

export function WorkspaceTransition({ path, children }: { path: string; children: ReactNode }) {
  const [navigation, setNavigation] = useState<{ path: string; direction: Direction }>({
    path,
    direction: 'top-level',
  });
  const main = useRef<HTMLElement>(null);
  if (navigation.path !== path) {
    setNavigation({ path, direction: directionBetween(navigation.path, path) });
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (document.querySelector('[role="dialog"]')) return;
      const heading = main.current?.querySelector('h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [path]);

  return (
    <main
      id="contenido"
      ref={main}
      className="app-content"
      data-transition={navigation.direction}
      key={path}
    >
      {children}
    </main>
  );
}
