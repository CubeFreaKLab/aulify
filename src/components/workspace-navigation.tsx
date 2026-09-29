'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';
import {
  Home,
  BookOpen,
  FolderOpen,
  ClipboardCheck,
  BarChart3,
  FileText,
  HelpCircle,
  Settings,
  X,
} from 'lucide-react';
import Link, { workspacePath } from './workspace-link';
import { Button } from './ui';
import { ThemeSwitcher } from './theme';
import type { DemoState, Subject, User } from '@/domain';
import '@/styles/navigation.css';

type NavigationProps = { state: DemoState; user: User; subjects: Subject[] };
const destinations = [
  { href: '/demo', label: 'Mi inicio', icon: Home, section: 'inicio' },
  { href: '/demo/materias', label: 'Mis materias', icon: BookOpen, section: 'materias' },
  { href: '/demo/biblioteca', label: 'Biblioteca', icon: FolderOpen, section: 'biblioteca' },
  { href: '/demo/revision', label: 'Por revisar', icon: ClipboardCheck, section: 'revision' },
  { href: '/demo/resultados', label: 'Resultados', icon: BarChart3, section: 'resultados' },
  { href: '/demo/tareas', label: 'Tareas', icon: FileText, section: 'tareas' },
];

function NavigationContents({
  state,
  user,
  subjects,
  onNavigate,
}: NavigationProps & { onNavigate?: () => void }) {
  const path = usePathname();
  const teacher = user.role === 'teacher';
  const section = path.split('/')[2] || 'inicio';
  const activeSection = ['editor', 'previa'].includes(section)
    ? 'biblioteca'
    : section === 'materia'
      ? 'materias'
      : section;
  const pending = state.attempts.filter(
    (a) => a.status === 'closed' && a.answers.some((r) => !r.reviews.length),
  ).length;
  return (
    <>
      <Link href="/" className="app-logo" aria-label="Aulify, portada" onClick={onNavigate}>
        <img src="/brand/aulify-logo.svg" alt="Aulify" />
      </Link>
      <nav className="app-nav" aria-label="Navegación de la plataforma">
        {destinations
          .filter((n) => teacher || !['biblioteca', 'revision'].includes(n.section))
          .map((n) => {
            const href = workspacePath(n.href, path);
            return (
              <Link
                key={n.section}
                href={href}
                className={`nav-link ${activeSection === n.section ? 'active' : ''}`}
                aria-current={path === href ? 'page' : undefined}
                onClick={onNavigate}
              >
                <n.icon size={19} aria-hidden="true" />
                {n.label}
                {n.section === 'revision' && pending > 0 && (
                  <span className="count">{pending}</span>
                )}
              </Link>
            );
          })}
      </nav>
      {subjects.length > 0 && (
        <div className="sidebar-subjects">
          <div className="sidebar-label">Tus materias</div>
          {subjects.slice(0, 4).map((s) => (
            <Link
              key={s.id}
              href={`/demo/materia/${s.id}`}
              className="nav-link"
              onClick={onNavigate}
            >
              <span className="subject-dot" aria-hidden="true" />
              <span className="nav-subject-name">{s.name}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="sidebar-bottom">
        <ThemeSwitcher compact />
        <Link
          href="/demo/ayuda"
          className={`nav-link ${section === 'ayuda' ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <HelpCircle size={19} aria-hidden="true" />
          Ayuda
        </Link>
        <Link
          href="/demo/preferencias"
          className={`nav-link ${section === 'preferencias' ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <Settings size={19} aria-hidden="true" />
          Preferencias
        </Link>
        <div className="user-line">
          <span className="avatar" aria-hidden="true">
            {user.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div>
            <div className="user-name">{user.name}</div>
            <div className="user-role">{teacher ? 'Docente' : 'Estudiante'}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export function WorkspaceNavigation({
  open,
  onOpenChange,
  ...props
}: NavigationProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 801px)');
    const closeOnDesktop = () => {
      if (desktop.matches) onOpenChange(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [onOpenChange]);
  return (
    <>
      <aside className="app-sidebar" aria-label="Tu espacio de trabajo">
        <NavigationContents {...props} />
      </aside>
      <ModalOverlay
        isOpen={open}
        onOpenChange={onOpenChange}
        isDismissable
        className="navigation-overlay"
      >
        <Modal className="navigation-modal">
          <Dialog
            id="mobile-navigation"
            className="navigation-drawer"
            aria-label="Menú de navegación"
          >
            <Button
              autoFocus
              variant="ghost"
              className="icon-button navigation-close"
              aria-label="Cerrar navegación"
              onPress={() => onOpenChange(false)}
            >
              <X size={21} aria-hidden="true" />
            </Button>
            <NavigationContents {...props} onNavigate={() => onOpenChange(false)} />
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
