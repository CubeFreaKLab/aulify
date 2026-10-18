export const ACTIVITY_EVENT_HEALTH_MS = 30_000;
export const ACTIVITY_EVENT_STREAM_MS = 240_000;
export const ACTIVITY_EVENT_HEARTBEAT_MS = 15_000;

export function isActivityChangeData(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  try {
    const value = JSON.parse(data);
    return value !== null && typeof value === 'object' && value.activityChanged === true;
  } catch {
    return false;
  }
}

export type ActivityHint = { activityId: string; studentId?: string; revoked?: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isActivityHint(value: unknown): value is ActivityHint {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.activityId === 'string' &&
    uuid.test(v.activityId) &&
    (v.studentId === undefined || (typeof v.studentId === 'string' && uuid.test(v.studentId))) &&
    (v.revoked === undefined || typeof v.revoked === 'boolean')
  );
}
