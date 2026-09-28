'use client';

import { useState } from 'react';
import type { StudentResult } from '@/domain';
import { gradeDistribution } from '@/lib/result-analytics';
import { Field } from './ui';

interface DistributionRow {
  activityId: string;
  title: string;
  subject: { name: string; course: string };
  grade: number | null;
  maxGrade: number;
  status: StudentResult['status'];
}

export function ResultDistribution({ rows }: { rows: DistributionRow[] }) {
  const [selection, setSelection] = useState('');
  const activities = [...new Map(rows.map((row) => [row.activityId, row])).values()];
  const selectedId = activities.some((activity) => activity.activityId === selection)
    ? selection
    : activities[0]?.activityId;
  const selected = activities.find((activity) => activity.activityId === selectedId);
  if (!selected) return null;
  const distribution = gradeDistribution(rows.filter((row) => row.activityId === selectedId));
  const largest = Math.max(1, ...distribution.bins.map((bin) => bin.count));
  const otherStatuses = [
    ['Por corregir', distribution.statuses['pending-review']],
    ['Corregidas sin publicar', distribution.statuses.unpublished],
    ['En curso', distribution.statuses['in-progress']],
    ['Sin participar o entregar', distribution.statuses['not-started']],
  ] as const;
  return (
    <section
      className="surface results-overview results-distribution"
      aria-labelledby="distribution-heading"
    >
      <div className="row between wrap">
        <div>
          <h2 id="distribution-heading">Distribución por actividad</h2>
          <p className="results-note">
            Notas publicadas sobre 100. El último intervalo incluye 100; los pendientes no se
            cuentan como cero.
          </p>
        </div>
        <Field label="Actividad para distribución" id="distribution-activity">
          <select
            id="distribution-activity"
            value={selectedId}
            onChange={(event) => setSelection(event.target.value)}
          >
            {activities.map((activity) => (
              <option key={activity.activityId} value={activity.activityId}>
                {activity.title} · {activity.subject.name} · {activity.subject.course}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="results-distribution-chart" aria-hidden="true">
        {distribution.bins.map((bin) => (
          <div className="results-average-bar" key={bin.label}>
            <span>{bin.label}</span>
            <div>
              <i style={{ width: `${(bin.count / largest) * 100}%` }} />
            </div>
            <strong>{bin.count}</strong>
          </div>
        ))}
      </div>
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Tabla de distribución, desplazable horizontalmente"
      >
        <table>
          <caption className="sr-only">
            Valores del gráfico de distribución de {selected.title}
          </caption>
          <thead>
            <tr>
              <th scope="col">Intervalo sobre 100</th>
              <th scope="col">Notas publicadas</th>
            </tr>
          </thead>
          <tbody>
            {distribution.bins.map((bin) => (
              <tr key={bin.label}>
                <th scope="row">{bin.label}</th>
                <td>{bin.count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total de notas publicadas</th>
              <td>{distribution.statuses.published}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <dl className="results-distribution-statuses">
        {otherStatuses.map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
