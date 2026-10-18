import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attempt, DemoState } from '../../src/domain';
import type { DemoSnapshot } from '../../src/demo/store';

const mocks = vi.hoisted(() => ({
  path: '/aula/actividad/activity',
  effects: [] as (() => (() => void) | void)[],
  read: (() => null) as () => DemoSnapshot | null,
  events: null as null | {
    changed: (activityChanged?: boolean) => void;
    connected: (value: boolean) => void;
  },
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
vi.mock('@/lib/activity-event-source', () => ({
  listenActivityEvents: (_user: string, _activity: string, listener: typeof mocks.events) => {
    mocks.events = listener;
    return () => {
      if (mocks.events === listener) mocks.events = null;
    };
  },
}));
vi.mock('@/lib/activity-events', () => import('../../src/lib/activity-events'));

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
  mocks.events = null;
  const browser = Object.assign(new EventTarget(), {
    location: { search: '' },
    setInterval,
    clearInterval,
  });
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  store = await import('../../src/demo/store');
});
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  store.clearWorkspaceSession();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('adopción de revisión tras una proyección vigente', () => {
  it('reutiliza la proyección inicial verificada y vuelve a leer ante un cambio externo', async () => {
    let reads = 0;
    let revision = 'a'.repeat(32);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) return Response.json({ revision });
        reads++;
        return Response.json({
          ...workspace(reads),
          activitySync: { activityId: 'activity', revision },
        });
      }),
    );
    await mount();
    await tick(2000);
    expect(reads).toBe(1);
    revision = 'b'.repeat(32);
    await tick();
    expect(reads).toBe(2);
    expect(mocks.read()?.state?.revision).toBe(2);
  });

  it.each([
    { activityId: 'foreign', revision: 'a'.repeat(32) },
    { activityId: 'activity', revision: 'invalid' },
  ])(
    'no reutiliza una revisión de otra actividad ni una revisión inválida: %j',
    async (activitySync) => {
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.startsWith('/api/sync')) return Response.json({ revision: 'a'.repeat(32) });
          reads++;
          return Response.json({ ...workspace(reads), activitySync });
        }),
      );
      await mount();
      await tick();
      expect(reads).toBe(2);
    },
  );

  it('recarga tras un fallo aunque la revisión coincida con la proyección inicial', async () => {
    let reads = 0;
    let syncCalls = 0;
    const revision = 'a'.repeat(32);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync'))
          return ++syncCalls === 1 ? unavailable() : Response.json({ revision });
        reads++;
        return Response.json({
          ...workspace(reads),
          activitySync: { activityId: 'activity', revision },
        });
      }),
    );
    await mount();
    await tick(3000);
    expect(reads).toBe(2);
  });

  it('un estudiante conectado lee por aviso y conserva la comprobación de respaldo', async () => {
    let polls = 0,
      revision = 'R';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) {
          polls++;
          return Response.json({
            revision,
            serverTime: new Date().toISOString(),
            nextDeadline: '2026-09-29T00:00:00Z',
          });
        }
        const value = workspace();
        value.state.users = [
          { id: 'student', name: 'Ficticio', role: 'student', email: 'example@example.test' },
        ];
        return Response.json(value);
      }),
    );
    await mount();
    cleanups.splice(0).forEach((cleanup) => cleanup());
    await mount(); // React vuelve a ejecutar el efecto al conocerse el perfil.
    mocks.events!.connected(true);
    await tick(0);
    expect(polls).toBe(1);
    await tick(29_000);
    expect(polls).toBe(1);
    revision = 'S';
    mocks.events!.changed();
    await tick(0);
    expect(polls).toBe(2);
    await tick(30_000);
    expect(polls).toBe(3);
    mocks.events!.connected(false);
    await tick(1000);
    expect(polls).toBe(4);
  });
  it('muestra un cambio común antes del sondeo y conserva plazos y revocación', async () => {
    let revision = 'a'.repeat(32),
      denied = false;
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.startsWith('/api/sync'))
          return Response.json({
            revision,
            serverTime: new Date().toISOString(),
            nextDeadline: '2026-09-30T02:00:00Z',
          });
        if (denied) return Response.json({ error: 'Acceso retirado.' }, { status: 403 });
        const value = workspace(revision.startsWith('a') ? 1 : 2);
        value.state.users = [
          { id: 'student', name: 'Ficticio', role: 'student', email: 'example@example.test' },
        ];
        return Response.json({ ...value, activitySync: { activityId: 'activity', revision } });
      }),
    );
    await mount();
    cleanups.splice(0).forEach((cleanup) => cleanup());
    await mount();
    mocks.events!.connected(true);
    await tick(0);
    const beforeHint = calls.length;
    revision = 'b'.repeat(32);
    mocks.events!.changed(true);
    await tick(0);
    expect(calls.slice(beforeHint)).toEqual(['/api/workspace?activity=activity']);
    expect(mocks.read()?.state?.revision).toBe(2);
    await tick(250);
    expect(calls.slice(beforeHint)).toEqual([
      '/api/workspace?activity=activity',
      '/api/sync?activity=activity',
    ]);
    denied = true;
    mocks.events!.changed(true);
    await tick(0);
    expect(mocks.read()?.state).toBeNull();
  });

  it('un aviso recibido durante la respuesta propia se procesa al terminar el comando', async () => {
    let polls = 0;
    const reply = deferred();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/commands') return reply.promise;
        if (url.startsWith('/api/sync')) {
          polls++;
          return Response.json({
            revision: 'R',
            nextDeadline: null,
            serverTime: new Date().toISOString(),
          });
        }
        const value = workspace();
        value.state.users = [
          { id: 'student', name: 'Ficticio', role: 'student', email: 'example@example.test' },
        ];
        return Response.json(value);
      }),
    );
    await mount();
    cleanups.splice(0).forEach((cleanup) => cleanup());
    await mount();
    mocks.events!.connected(true);
    await tick(0);
    const pending = store
      .getDemoRepository()
      .submitAnswer('attempt', 'question', { type: 'single', optionId: 'one' }, 'key', false);
    mocks.events!.changed();
    await tick(1000);
    expect(polls).toBe(1);
    reply.resolve(Response.json({ result: { attempt: attempt(true), feedback: null } }));
    await pending;
    await tick(250);
    expect(polls).toBe(2);
  });
  it('conserva el aviso de una operación rechazada al recibir una actualización automática', async () => {
    const message = 'Quedan respuestas pendientes. Confirma su cierre para continuar.';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/commands') return Response.json({ error: message }, { status: 400 });
        if (url.startsWith('/api/sync')) return Response.json({ revision: 'R' });
        return Response.json(workspace());
      }),
    );
    await mount();
    await store.runDemo((repo) => repo.closeGuidedQuestion('activity', false));
    expect(mocks.read()?.error).toBe(message);
    await tick();
    expect(mocks.read()?.error).toBe(message);
    store.clearNotice();
    await store.refreshDemo();
    expect(mocks.read()?.error).toBeNull();
  });

  it('retira el aviso cuando se confirma la operación y no reaparece tras otra lectura', async () => {
    let rejected = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/commands')
          return rejected
            ? Response.json({ error: 'Confirma el cierre.' }, { status: 400 })
            : Response.json({ result: true });
        return Response.json(workspace());
      }),
    );
    await mount();
    await store.runDemo((repo) => repo.closeGuidedQuestion('activity', false));
    expect(mocks.read()?.error).toBe('Confirma el cierre.');
    rejected = false;
    await store.runDemo((repo) => repo.closeGuidedQuestion('activity', true), 'Cierre confirmado.');
    expect(mocks.read()).toMatchObject({ error: null, message: 'Cierre confirmado.' });
    await store.refreshDemo();
    expect(mocks.read()?.error).toBeNull();
  });

  it('una confirmación anterior no borra el rechazo posterior de otra operación', async () => {
    const previous = deferred();
    let commands = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/commands')
          return ++commands === 1
            ? previous.promise
            : Response.json({ error: 'Confirma la nueva operación.' }, { status: 400 });
        return Response.json(workspace());
      }),
    );
    await mount();
    const earlier = store.runDemo((repo) => repo.openNextGuidedQuestion('activity'));
    await store.runDemo((repo) => repo.closeGuidedQuestion('activity', false));
    previous.resolve(Response.json({ result: true }));
    await earlier;
    expect(mocks.read()?.error).toBe('Confirma la nueva operación.');
    store.clearWorkspaceSession();
    await mount();
    expect(mocks.read()?.error).toBeNull();
  });

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

  it('aplica la respuesta confirmada sin volver a descargarla por su misma revisión', async () => {
    let reads = 0;
    let current = 'a'.repeat(32);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) return Response.json({ revision: current });
        if (url === '/api/commands') {
          current = 'b'.repeat(32);
          return Response.json({
            result: {
              attempt: attempt(true),
              feedback: null,
              syncRevision: current,
              syncBaseRevision: 'a'.repeat(32),
              syncProjectionComplete: true,
            },
          });
        }
        reads++;
        return Response.json(workspace(reads));
      }),
    );
    await mount();
    await tick();
    expect(reads).toBe(2);
    await store.runDemo(
      (repo) =>
        repo.submitAnswer('attempt', 'question', { type: 'single', optionId: 'one' }, 'key', false),
      undefined,
      { refresh: 'deferred' },
    );
    await tick(2000);
    expect(reads).toBe(2);
    expect(mocks.read()?.state?.attempts[0].answers).toHaveLength(1);
    current = 'c'.repeat(32);
    await tick();
    expect(reads).toBe(3);
  });

  it('descarta un sondeo iniciado antes de recibir el ACK y conserva la proyección confirmada', async () => {
    let reads = 0,
      polls = 0;
    const pending = deferred();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync'))
          return ++polls === 2
            ? pending.promise
            : Response.json({ revision: (polls === 1 ? 'a' : 'b').repeat(32) });
        if (url === '/api/commands')
          return Response.json({
            result: {
              attempt: attempt(true),
              feedback: null,
              syncRevision: 'b'.repeat(32),
              syncBaseRevision: 'a'.repeat(32),
              syncProjectionComplete: true,
            },
          });
        reads++;
        return Response.json(workspace(reads));
      }),
    );
    await mount();
    await tick();
    await tick();
    await store.runDemo(
      (repo) =>
        repo.submitAnswer('attempt', 'question', { type: 'single', optionId: 'one' }, 'key', false),
      undefined,
      { refresh: 'deferred' },
    );
    pending.resolve(Response.json({ revision: 'a'.repeat(32) }));
    await tick(0);
    await tick();
    expect(reads).toBe(2);
    expect(mocks.read()?.state?.attempts[0].answers).toHaveLength(1);
  });

  it.each(['external', 'unknown'])(
    'actualiza el estado externo aunque coincida la revisión final del ACK: %s',
    async (kind) => {
      let reads = 0,
        polls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.startsWith('/api/sync'))
            return Response.json({ revision: (++polls === 1 ? 'a' : 'b').repeat(32) });
          if (url === '/api/commands')
            return Response.json({
              result: {
                attempt: attempt(true),
                feedback: null,
                syncRevision: 'b'.repeat(32),
                syncBaseRevision: (kind === 'unknown' ? 'c' : 'a').repeat(32),
                syncProjectionComplete: kind !== 'external',
              },
            });
          reads++;
          return Response.json(workspace(reads, reads > 2));
        }),
      );
      await mount();
      await tick();
      await store.runDemo(
        (repo) =>
          repo.submitAnswer(
            'attempt',
            'question',
            { type: 'single', optionId: 'one' },
            'key',
            false,
          ),
        undefined,
        { refresh: 'deferred' },
      );
      await tick();
      expect(reads).toBe(3);
      expect(mocks.read()?.state?.revision).toBe(3);
    },
  );

  it('suspende el sondeo solo mientras espera la confirmación y lo reanuda después', async () => {
    let polls = 0;
    const pending = deferred();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync')) {
          polls++;
          return Response.json({ revision: 'a'.repeat(32) });
        }
        if (url === '/api/commands') return pending.promise;
        return Response.json(workspace());
      }),
    );
    await mount();
    await tick();
    const sending = store.runDemo(
      (repo) =>
        repo.submitAnswer('attempt', 'question', { type: 'single', optionId: 'one' }, 'key', false),
      undefined,
      { refresh: 'deferred' },
    );
    await tick(3000);
    expect(polls).toBe(1);
    pending.resolve(Response.json({ result: { attempt: attempt(true), feedback: null } }));
    await sending;
    await tick();
    expect(polls).toBe(2);
    expect(mocks.read()?.state?.attempts[0].answers).toHaveLength(1);
  });

  it('tras un fallo vuelve a leer aunque la revisión coincida con una respuesta confirmada', async () => {
    let reads = 0,
      polls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/sync'))
          return ++polls === 2 ? unavailable() : Response.json({ revision: 'b'.repeat(32) });
        if (url === '/api/commands')
          return Response.json({
            result: {
              attempt: attempt(true),
              feedback: null,
              syncRevision: 'b'.repeat(32),
              syncBaseRevision: 'a'.repeat(32),
              syncProjectionComplete: true,
            },
          });
        reads++;
        return Response.json(workspace(reads, reads > 2));
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
    await tick(2000);
    expect(reads).toBe(3);
    expect(mocks.read()?.error).toBeNull();
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
