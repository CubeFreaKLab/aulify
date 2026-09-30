import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attempt, DemoState } from '../../src/domain';
import type { DemoSnapshot } from '../../src/demo/store';

const mocks = vi.hoisted(() => ({
  path: '/aula/actividad/activity',
  effects: [] as (() => (() => void) | void)[],
  read: (() => null) as () => DemoSnapshot | null,
}));
vi.mock('react', () => ({
  useEffect: (effect: () => (() => void) | void) => mocks.effects.push(effect),
  useSyncExternalStore: (_subscribe: unknown, read: () => DemoSnapshot | null) => {
    mocks.read = read;
    return read();
  },
}));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.path }));
vi.mock('@/domain', () => import('../../src/domain'));
vi.mock('@/lib/retry-after', () => import('../../src/lib/retry-after'));

function attempt(answered = false): Attempt {
  return {
    id: 'attempt',
    activityId: 'activity',
    studentId: 'student',
    versionId: 'version',
    number: 1,
    questionOrder: ['question'],
    optionOrders: {},
    startedAt: '2026-09-30T01:00:00Z',
    deadline: '2026-09-30T02:00:00Z',
    status: 'in-progress',
    answers: answered
      ? [
          {
            questionId: 'question',
            value: { type: 'single', optionId: 'one' },
            idempotencyKey: 'key',
            submittedAt: '2026-09-30T01:00:01Z',
            usedDouble: false,
            reviews: [],
          },
        ]
      : [],
  };
}
function workspace(revision = 1, answered = false, userId = 'student') {
  const state: DemoState = {
    schemaVersion: 1,
    revision,
    users: [],
    subjects: [],
    memberships: [],
    resources: [],
    versions: [],
    activities: [],
    attempts: [attempt(answered)],
    powerups: [],
    evaluations: [],
    tasks: [],
    submissions: [],
    manualActivities: [],
    helpPreferences: [],
  };
  return {
    state,
    userId,
    studentActivities: {},
    studentResults: {},
    teams: [],
    incidents: [],
    participants: [],
    draftEvaluations: [],
    readings: [],
    resubmissionWindows: [],
  };
}
const unavailable = (retryAfter?: string) =>
  Response.json(
    { error: 'Temporalmente ocupado.' },
    {
      status: 503,
      headers: retryAfter ? { 'Retry-After': retryAfter } : undefined,
    },
  );
const deferred = () => {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let store: typeof import('../../src/demo/store');
let cleanups: (() => void)[];
const tick = (ms = 1000) => vi.advanceTimersByTimeAsync(ms);
async function mount() {
  store ??= await import('../../src/demo/store');
  store.useDemo();
  const cleanup = mocks.effects.at(-1)?.();
  if (cleanup) cleanups.push(cleanup);
  await tick(0);
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T01:00:00Z'));
  mocks.path = '/aula/actividad/activity';
  mocks.effects = [];
  mocks.read = () => null;
  cleanups = [];
  const browser = Object.assign(new EventTarget(), {
    location: { search: '' },
    setInterval,
    clearInterval,
  });
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', { visibilityState: 'visible' });
  store = await import('../../src/demo/store');
});
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  store.clearWorkspaceSession();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('adopción de revisión tras una proyección vigente', () => {
  it('reintenta el snapshot fallido aunque sync repita la misma revisión', async () => {
    let reads = 0,
      polls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) {
          polls++;
          return Response.json({ revision: 'R' });
        }
        reads++;
        return reads === 2 ? unavailable('3') : Response.json(workspace(reads === 1 ? 1 : 2));
      }),
    );
    await mount();
    await tick();
    expect(reads).toBe(2);
    expect(mocks.read()?.error).toContain('Temporalmente');
    await tick(2000);
    expect(polls).toBe(1);
    await tick();
    expect(reads).toBe(3);
    expect(mocks.read()?.state?.revision).toBe(2);
    expect(mocks.read()?.error).toBeNull();
    await tick();
    expect(reads).toBe(3);
  });

  it('conserva el retroceso creciente cuando falla la proyección repetidamente', async () => {
    let reads = 0,
      polls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) {
          polls++;
          return Response.json({ revision: 'R' });
        }
        reads++;
        return reads > 1 && reads < 4 ? unavailable() : Response.json(workspace(reads));
      }),
    );
    await mount();
    await tick(2000);
    expect(reads).toBe(3);
    await tick();
    expect(polls).toBe(2);
    expect(reads).toBe(3);
    await tick();
    expect(reads).toBe(4);
    expect(mocks.read()?.error).toBeNull();
  });

  it('mantiene refreshDemo pública sin rechazos para llamadas existentes', async () => {
    let reads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (++reads === 1 ? Response.json(workspace()) : unavailable())),
    );
    await mount();
    await expect(store.refreshDemo()).resolves.toBeUndefined();
    expect(mocks.read()?.state?.revision).toBe(1);
    expect(mocks.read()?.error).toContain('Temporalmente');
  });

  it('no acepta una revisión a partir de una lectura iniciada antes del sondeo', async () => {
    let reads = 0;
    const previous = deferred();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) return Response.json({ revision: 'R' });
        reads++;
        return reads === 2 ? previous.promise : Response.json(workspace(reads));
      }),
    );
    await mount();
    const priorRefresh = store.refreshDemo();
    await tick();
    previous.resolve(Response.json(workspace(2)));
    await priorRefresh;
    await tick();
    expect(reads).toBe(3);
    expect(mocks.read()?.state?.revision).toBe(3);
  });

  it('conserva el ACK y vuelve a leer si la proyección quedó obsoleta', async () => {
    let reads = 0;
    const previous = deferred();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) return Response.json({ revision: 'R' });
        if (url === '/api/commands')
          return Response.json({ result: { attempt: attempt(true), feedback: null } });
        reads++;
        return reads === 2 ? previous.promise : Response.json(workspace(reads, reads > 2));
      }),
    );
    await mount();
    await tick();
    await store.runDemo(
      (repo) =>
        repo.submitAnswer('attempt', 'question', { type: 'single', optionId: 'one' }, 'key', false),
      undefined,
      { refresh: 'deferred' },
    );
    expect(mocks.read()?.state?.attempts[0].answers).toHaveLength(1);
    previous.resolve(Response.json(workspace(2, false)));
    await tick(0);
    expect(mocks.read()?.state?.attempts[0].answers).toHaveLength(1);
    await tick();
    expect(reads).toBe(3);
    expect(mocks.read()?.state?.attempts[0].answers[0].idempotencyKey).toBe('key');
  });

  it.each([401, 403])('limpia los datos y detiene el sondeo ante workspace %s', async (status) => {
    let reads = 0,
      polls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) {
          polls++;
          return Response.json({ revision: 'R' });
        }
        reads++;
        return reads === 1
          ? Response.json(workspace())
          : Response.json({ error: 'Acceso perdido.' }, { status });
      }),
    );
    await mount();
    await tick();
    expect(mocks.read()?.state).toBeNull();
    expect(mocks.read()?.userId).toBe('');
    expect(mocks.read()?.error).toContain('Acceso perdido');
    await tick(10000);
    expect(polls).toBe(1);
    expect(reads).toBe(status === 403 ? 3 : 2);
  });

  it('ignora una proyección de la sesión anterior después de limpiar y cambiar de ámbito', async () => {
    let reads = 0;
    const previous = deferred();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) return Response.json({ revision: 'R' });
        reads++;
        return reads === 2
          ? previous.promise
          : Response.json(workspace(reads, false, reads >= 3 ? 'next-user' : 'student'));
      }),
    );
    await mount();
    await tick();
    store.clearWorkspaceSession();
    mocks.path = '/aula/actividad/next-activity';
    await mount();
    previous.resolve(Response.json(workspace(99, false, 'old-user')));
    await tick(0);
    expect(mocks.read()?.userId).toBe('next-user');
    expect(mocks.read()?.state?.revision).toBe(3);
  });
});
