'use client';
import { useState } from 'react';
import { Copy, FolderOpen, Plus, Search, X } from 'lucide-react';
import Link, { useWorkspaceRouter } from './workspace-link';
import { runDemo } from '@/demo/store';
import { questionsOf, type DemoState, type Resource, type User } from '@/domain';
import { Button, EmptyState, PageHeading } from './ui';
import { ResourcePreview, ResourceSample } from './resource-preview';
import '@/styles/library.css';

const titleOrder = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const modifiedDate = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function LibraryScreen({
  state,
  user,
  onCreate,
}: {
  state: DemoState;
  user: User;
  onCreate: () => void;
}) {
  const router = useWorkspaceRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [order, setOrder] = useState('modified');
  const [copying, setCopying] = useState<string | null>(null);
  const owned = state.resources.filter((resource) => resource.ownerId === user.id);
  const query = search.trim().toLocaleLowerCase('es');
  const resources = owned
    .filter(
      (resource) =>
        resource.title.toLocaleLowerCase('es').includes(query) &&
        (filter === 'all' || resource.kind === filter),
    )
    .sort((a, b) =>
      order === 'title'
        ? titleOrder.compare(a.title, b.title)
        : Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || titleOrder.compare(a.title, b.title),
    );

  async function duplicate(resource: Resource) {
    setCopying(resource.id);
    try {
      const id = crypto.randomUUID();
      const copy = await runDemo(
        (repo) =>
          repo.saveDraft(
            {
              ...structuredClone(resource),
              id,
              title: `${resource.title.slice(0, 112)} (copia)`,
              revision: 0,
            },
            0,
          ),
        'Copia creada de forma independiente.',
      );
      if (copy) router.push(`/demo/editor/${id}`);
    } finally {
      setCopying(null);
    }
  }

  return (
    <section className="library-screen" aria-label="Biblioteca de recursos">
      <PageHeading
        title="Biblioteca"
        description="Tus recursos y quizzes, listos para seguir trabajando o compartir en clase."
      >
        <Button onPress={onCreate}>
          <Plus size={17} />
          Crear recurso
        </Button>
      </PageHeading>
      <div className="library-tools">
        <div className="search-field library-search">
          <Search size={18} aria-hidden="true" />
          <input
            className="input"
            aria-label="Buscar recursos"
            placeholder="Buscar por título"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <Button
              variant="ghost"
              className="library-clear"
              aria-label="Limpiar búsqueda"
              onPress={() => setSearch('')}
            >
              <X size={16} />
            </Button>
          )}
        </div>
        <label className="library-select">
          Tipo
          <select
            className="input"
            aria-label="Tipo de recurso"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Todos los tipos</option>
            <option value="resource">Recursos de clase</option>
            <option value="quiz">Quizzes</option>
          </select>
        </label>
        <label className="library-select">
          Ordenar por
          <select
            className="input"
            aria-label="Ordenar recursos"
            value={order}
            onChange={(event) => setOrder(event.target.value)}
          >
            <option value="modified">Última modificación</option>
            <option value="title">Título: A a Z</option>
          </select>
        </label>
      </div>
      <p className="library-count" role="status">
        {resources.length === owned.length
          ? `${resources.length} ${resources.length === 1 ? 'recurso' : 'recursos'}`
          : `${resources.length} de ${owned.length} recursos`}
      </p>
      <div className="library-list">
        {resources.map((resource) => {
          const questions = questionsOf(resource).length;
          const published = state.versions.some((version) => version.resourceId === resource.id);
          const updated = new Date(resource.updatedAt);
          return (
            <article
              className="library-item"
              key={resource.id}
              aria-labelledby={`resource-title-${resource.id}`}
            >
              <div className="library-sample">
                <ResourceSample resource={resource} />
              </div>
              <div className="library-item-body">
                <div className="library-item-meta">
                  <span>{resource.kind === 'quiz' ? 'Quiz' : 'Recurso de clase'}</span>
                  <span>{published ? 'Con versión publicada' : 'Borrador'}</span>
                </div>
                <h2 id={`resource-title-${resource.id}`}>
                  <Link href={`/demo/editor/${resource.id}`}>{resource.title}</Link>
                </h2>
                <p className="library-details">
                  {questions
                    ? `${questions} ${questions === 1 ? 'pregunta' : 'preguntas'}`
                    : 'Solo lectura'}
                  {!Number.isNaN(updated.getTime()) && (
                    <>
                      {' '}
                      · Modificado el{' '}
                      <time dateTime={resource.updatedAt}>{modifiedDate.format(updated)}</time>
                    </>
                  )}
                </p>
                <div className="library-actions">
                  <Link className="button secondary small" href={`/demo/editor/${resource.id}`}>
                    Editar recurso
                  </Link>
                  <ResourcePreview resource={resource} />
                  <Button
                    variant="ghost small"
                    isDisabled={copying !== null}
                    onPress={() => duplicate(resource)}
                  >
                    <Copy size={15} aria-hidden="true" />
                    {copying === resource.id ? 'Duplicando…' : 'Duplicar'}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!resources.length && (
        <EmptyState
          icon={FolderOpen}
          title={owned.length ? 'No encontramos ese recurso' : 'Tu primer recurso empieza aquí'}
          action={
            owned.length ? (
              <Button
                variant="secondary"
                onPress={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Quitar filtros
              </Button>
            ) : (
              <Button onPress={onCreate}>Crear mi primer recurso</Button>
            )
          }
        >
          {owned.length
            ? 'Prueba con otro título o cambia el tipo de recurso.'
            : 'Reúne explicaciones, imágenes y preguntas. Podrás reutilizarlas en distintas materias.'}
        </EmptyState>
      )}
    </section>
  );
}
