'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
} from 'lucide-react';
import Link, { workspacePath } from './workspace-link';
import { Button } from './ui';
import { ThemeSwitcher } from './theme';
import { ProfileAvatar } from './profile-avatar';
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

const sidebarPreference = 'aulify:sidebar-collapsed';
function subscribeSidebar(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener('aulify:sidebar', notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener('aulify:sidebar', notify);
  };
}
function readSidebar() {
  try {
    return localStorage.getItem(sidebarPreference) === 'true';
  } catch {
    return false;
  }
}
function currentSection(path: string) {
  const section = path.split('/')[2] || 'inicio';
  return ['editor', 'previa'].includes(section)
    ? 'biblioteca'
    : section === 'materia'
      ? 'materias'
      : section;
}

// Curved moving notch inspired by RewampUI Fluid Wave Navbar.
// Navigation remains route-driven; hovering previews the wave without changing pages.
function FluidWave({ vertical = false }: { vertical?: boolean }) {
  return (
    <span className="fluid-wave" aria-hidden="true">
      <span className="fluid-wave-dot" />
      <svg viewBox={vertical ? '0 0 20 74' : '0 0 74 20'} preserveAspectRatio="none">
        <path
          d={vertical ? 'M20 0C20 16 2 22 2 37S20 58 20 74Z' : 'M0 20C16 20 22 2 37 2S58 20 74 20Z'}
        />
      </svg>
    </span>
  );
}

function NavigationContents({
  state,
  user,
  subjects,
  onNavigate,
  collapsed = false,
  onCollapse,
}: NavigationProps & { onNavigate?: () => void; collapsed?: boolean; onCollapse?: () => void }) {
  const path = usePathname();
  const [preview, setPreview] = useState<number | null>(null);
  const teacher = user.role === 'teacher';
  const section = path.split('/')[2] || 'inicio';
  const activeSection = currentSection(path);
  const items = destinations.filter(
    (n) => teacher || !['biblioteca', 'revision'].includes(n.section),
  );
  const selected = items.findIndex((n) => n.section === activeSection);
  const waveIndex = preview ?? selected;
  const pending = state.attempts.filter(
    (a) => a.status === 'closed' && a.answers.some((r) => !r.reviews.length),
  ).length;
  return (
    <>
      <div className="sidebar-heading">
        <Link href="/" className="app-logo" aria-label="Aulify, portada" onClick={onNavigate}>
          <img
            src={collapsed ? '/brand/aulify-symbol.svg' : '/brand/aulify-logo.svg'}
            alt="Aulify"
          />
        </Link>
        {onCollapse && (
          <button
            type="button"
            className="icon-button sidebar-toggle"
            onClick={onCollapse}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
            title={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
            aria-expanded={!collapsed}
            aria-controls="desktop-navigation"
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        )}
      </div>
      <nav
        className={`app-nav ${collapsed ? 'fluid-nav-vertical' : ''}`}
        id={onCollapse ? 'desktop-navigation' : undefined}
        aria-label="Navegación de la plataforma"
        style={{ '--wave-index': Math.max(waveIndex, 0) } as CSSProperties}
        onMouseLeave={() => setPreview(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPreview(null);
        }}
      >
        {collapsed && waveIndex >= 0 && <FluidWave vertical />}
        {items.map((n, index) => {
          const href = workspacePath(n.href, path);
          return (
            <Link
              key={n.section}
              href={href}
              className={`nav-link ${activeSection === n.section ? 'active' : ''}`}
              aria-current={activeSection === n.section ? 'page' : undefined}
              aria-label={n.label}
              title={collapsed ? n.label : undefined}
              data-wave-active={waveIndex === index}
              onMouseEnter={() => setPreview(index)}
              onFocus={() => setPreview(index)}
              onClick={() => {
                setPreview(null);
                onNavigate?.();
              }}
            >
              <n.icon size={19} aria-hidden="true" />
              <span className="nav-label">{n.label}</span>
              {n.section === 'revision' && pending > 0 && <span className="count">{pending}</span>}
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
          aria-label="Ayuda"
          title={collapsed ? 'Ayuda' : undefined}
          onClick={onNavigate}
        >
          <HelpCircle size={19} aria-hidden="true" />
          <span className="nav-label">Ayuda</span>
        </Link>
        <Link
          href="/demo/preferencias"
          className={`nav-link ${section === 'preferencias' ? 'active' : ''}`}
          aria-label="Preferencias"
          title={collapsed ? 'Preferencias' : undefined}
          onClick={onNavigate}
        >
          <Settings size={19} aria-hidden="true" />
          <span className="nav-label">Preferencias</span>
        </Link>
        <div className="user-line" title={`${user.name} · ${teacher ? 'Docente' : 'Estudiante'}`}>
          <ProfileAvatar userId={user.id} />
          <div className="user-details">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{teacher ? 'Docente' : 'Estudiante'}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function MobileDock({ user, onOpen, open }: { user: User; onOpen: () => void; open: boolean }) {
  const path = usePathname();
  const active = currentSection(path);
  const [preview, setPreview] = useState<number | null>(null);
  const sections =
    user.role === 'teacher'
      ? ['inicio', 'materias', 'biblioteca', 'revision']
      : ['inicio', 'materias', 'tareas', 'resultados'];
  const items = sections.map((section) => destinations.find((n) => n.section === section)!);
  const current = items.findIndex((n) => n.section === active);
  const selected = open || current < 0 ? 4 : current;
  const waveIndex = preview ?? selected;
  return (
    <nav
      aria-label="Accesos rápidos"
      className="workspace-dock"
      style={{ '--wave-index': waveIndex, '--wave-count': 5 } as CSSProperties}
      onMouseLeave={() => setPreview(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPreview(null);
      }}
    >
      <div className="dock-wave-track">
        <FluidWave />
      </div>
      {items.map((item, index) => (
        <Link
          key={item.section}
          href={item.href}
          className="dock-link"
          aria-label={item.label}
          title={item.label}
          aria-current={selected === index ? 'page' : undefined}
          data-wave-active={waveIndex === index}
          onFocus={() => setPreview(index)}
          onMouseEnter={() => setPreview(index)}
          onClick={() => setPreview(null)}
        >
          <item.icon size={22} aria-hidden="true" />
          <span className="sr-only">{item.label}</span>
        </Link>
      ))}
      <button
        className="dock-link"
        type="button"
        aria-label="Más opciones"
        title="Más opciones"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'mobile-navigation' : undefined}
        data-wave-active={waveIndex === 4}
        onFocus={() => setPreview(4)}
        onMouseEnter={() => setPreview(4)}
        onClick={() => {
          setPreview(null);
          onOpen();
        }}
      >
        <MoreHorizontal size={22} aria-hidden="true" />
      </button>
    </nav>
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
  const storedCollapsed = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(null);
  const collapsed = localCollapsed ?? storedCollapsed;
  const toggleSidebar = () => {
    setLocalCollapsed(!collapsed);
    try {
      localStorage.setItem(sidebarPreference, String(!collapsed));
      window.dispatchEvent(new Event('aulify:sidebar'));
    } catch {
      /* The control still works when browser storage is unavailable. */
    }
  };
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
      <aside className="app-sidebar" data-collapsed={collapsed} aria-label="Tu espacio de trabajo">
        <NavigationContents {...props} collapsed={collapsed} onCollapse={toggleSidebar} />
      </aside>
      <MobileDock user={props.user} open={open} onOpen={() => onOpenChange(true)} />
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
