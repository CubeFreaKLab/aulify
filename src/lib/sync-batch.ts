export type SyncRevision = { revision: string; serverTime: string; nextDeadline: string | null };
export type SyncRequest = { key: string; userId: string; activityId: string };
export type SyncResult = { key: string; value?: SyncRevision; error?: { code: string } };
type Pending = {
  request: SyncRequest;
  resolve: (value: SyncRevision) => void;
  reject: (error: unknown) => void;
  promise: Promise<SyncRevision>;
};

/** Coalesces only in-flight reads for the same verified identity and activity. No result cache. */
export function createSyncBatchQueue(
  execute: (requests: SyncRequest[]) => Promise<SyncResult[]>,
  waitMs = 40,
  maximum = 64,
) {
  const pending: Pending[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const inFlight = new Map<string, Pending>();
  async function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    const batch = pending.splice(0, maximum);
    if (!batch.length) return;
    if (pending.length) timer = setTimeout(() => void flush(), waitMs);
    try {
      const values = await execute(batch.map((item) => item.request));
      const byKey = new Map(values.map((item) => [item.key, item]));
      if (byKey.size !== values.length || values.length !== batch.length) throw { code: 'XX000' };
      for (const item of batch) {
        const value = byKey.get(item.request.key);
        if (value?.error) item.reject(value.error);
        else if (value?.value && /^[a-f0-9]{32}$/.test(value.value.revision))
          item.resolve(value.value);
        else item.reject({ code: 'XX000' });
      }
    } catch (error) {
      for (const item of batch) item.reject(error);
    } finally {
      for (const item of batch) inFlight.delete(item.request.key);
    }
  }
  return {
    read(userId: string, activityId: string) {
      const key = `${userId.toLowerCase()}:${activityId.toLowerCase()}`;
      const existing = inFlight.get(key);
      if (existing) return existing.promise;
      if (inFlight.size >= 1024) return Promise.reject({ code: '53300' });
      let resolve!: Pending['resolve'];
      let reject!: Pending['reject'];
      const promise = new Promise<SyncRevision>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const item = { request: { key, userId, activityId }, promise, resolve, reject };
      inFlight.set(key, item);
      pending.push(item);
      if (pending.length >= maximum) void flush();
      else if (!timer) timer = setTimeout(() => void flush(), waitMs);
      return promise;
    },
  };
}
