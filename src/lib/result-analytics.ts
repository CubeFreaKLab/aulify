import type { DemoState, StudentResult } from '@/domain';

export function calendarDay(value: string, timeZone = 'America/La_Paz'): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  return ['year', 'month', 'day']
    .map((name) => parts.find((part) => part.type === name)!.value)
    .join('-');
}

export function activityDays(state: DemoState): Map<string, string> {
  return new Map([
    ...state.activities.map((activity): [string, string] => [
      activity.id,
      calendarDay(activity.settings.closesAt, activity.settings.timeZone),
    ]),
    ...state.tasks.map((task): [string, string] => [task.id, calendarDay(task.closesAt)]),
    ...state.manualActivities.map((activity): [string, string] => [
      activity.id,
      calendarDay(activity.occursAt),
    ]),
  ]);
}

export function withinDateRange(day: string | undefined, from: string, through: string): boolean {
  if (!from && !through) return true;
  return Boolean(day && (!from || day >= from) && (!through || day <= through));
}

interface DistributionInput {
  status: StudentResult['status'];
  grade: number | null;
  maxGrade: number;
}

export function gradeDistribution(rows: DistributionInput[]) {
  const bins = [
    { label: '0 a menos de 20', count: 0 },
    { label: '20 a menos de 40', count: 0 },
    { label: '40 a menos de 60', count: 0 },
    { label: '60 a menos de 80', count: 0 },
    { label: '80 a 100, inclusive', count: 0 },
  ];
  const statuses = {
    published: 0,
    'pending-review': 0,
    unpublished: 0,
    'in-progress': 0,
    'not-started': 0,
  };
  for (const row of rows) {
    statuses[row.status]++;
    if (row.status !== 'published' || row.grade === null) continue;
    const normalized = (row.grade / row.maxGrade) * 100;
    if (!Number.isFinite(normalized) || normalized < 0 || normalized > 100) continue;
    bins[Math.min(4, Math.floor(normalized / 20))].count++;
  }
  return { bins, statuses };
}
