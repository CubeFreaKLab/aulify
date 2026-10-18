import { isActivityChangeData } from './activity-events';

type Listener = {
  changed: (activityChanged?: boolean) => void;
  connected: (value: boolean) => void;
};
type Shared = { source: EventSource; connected: boolean; listeners: Set<Listener> };
const sources = new Map<string, Shared>();

/** Compartir el flujo entre los componentes de la misma cuenta y actividad. */
export function listenActivityEvents(userId: string, activityId: string, listener: Listener) {
  if (typeof EventSource === 'undefined') return () => undefined;
  const key = `${userId}:${activityId}`;
  let entry = sources.get(key);
  if (!entry) {
    const source = new EventSource(`/api/events?activity=${encodeURIComponent(activityId)}`);
    entry = { source, connected: false, listeners: new Set() };
    sources.set(key, entry);
    const current = entry;
    const state = (connected: boolean) => {
      current.connected = connected;
      for (const item of current.listeners) item.connected(connected);
    };
    source.addEventListener('ready', () => state(true));
    source.addEventListener('unavailable', () => state(false));
    source.addEventListener('rotate', () => state(false));
    source.addEventListener('changed', (event) => {
      const activityChanged = isActivityChangeData((event as MessageEvent | undefined)?.data);
      for (const item of current.listeners) item.changed(activityChanged);
    });
    source.addEventListener('revoked', () => {
      state(false);
      for (const item of current.listeners) item.changed();
      source.close();
    });
    source.onerror = () => state(false);
  }
  const current = entry;
  current.listeners.add(listener);
  listener.connected(current.connected);
  return () => {
    current.listeners.delete(listener);
    if (!current.listeners.size) {
      current.source.close();
      if (sources.get(key) === current) sources.delete(key);
    }
  };
}
