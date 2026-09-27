'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  BookOpen,
  FolderOpen,
  ClipboardCheck,
  BarChart3,
  HelpCircle,
  Settings,
  Menu,
  X,
  ArrowUpRight,
  Plus,
  Leaf,
  Users,
  ArrowRight,
  FileText,
  Check,
  Search,
  GraduationCap,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { useDemo, runDemo, switchProfile, clearNotice, resetDemo } from '@/demo/store';
import { DEMO_IDS, questionsOf, type DemoState, type User, type Subject } from '@/domain';
import { Button, Badge, PageHeading, DialogPanel, Field, EmptyState } from './ui';
import { EditorScreen } from './editor-screen';
import { ActivityScreen } from './activity-screen';
import { ReviewScreen, ResultsScreen, TasksScreen } from './results-screen';
import { ResourcePreview } from './resource-preview';
import { WorkspaceTransition } from './workspace-transition';

const navigation = [
  { href: '/demo', label: 'Mi inicio', icon: Home },
  { href: '/demo/materias', label: 'Mis materias', icon: BookOpen },
  { href: '/demo/biblioteca', label: 'Biblioteca', icon: FolderOpen },
  { href: '/demo/revision', label: 'Por revisar', icon: ClipboardCheck },
  { href: '/demo/resultados', label: 'Resultados', icon: BarChart3 },
];

export function Workspace() {
  const data = useDemo();
  const path = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [profiles, setProfiles] = useState(false);
  if (!data)
    return (
      <main
        id="contenido"
        className="loading-shell"
        aria-busy="true"
        aria-label="Preparando la clase de ejemplo"
      >
        <div className="skeleton" style={{ width: '40%', height: 40 }} />
        <div className="skeleton block" />
      </main>
    );
  if (!data.state)
    return (
      <main id="contenido" className="error-page">
        <h1>No pudimos abrir la muestra.</h1>
        <p role="alert">{data.error}</p>
        <Button onPress={resetDemo}>Reiniciar datos de demostración</Button>
        <Link href="/">Volver a Aulify</Link>
      </main>
    );
  const { state, userId } = data;
  const user = state.users.find((u) => u.id === userId) || state.users[0];
  const teacher = user.role === 'teacher';
  const subjects = state.subjects.filter((s) =>
    teacher
      ? s.ownerId === user.id
      : state.memberships.some(
          (m) => m.subjectId === s.id && m.studentId === user.id && m.status === 'approved',
        ),
  );
  const segment = path.split('/').filter(Boolean);
  const page = segment[1] || 'inicio';
  const id = segment[2];
  const onProfile = (id: string) => {
    switchProfile(id);
    setProfiles(false);
    router.push('/demo');
  };
  const notices = (
    <>
      {data.error && (
        <div className="notice error" role="alert" style={{ marginBottom: 20 }}>
          {data.error}
          <button className="button ghost small" onClick={clearNotice}>
            Cerrar aviso
          </button>
        </div>
      )}
      {data.message && (
        <div className="notice" role="status" style={{ marginBottom: 20 }}>
          {data.message}
          <button className="button ghost small" onClick={clearNotice}>
            Cerrar
          </button>
        </div>
      )}
    </>
  );
  if (page === 'actividad' && id)
    return <ActivityScreen activityId={id} user={user} state={state} notices={notices} />;
  return (
    <div className="app-shell">
      <aside
        className={`app-sidebar ${mobile ? 'mobile-open' : ''}`}
        aria-label="Navegación de la plataforma"
      >
        <Link href="/" className="app-logo" aria-label="Aulify, portada">
          <img src="/brand/aulify-logo.svg" alt="Aulify" />
        </Link>
        <nav className="app-nav">
          {navigation
            .filter((n) => teacher || !['Biblioteca', 'Por revisar'].includes(n.label))
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-link ${path === n.href || (n.href !== '/demo' && path.startsWith(n.href)) ? 'active' : ''}`}
                aria-current={path === n.href ? 'page' : undefined}
                onClick={() => setMobile(false)}
              >
                <n.icon size={19} />
                {n.label}
                {n.label === 'Por revisar' && (
                  <span className="count">
                    {
                      state.attempts.filter(
                        (a) => a.status === 'closed' && a.answers.some((r) => !r.reviews.length),
                      ).length
                    }
                  </span>
                )}
              </Link>
            ))}
          <Link
            href="/demo/tareas"
            className={`nav-link ${page === 'tareas' ? 'active' : ''}`}
            onClick={() => setMobile(false)}
          >
            <FileText size={19} />
            Tareas
          </Link>
        </nav>
        <div className="sidebar-label">TUS MATERIAS</div>
        {subjects.slice(0, 4).map((s) => (
          <Link
            key={s.id}
            href={`/demo/materia/${s.id}`}
            className="nav-link"
            onClick={() => setMobile(false)}
          >
            <span className="subject-dot" />
            {s.name}
          </Link>
        ))}
        <div className="sidebar-bottom">
          <Link href="/demo/ayuda" className="nav-link" onClick={() => setMobile(false)}>
            <HelpCircle size={19} />
            Ayuda
          </Link>
          <Link href="/demo/preferencias" className="nav-link" onClick={() => setMobile(false)}>
            <Settings size={19} />
            Preferencias
          </Link>
          <div className="user-line">
            <span className="avatar">
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
      </aside>
      <div style={{ minWidth: 0 }}>
        <header className="app-topbar">
          <div className="row">
            <button
              className="icon-button app-mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label={mobile ? 'Cerrar navegación' : 'Abrir navegación'}
              aria-expanded={mobile}
            >
              {mobile ? <X size={21} /> : <Menu size={21} />}
            </button>
            <span className="crumb">
              Tu espacio <span>/</span>{' '}
              <strong>
                {(
                  {
                    inicio: 'Inicio',
                    materias: 'Materias',
                    materia: 'Materia',
                    biblioteca: 'Biblioteca',
                    editor: 'Editor',
                    revision: 'Revisión',
                    resultados: 'Resultados',
                    tareas: 'Tareas',
                    ayuda: 'Ayuda',
                    preferencias: 'Preferencias',
                    previa: 'Vista previa',
                  } as Record<string, string>
                )[page] || 'Aulify'}
              </strong>
            </span>
          </div>
          <div className="row">
            <span className="demo-tag">Demostración</span>
            <Button
              variant="ghost small"
              aria-label="Cambiar perfil"
              onPress={() => setProfiles(true)}
            >
              <span className="role-label">Cambiar perfil</span>
              <Users size={17} />
              <ChevronDown size={13} />
            </Button>
          </div>
        </header>
        <WorkspaceTransition path={path}>
          {notices}
          {page === 'inicio' ? (
            <Dashboard key={user.id} state={state} user={user} subjects={subjects} />
          ) : page === 'materias' ? (
            <SubjectsScreen state={state} user={user} subjects={subjects} />
          ) : page === 'materia' && id ? (
            <SubjectScreen state={state} user={user} subjectId={id} />
          ) : page === 'biblioteca' && teacher ? (
            <LibraryScreen state={state} user={user} />
          ) : page === 'editor' && id && teacher ? (
            <EditorScreen resourceId={id} state={state} user={user} />
          ) : page === 'previa' && id && teacher ? (
            <ActivityScreen previewId={id} state={state} user={user} notices={null} />
          ) : page === 'revision' && teacher ? (
            <ReviewScreen state={state} user={user} />
          ) : page === 'resultados' ? (
            <ResultsScreen state={state} user={user} />
          ) : page === 'tareas' ? (
            <TasksScreen state={state} user={user} />
          ) : page === 'ayuda' || page === 'preferencias' ? (
            <HelpScreen state={state} user={user} preferences={page === 'preferencias'} />
          ) : (
            <EmptyState icon={BookOpen} title="Este espacio no está disponible">
              Puedes volver a tu inicio o consultar tus materias.
            </EmptyState>
          )}
        </WorkspaceTransition>
      </div>
      <DialogPanel
        open={profiles}
        onClose={() => setProfiles(false)}
        title="Explora otro lado de la clase"
      >
        <p className="muted" style={{ marginBottom: 22 }}>
          Estos perfiles son ficticios. Tus cambios se conservan en esta demostración del navegador.
        </p>
        <div className="stack">
          {state.users.map((u) => (
            <Button
              key={u.id}
              variant="secondary"
              style={{ justifyContent: 'start' }}
              onPress={() => onProfile(u.id)}
            >
              <span className="avatar">{u.name[0]}</span>
              <span>
                {u.name} · {u.role === 'teacher' ? 'Docente' : 'Estudiante'}
              </span>
              {user.id === u.id && <Check size={17} />}
            </Button>
          ))}
        </div>
      </DialogPanel>
    </div>
  );
}

function Dashboard({
  state,
  user,
  subjects,
}: {
  state: DemoState;
  user: User;
  subjects: Subject[];
}) {
  const teacher = user.role === 'teacher';
  const router = useRouter();
  const [help, setHelp] = useState(
    !state.helpPreferences.some((p) => p.userId === user.id && p.status !== 'offered'),
  );
  const activities = state.activities.filter((a) => subjects.some((s) => s.id === a.subjectId));
  return (
    <>
      <PageHeading
        eyebrow={teacher ? 'Tu aula, a tu manera' : 'Un día para descubrir'}
        title={`Hola, ${user.name.split(' ')[0]}.`}
        description={
          teacher
            ? 'Todo listo para tu próxima clase.'
            : 'Tu próxima idea empieza con una pregunta.'
        }
      >
        {teacher && (
          <Button onPress={() => createResource(user, router.push)}>
            <Plus size={17} />
            Crear recurso
          </Button>
        )}
      </PageHeading>
      <section className="welcome-panel">
        <div className="welcome-copy">
          <div className="eyebrow">{teacher ? 'De una idea a una clase' : 'Biología · 3° A'}</div>
          <h2>{teacher ? 'Una explicación puede ser el comienzo.' : 'Todo está conectado.'}</h2>
          <p>
            {teacher
              ? 'Añade una pregunta y deja que tus estudiantes sean parte de la historia.'
              : 'Explora los ecosistemas, conecta ideas y pon a prueba lo que sabes.'}
          </p>
          <Link
            href={
              teacher ? `/demo/editor/${DEMO_IDS.resource}` : `/demo/actividad/${DEMO_IDS.activity}`
            }
            className="button"
          >
            {teacher ? 'Preparar mi clase' : 'Explorar la actividad'}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="welcome-art">
          <img
            src="/illustrations/cuaderno.png"
            alt="Cuaderno abierto de ciencias con hojas y un lápiz verde"
          />
        </div>
      </section>
      <div className="metric-row">
        <div className="metric">
          <span className="metric-icon">
            <BookOpen size={20} />
          </span>
          <div>
            <strong>{subjects.length}</strong>
            <span>Materias activas</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">
            <FileText size={20} />
          </span>
          <div>
            <strong>{activities.length}</strong>
            <span>Actividades disponibles</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">
            <ClipboardCheck size={20} />
          </span>
          <div>
            <strong>
              {teacher
                ? state.attempts.filter((a) => a.answers.some((r) => !r.reviews.length)).length
                : state.attempts.filter((a) => a.studentId === user.id && a.status === 'closed')
                    .length}
            </strong>
            <span>{teacher ? 'Intentos por revisar' : 'Actividades completadas'}</span>
          </div>
        </div>
      </div>
      <div className="section-head">
        <h2>Mis materias</h2>
        <Link href="/demo/materias">
          Ver todas <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="subjects-grid">
        {subjects.map((s) => (
          <SubjectCard key={s.id} subject={s} state={state} />
        ))}
      </div>
      <div className="section-head">
        <h2>{teacher ? 'En tu clase' : 'Para seguir aprendiendo'}</h2>
      </div>
      <div className="list-panel">
        {activities.map((a) => (
          <div className="list-item" key={a.id}>
            <div className="row">
              <span className="item-icon">
                <FileText size={21} />
              </span>
              <div>
                <h3>{a.title}</h3>
                <p>
                  {state.subjects.find((s) => s.id === a.subjectId)?.name} ·{' '}
                  {a.settings.purpose === 'practice' ? 'Práctica' : 'Examen'}
                </p>
              </div>
            </div>
            <Link
              href={teacher ? '/demo/revision' : `/demo/actividad/${a.id}`}
              className="button secondary small"
            >
              {teacher ? 'Revisar' : 'Abrir'}
              <ArrowRight size={14} />
            </Link>
          </div>
        ))}
      </div>
      <DialogPanel
        open={help}
        onClose={() => {
          runDemo((r) => r.setHelpPreference(user.id, 'skipped'));
          setHelp(false);
        }}
        title={teacher ? 'Tu primera clase, paso a paso' : 'Este es tu espacio para aprender'}
      >
        <HelpSteps teacher={teacher} />
        <div className="dialog-actions">
          <Button
            variant="ghost"
            onPress={() => {
              runDemo((r) => r.setHelpPreference(user.id, 'skipped'));
              setHelp(false);
            }}
          >
            Ahora no
          </Button>
          <Button
            onPress={() => {
              runDemo((r) => r.setHelpPreference(user.id, 'completed'));
              setHelp(false);
              router.push(teacher ? '/demo/biblioteca' : '/demo/materias');
            }}
          >
            Empezar a explorar
          </Button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Puedes volver a esta guía desde Ayuda.
        </p>
      </DialogPanel>
    </>
  );
}
function SubjectCard({ subject: s, state }: { subject: Subject; state: DemoState }) {
  return (
    <Link href={`/demo/materia/${s.id}`} className="subject-card">
      <div className="subject-card-head">
        <Leaf size={46} strokeWidth={1.3} />
        <Badge>{s.course}</Badge>
      </div>
      <div className="subject-card-body">
        <h3>{s.name}</h3>
        <p>
          {s.course} · Gestión {s.year}
        </p>
        <div className="subject-card-foot">
          <span>
            {
              state.memberships.filter((m) => m.subjectId === s.id && m.status === 'approved')
                .length
            }{' '}
            estudiantes
          </span>
          <ArrowUpRight size={16} />
        </div>
      </div>
    </Link>
  );
}
function createResource(user: User, navigate: (path: string) => void) {
  const id = crypto.randomUUID();
  const resource = runDemo((r) =>
    r.saveDraft(
      {
        id,
        ownerId: user.id,
        title: 'Mi nuevo recurso',
        kind: 'resource',
        blocks: [
          { id: crypto.randomUUID(), type: 'heading', level: 2, text: 'Empecemos con una idea' },
          { id: crypto.randomUUID(), type: 'text', text: 'Escribe una explicación para tu clase.' },
        ],
        revision: 0,
        updatedAt: new Date().toISOString(),
      },
      0,
    ),
  );
  if (resource) navigate(`/demo/editor/${id}`);
}

function SubjectsScreen({
  state,
  user,
  subjects,
}: {
  state: DemoState;
  user: User;
  subjects: Subject[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState(2026);
  const [code, setCode] = useState('');
  const teacher = user.role === 'teacher';
  return (
    <>
      <PageHeading
        title="Mis materias"
        description="Un lugar para cada grupo, con sus propios recursos y resultados."
      >
        <Button onPress={() => setOpen(true)}>
          <Plus size={17} />
          {teacher ? 'Crear materia' : 'Unirme a una materia'}
        </Button>
      </PageHeading>
      <div className="subjects-grid">
        {subjects.map((s) => (
          <SubjectCard subject={s} state={state} key={s.id} />
        ))}
      </div>
      {!teacher &&
        state.memberships
          .filter((m) => m.studentId === user.id && m.status === 'pending')
          .map((m) => (
            <p className="notice" style={{ marginTop: 20 }} key={m.id}>
              Tu solicitud para {state.subjects.find((s) => s.id === m.subjectId)?.name} espera la
              aprobación del docente.
            </p>
          ))}
      <DialogPanel
        open={open}
        onClose={() => setOpen(false)}
        title={teacher ? 'Una nueva materia' : 'Únete a tu clase'}
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const result = teacher
              ? runDemo(
                  (r) => r.createSubject({ name, course, year, description: '' }, user.id),
                  'Materia creada.',
                )
              : runDemo(
                  (r) => r.requestMembership(code, user.id),
                  'Solicitud enviada. El docente debe aprobarla.',
                );
            if (result) setOpen(false);
          }}
        >
          {teacher ? (
            <>
              <Field label="Nombre de la materia" id="subject-name">
                <input
                  id="subject-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Por ejemplo, Biología"
                />
              </Field>
              <div className="grid-two">
                <Field label="Curso o grupo" id="subject-course">
                  <input
                    id="subject-course"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    required
                    placeholder="3° A"
                  />
                </Field>
                <Field label="Año" id="subject-year">
                  <input
                    id="subject-year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    min={2000}
                    max={2100}
                    required
                  />
                </Field>
              </div>
            </>
          ) : (
            <Field
              label="Código de la materia"
              id="subject-code"
              hint="Pídele el código a tu docente. Después de solicitar el ingreso, espera su aprobación."
            >
              <input
                id="subject-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
              />
            </Field>
          )}
          <Button type="submit">{teacher ? 'Crear materia' : 'Solicitar ingreso'}</Button>
        </form>
      </DialogPanel>
    </>
  );
}

function SubjectScreen({
  state,
  user,
  subjectId,
}: {
  state: DemoState;
  user: User;
  subjectId: string;
}) {
  const [tab, setTab] = useState('recursos');
  const s = state.subjects.find((v) => v.id === subjectId);
  if (!s)
    return (
      <EmptyState icon={BookOpen} title="Materia no encontrada">
        Vuelve a tus materias para continuar.
      </EmptyState>
    );
  const teacher = s.ownerId === user.id;
  const allowed =
    teacher ||
    state.memberships.some(
      (m) => m.subjectId === s.id && m.studentId === user.id && m.status === 'approved',
    );
  if (!allowed)
    return (
      <EmptyState icon={GraduationCap} title="Necesitas la aprobación de tu docente">
        Solicita el ingreso con el código de la materia.
      </EmptyState>
    );
  return (
    <>
      <PageHeading
        eyebrow={`${s.course} · ${s.year}`}
        title={s.name}
        description={s.description || 'Cada recurso es una nueva forma de aprender.'}
      >
        {teacher && (
          <Link href="/demo/biblioteca" className="button">
            <Plus size={17} />
            Compartir recurso
          </Link>
        )}
      </PageHeading>
      <div className="tab-bar" role="tablist" aria-label="Contenido de la materia">
        {(teacher ? ['recursos', 'integrantes', 'configuración'] : ['recursos']).map((t) => (
          <button
            key={t}
            id={`subject-tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls="subject-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const tabs = teacher ? ['recursos', 'integrantes', 'configuración'] : ['recursos'];
              const index = tabs.indexOf(t);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? tabs.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              setTab(tabs[next]);
              document.getElementById(`subject-tab-${tabs[next]}`)?.focus();
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <section
        key={tab}
        id="subject-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`subject-tab-${tab}`}
        className="subject-panel"
      >
        {tab === 'recursos' ? (
          <div className="list-panel">
            {state.activities
              .filter((a) => a.subjectId === s.id)
              .map((a) => (
                <div className="list-item" key={a.id}>
                  <div className="row">
                    <span className="item-icon">
                      <Leaf size={22} />
                    </span>
                    <div>
                      <h3>{a.title}</h3>
                      <p>
                        {a.settings.purpose === 'practice' ? 'Práctica' : 'Examen'} ·{' '}
                        {questionsOf(state.versions.find((v) => v.id === a.versionId)!).length}{' '}
                        preguntas
                      </p>
                    </div>
                  </div>
                  <Link
                    className="button secondary small"
                    href={
                      teacher && a.settings.pace !== 'guided'
                        ? `/demo/previa/${state.versions.find((v) => v.id === a.versionId)?.resourceId}`
                        : `/demo/actividad/${a.id}`
                    }
                  >
                    {teacher
                      ? a.settings.pace === 'guided'
                        ? 'Abrir sala'
                        : 'Vista previa'
                      : 'Participar'}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            {!state.activities.some((a) => a.subjectId === s.id) && (
              <EmptyState icon={FileText} title="Aquí empieza tu próxima clase">
                Comparte un recurso desde tu biblioteca.
              </EmptyState>
            )}
          </div>
        ) : tab === 'integrantes' ? (
          <>
            <div className="notice" style={{ marginBottom: 20 }}>
              Código de invitación: <strong style={{ letterSpacing: 2 }}>{s.code}</strong>.
              Compartirlo permite solicitar ingreso; la aprobación sigue en tus manos.
            </div>
            <div
              className="table-wrap"
              role="region"
              aria-label="Lista de integrantes"
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">Integrantes de {s.name}</caption>
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {state.memberships
                    .filter((m) => m.subjectId === s.id)
                    .map((m) => (
                      <tr key={m.id}>
                        <td>{state.users.find((u) => u.id === m.studentId)?.name}</td>
                        <td>
                          <Badge tone={m.status === 'approved' ? 'green' : 'amber'}>
                            {m.status === 'approved'
                              ? 'Aprobado'
                              : m.status === 'pending'
                                ? 'Solicitud pendiente'
                                : 'Rechazado'}
                          </Badge>
                        </td>
                        <td>
                          {m.status === 'pending' && (
                            <div className="row">
                              <Button
                                variant="small"
                                onPress={() =>
                                  runDemo(
                                    (r) => r.decideMembership(m.id, 'approved', user.id),
                                    'Estudiante aprobado.',
                                  )
                                }
                              >
                                Aprobar
                              </Button>
                              <Button
                                variant="ghost small"
                                onPress={() =>
                                  runDemo(
                                    (r) => r.decideMembership(m.id, 'rejected', user.id),
                                    'Solicitud rechazada.',
                                  )
                                }
                              >
                                Rechazar
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="surface">
            <h2>Detalles de la materia</h2>
            <p>
              {s.name} · {s.course} · {s.year}
            </p>
            <p className="muted" style={{ marginTop: 15 }}>
              El archivo, la restauración y la eliminación programada se incorporarán al conectar
              los servicios de la plataforma.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function LibraryScreen({ state, user }: { state: DemoState; user: User }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const resources = state.resources.filter(
    (r) =>
      r.ownerId === user.id &&
      r.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || r.kind === filter),
  );
  return (
    <>
      <PageHeading
        title="Tu biblioteca de ideas."
        description="Prepara una vez. Dale vida en cada clase."
      >
        <Button onPress={() => createResource(user, router.push)}>
          <Plus size={17} />
          Crear recurso
        </Button>
      </PageHeading>
      <div className="filters">
        <div className="search-field">
          <Search size={18} />
          <input
            className="input"
            aria-label="Buscar recursos"
            placeholder="Buscar en tu biblioteca…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          aria-label="Tipo de recurso"
          style={{ width: 'auto' }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todos los tipos</option>
          <option value="resource">Recursos de clase</option>
          <option value="quiz">Quizzes</option>
        </select>
      </div>
      <div className="resource-grid">
        {resources.map((r) => (
          <article className="resource-card" key={r.id}>
            <div className="resource-cover">
              <Badge>{r.kind === 'quiz' ? 'Quiz' : 'Recurso de clase'}</Badge>
              <Leaf size={65} strokeWidth={1.2} />
            </div>
            <div className="resource-card-body">
              <h2>{r.title}</h2>
              <p>
                {questionsOf(r).length} preguntas ·{' '}
                {state.versions.some((v) => v.resourceId === r.id)
                  ? 'Con versión publicada'
                  : 'Borrador'}
              </p>
              <div className="resource-card-actions">
                <Link className="button small" href={`/demo/editor/${r.id}`}>
                  Editar recurso
                </Link>
                <ResourcePreview resource={r} />
                <Button
                  variant="ghost small"
                  onPress={() => {
                    const id = crypto.randomUUID();
                    const copy = runDemo(
                      (repo) =>
                        repo.saveDraft(
                          { ...structuredClone(r), id, title: `${r.title} (copia)`, revision: 0 },
                          0,
                        ),
                      'Copia creada de forma independiente.',
                    );
                    if (copy) router.push(`/demo/editor/${id}`);
                  }}
                >
                  Duplicar
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!resources.length && (
        <EmptyState icon={FolderOpen} title="Una idea está por llegar">
          Cambia la búsqueda o crea tu primer recurso.
        </EmptyState>
      )}
    </>
  );
}

export function HelpSteps({ teacher }: { teacher: boolean }) {
  return (
    <div>
      {(teacher
        ? [
            [
              'Crea tu materia',
              'Añade el curso y año. Comparte el código y aprueba a tus estudiantes.',
            ],
            [
              'Prepara un recurso',
              'Combina explicaciones con preguntas. Guarda el borrador y publica cuando esté listo.',
            ],
            [
              'Acompaña y revisa',
              'Lee las respuestas, corrige las escritas y publica las notas cuando estén listas.',
            ],
          ]
        : [
            ['Únete a tu clase', 'Usa el código que te dé tu docente y espera su aprobación.'],
            [
              'Lee, piensa y participa',
              'Explora el recurso y responde a tu ritmo, según las reglas de la actividad.',
            ],
            ['Consulta tus resultados', 'Tus notas aparecen cuando el docente las publica.'],
          ]
      ).map(([title, text], i) => (
        <div className="help-step" key={title}>
          <span className="step-number">{i + 1}</span>
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
function HelpScreen({
  state,
  user,
  preferences,
}: {
  state: DemoState;
  user: User;
  preferences: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <PageHeading
        title={preferences ? 'Aulify, a tu manera.' : 'Una mano para empezar.'}
        description={
          preferences
            ? 'Preferencias y datos de tu demostración.'
            : 'Ayuda breve para encontrar tu próximo paso.'
        }
      />
      <div className="surface" style={{ maxWidth: 820 }}>
        {preferences ? (
          <>
            <h2>Tu perfil de muestra</h2>
            <p>
              {user.name} · {user.role === 'teacher' ? 'Docente' : 'Estudiante'}
            </p>
            <div className="divider" />
            <h2>Movimiento y accesibilidad</h2>
            <p className="muted">
              Aulify respeta la preferencia de movimiento reducido de tu dispositivo. Puedes navegar
              con teclado, ampliar el texto y usar alternativas a arrastrar.
            </p>
            <div className="divider" />
            <h2>Reiniciar la demostración</h2>
            <p className="muted">
              Se eliminarán los cambios locales de esta muestra y volverá la clase de ejemplo. No
              afecta cuentas ni servicios externos.
            </p>
            <Button variant="secondary" style={{ marginTop: 18 }} onPress={() => setConfirm(true)}>
              <RotateCcw size={17} />
              Reiniciar datos
            </Button>
          </>
        ) : (
          <>
            <HelpSteps teacher={user.role === 'teacher'} />
            <div className="divider" />
            <p className="notice">
              Estás explorando una clase con datos ficticios. El correo y el almacenamiento remoto
              se conectarán en una entrega posterior.
            </p>
            <Button
              variant="secondary"
              style={{ marginTop: 20 }}
              onPress={() =>
                runDemo(
                  (r) => r.setHelpPreference(user.id, 'offered'),
                  'La guía volverá a aparecer al entrar a tu inicio.',
                )
              }
            >
              Volver a ofrecer la guía inicial
            </Button>
            <Link className="button ghost" href="/demo">
              Ir a mi inicio
            </Link>
          </>
        )}
      </div>
      <DialogPanel
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Reiniciar la clase de ejemplo?"
      >
        <p>
          Se borrarán los cambios de la demostración de este navegador, incluidas{' '}
          {state.attempts.length} participaciones guardadas.
        </p>
        <div className="dialog-actions">
          <Button variant="secondary" onPress={() => setConfirm(false)}>
            Conservar mis cambios
          </Button>
          <Button
            onPress={() => {
              resetDemo();
              setConfirm(false);
            }}
          >
            Reiniciar demostración
          </Button>
        </div>
      </DialogPanel>
    </>
  );
}
