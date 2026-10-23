import Link from './workspace-link';
import type { DemoState } from '@/domain';

export function WorkspaceBreadcrumb({
  page,
  id,
  state,
}: {
  page: string;
  id?: string;
  state: DemoState;
}) {
  const labels: Record<string, string> = {
    inicio: 'Inicio',
    materias: 'Materias',
    biblioteca: 'Biblioteca',
    revision: 'Revisión',
    resultados: 'Resultados',
    tareas: 'Tareas',
    ayuda: 'Ayuda',
    preferencias: 'Preferencias',
    previa: 'Vista previa',
    editor: 'Editor',
    materia: 'Materia',
  };
  const trail: { label: string; href?: string }[] = [{ label: 'Tu espacio', href: '/demo' }];
  if (page === 'materia') {
    trail.push({ label: 'Materias', href: '/demo/materias' });
    trail.push({ label: state.subjects.find((s) => s.id === id)?.name || 'Materia' });
  } else if (page === 'editor' || page === 'previa') {
    trail.push({ label: 'Biblioteca', href: '/demo/biblioteca' });
    trail.push({
      label: state.resources.find((r) => r.id === id)?.title || 'Recurso',
      href: page === 'previa' ? '/demo/editor/' + id : undefined,
    });
    if (page === 'previa') trail.push({ label: 'Vista previa' });
  } else trail.push({ label: labels[page] || 'Aulify' });
  return (
    <nav className="workspace-breadcrumb" aria-label="Ruta de navegación">
      <ol>
        {trail.map((item, i) => (
          <li key={i}>
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <strong aria-current="page" title={item.label}>
                {item.label}
              </strong>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
