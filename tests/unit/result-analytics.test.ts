import { describe, it, expect } from 'vitest';
import { calendarDay, gradeDistribution, withinDateRange } from '../../src/lib/result-analytics';

describe('Seguimiento de calificaciones', () => {
  it('separa los límites 0, 20, 80 y 100 y mantiene el pendiente fuera del histograma', () => {
    const result = gradeDistribution([
      ...[0, 20, 80, 100].map((grade) => ({ status: 'published' as const, grade, maxGrade: 100 })),
      { status: 'pending-review', grade: null, maxGrade: 100 },
    ]);
    expect(result.bins.map((bin) => bin.count)).toEqual([1, 1, 0, 0, 2]);
    expect(result.statuses.published).toBe(4);
    expect(result.statuses['pending-review']).toBe(1);
  });
  it('normaliza máximos distintos sin redondear antes de elegir intervalo', () => {
    const result = gradeDistribution([
      { status: 'published', grade: 20, maxGrade: 20 },
      { status: 'published', grade: 79.999, maxGrade: 100 },
      { status: 'published', grade: 40, maxGrade: 100 },
      { status: 'published', grade: 60, maxGrade: 100 },
      { status: 'unpublished', grade: 0, maxGrade: 100 },
    ]);
    expect(result.bins.map((bin) => bin.count)).toEqual([0, 0, 1, 2, 1]);
    expect(result.statuses.unpublished).toBe(1);
  });
  it('aplica fechas inclusivas y respeta el día de la zona configurada', () => {
    expect(calendarDay('2026-09-26T02:00:00Z')).toBe('2026-09-25');
    expect(calendarDay('2026-09-26T02:00:00Z', 'UTC')).toBe('2026-09-26');
    expect(calendarDay('2026-09-25')).toBe('2026-09-25');
    expect(withinDateRange('2026-09-25', '2026-09-25', '2026-09-25')).toBe(true);
    expect(withinDateRange('2026-09-24', '2026-09-25', '2026-09-26')).toBe(false);
    expect(withinDateRange('2026-09-27', '2026-09-25', '2026-09-26')).toBe(false);
    expect(withinDateRange('2026-09-25', '2026-09-26', '2026-09-24')).toBe(false);
    expect(withinDateRange(undefined, '2026-09-25', '')).toBe(false);
    expect(withinDateRange(undefined, '', '')).toBe(true);
  });
});
