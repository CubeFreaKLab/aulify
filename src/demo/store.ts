'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import {
  createDemoRepository,
  DEMO_IDS,
  type DemoRepository,
  type DemoState,
  type StudentActivity,
  type StudentResult,
  type Attempt,
  type Rational,
  type Evaluation,
  type ResourceVersion,
} from '@/domain';

type ReadMethod = 'load' | 'studentActivity' | 'studentResults' | 'restoreProblem';
export type WorkspaceRepository = {
  [K in keyof DemoRepository]: K extends ReadMethod
    ? DemoRepository[K]
    : DemoRepository[K] extends (...args: infer A) => infer R
      ? (...args: A) => R | Promise<R>
      : DemoRepository[K];
};
export interface DemoSnapshot {
  state: DemoState | null;
  userId: string;
  error: string | null;
  message: string | null;
  live: boolean;
}
export interface WorkspaceExtras {
  teams: { id: string; activityId: string; name: string; studentIds: string[] }[];
  incidents: { attempt_id: string; status: string; comment: string; signalCount: number }[];
  participants: { id: string; activityId: string; studentId: string; alias: string }[];
  draftEvaluations: Evaluation[];
  readings: { id: string; subjectId: string; title: string; content: ResourceVersion }[];
  resubmissionWindows: { taskId: string; studentId: string; closesAt: string }[];
}
interface ServerSnapshot extends WorkspaceExtras {
  state: DemoState;
  userId: string;
  studentActivities: Record<string, StudentActivity>;
  studentResults: Record<string, StudentResult[]>;
}
const emptyExtras: WorkspaceExtras = {
  teams: [],
  incidents: [],
  participants: [],
  draftEvaluations: [],
  readings: [],
  resubmissionWindows: [],
};
export function getWorkspaceExtras(): WorkspaceExtras {
  return remote || emptyExtras;
}
let snapshot: DemoSnapshot | null = null;
let repository: WorkspaceRepository | null = null;
let remote: ServerSnapshot | null = null;
let refreshPending: Promise<void> | null = null;
let activeMode: boolean | null = null;
let generation = 0;
let projectionEpoch = 0;
type ImmediateFeedback = {
  points: Rational;
  explanation: string | null;
  maximum: number;
  correct: boolean;
};
const feedbackByAnswer = new Map<string, ImmediateFeedback>();
export function getImmediateFeedback(attemptId: string, questionId: string) {
  return feedbackByAnswer.get(`${attemptId}:${questionId}`);
}
export function clearWorkspaceSession() {
  generation++;
  snapshot = null;
  remote = null;
  repository = null;
  activeMode = null;
  refreshPending = null;
  feedbackByAnswer.clear();
  emit();
}
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((listener) => listener());
}
function readProfile() {
  const profile = new URLSearchParams(window.location.search).get('perfil');
  return profile === 'estudiante'
    ? DEMO_IDS.student
    : profile === 'docente'
      ? DEMO_IDS.teacher
      : window.sessionStorage.getItem('aulify.demo.profile') || DEMO_IDS.teacher;
}
class WorkspaceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      cache: 'no-store',
      signal: options?.signal || AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Se perdió la conexión. Conserva esta página abierta y vuelve a intentarlo.');
  }
  const data = await response.json();
  if (!response.ok)
    throw new WorkspaceHttpError(data.error || 'No pudimos completar la acción.', response.status);
  return data as T;
}
export async function remoteCommand<T>(action: string, args: unknown[]): Promise<T> {
  const response = await requestJson<{ result: T }>('/api/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args }),
  });
  return response.result;
}
function remoteRepository(): WorkspaceRepository {
  const command =
    <K extends keyof DemoRepository>(action: K, count: number) =>
    (...args: unknown[]) =>
      remoteCommand(action, args.slice(0, count));
  return {
    load: () => {
      if (!remote) throw new Error('Tu aula todavía está cargando.');
      return remote.state;
    },
    restoreProblem: null,
    reset: () => {
      throw new Error('Solo puedes reiniciar los datos de la demostración.');
    },
    saveDraft: command('saveDraft', 2),
    publishResource: command('publishResource', 1),
    createActivity: command('createActivity', 4),
    updateActivity: command('updateActivity', 2),
    joinGuidedRoom: command('joinGuidedRoom', 1),
    startGuidedSession: command('startGuidedSession', 1),
    closeGuidedQuestion: command('closeGuidedQuestion', 2),
    openNextGuidedQuestion: command('openNextGuidedQuestion', 1),
    startAttempt: command('startAttempt', 1),
    submitAnswer: async (...args: unknown[]) => {
      const currentGeneration = generation;
      const result = await remoteCommand<{ attempt: Attempt; feedback: ImmediateFeedback | null }>(
        'submitAnswer',
        args.slice(0, 5),
      );
      const attempt: Attempt = {
        ...result.attempt,
        answers: result.attempt.answers.map((answer) => ({
          ...answer,
          reviews: answer.reviews || [],
        })),
      };
      if (currentGeneration !== generation) return attempt;
      if (result.feedback) feedbackByAnswer.set(`${args[0]}:${args[1]}`, result.feedback);
      if (remote && snapshot && attempt.studentId === remote.userId) {
        // El servidor ya confirmó la escritura. Una lectura iniciada antes no puede revertirla.
        projectionEpoch++;
        const doubleAnswer = attempt.answers.find((answer) => answer.usedDouble);
        const consumed = remote.state.powerups.some(
          (use) =>
            use.activityId === attempt.activityId &&
            use.studentId === attempt.studentId &&
            use.kind === 'double',
        );
        const state: DemoState = {
          ...remote.state,
          attempts: [...remote.state.attempts.filter((item) => item.id !== attempt.id), attempt],
          powerups:
            doubleAnswer && !consumed
              ? [
                  ...remote.state.powerups,
                  {
                    activityId: attempt.activityId,
                    studentId: attempt.studentId,
                    kind: 'double',
                    questionId: doubleAnswer.questionId,
                    attemptId: attempt.id,
                    at: doubleAnswer.submittedAt,
                  },
                ]
              : remote.state.powerups,
        };
        const activity = remote.studentActivities[attempt.activityId];
        remote = {
          ...remote,
          state,
          studentActivities: activity
            ? {
                ...remote.studentActivities,
                [attempt.activityId]: {
                  ...activity,
                  attempt,
                  doubleUsed: activity.doubleUsed || Boolean(doubleAnswer),
                },
              }
            : remote.studentActivities,
        };
        snapshot = { ...snapshot, state, error: null, message: null };
      }
      return attempt;
    },
    useHint: command('useHint', 2),
    reviewAnswer: command('reviewAnswer', 5),
    publishGrade: command('publishGrade', 4),
    createSubject: command('createSubject', 1),
    requestMembership: command('requestMembership', 1),
    decideMembership: command('decideMembership', 2),
    createTask: command('createTask', 1),
    submitTask: command('submitTask', 3),
    reviewTask: command('reviewTask', 3),
    publishTaskGrade: command('publishTaskGrade', 1),
    setHelpPreference: (_userId: string, status: string, version = 1) =>
      remoteCommand('setHelpPreference', [status, version]),
    studentActivity: (id: string) => {
      const value = remote?.studentActivities[id];
      if (!value) throw new Error('Esta actividad no está disponible para tu cuenta.');
      return value;
    },
    studentResults: (id: string) => remote?.studentResults[id] || [],
  } as WorkspaceRepository;
}
async function hydrate(live: boolean) {
  if (activeMode === live && snapshot) {
    if (!live && new URLSearchParams(window.location.search).has('perfil'))
      switchProfile(readProfile());
    return;
  }
  if (activeMode === live && refreshPending) return;
  clearWorkspaceSession();
  activeMode = live;
  if (live) {
    repository = remoteRepository();
    await refreshDemo();
  } else {
    try {
      repository = createDemoRepository(window.localStorage);
      const userId = readProfile();
      window.sessionStorage.setItem('aulify.demo.profile', userId);
      snapshot = { state: repository.load(), userId, error: null, message: null, live: false };
      emit();
    } catch (error) {
      showError(error);
    }
  }
}
export async function refreshDemo() {
  if (!repository) return;
  if (!activeMode) {
    if (snapshot) {
      try {
        snapshot = { ...snapshot, state: repository.load() };
        emit();
      } catch (error) {
        showError(error);
      }
    }
    return;
  }
  if (refreshPending) return refreshPending;
  const currentGeneration = generation;
  const currentProjection = projectionEpoch;
  refreshPending = (async () => {
    try {
      const data = await requestJson<ServerSnapshot>('/api/workspace');
      if (currentGeneration !== generation || currentProjection !== projectionEpoch) return;
      remote = data;
      snapshot = {
        state: data.state,
        userId: data.userId,
        live: true,
        error: null,
        message: snapshot?.message || null,
      };
      emit();
    } catch (error) {
      if (currentGeneration === generation) showError(error);
    } finally {
      if (currentGeneration === generation) refreshPending = null;
    }
  })();
  return refreshPending;
}
function showError(error: unknown) {
  snapshot = {
    state: snapshot?.state || null,
    userId: snapshot?.userId || '',
    live: activeMode || false,
    message: null,
    error: error instanceof Error ? error.message : 'No se pudo completar la acción.',
  };
  emit();
}
export async function runDemo<T>(
  operation: (repository: WorkspaceRepository) => T | Promise<T>,
  message?: string,
  options?: { refresh: 'deferred' },
): Promise<T | undefined> {
  if (!repository) {
    showError(new Error('El aula todavía se está preparando.'));
    return;
  }
  const currentGeneration = generation;
  try {
    const result = await operation(repository);
    if (currentGeneration !== generation) return undefined;
    if (!activeMode || options?.refresh !== 'deferred') await refreshDemo();
    if (currentGeneration !== generation) return undefined;
    if (snapshot) snapshot = { ...snapshot, message: snapshot.error ? null : message || null };
    emit();
    return result;
  } catch (error) {
    if (currentGeneration === generation) showError(error);
    return undefined;
  }
}
export function getDemoRepository() {
  if (!repository) throw new Error('El aula todavía está cargando.');
  return repository;
}
export function switchProfile(userId: string) {
  if (!snapshot || activeMode) return;
  try {
    window.sessionStorage.setItem('aulify.demo.profile', userId);
    snapshot = { ...snapshot, userId, error: null, message: null };
    emit();
  } catch (error) {
    showError(error);
  }
}
export function clearNotice() {
  if (snapshot) {
    snapshot = { ...snapshot, message: null, error: null };
    emit();
  }
}
export async function resetDemo() {
  if (activeMode || !repository) return;
  try {
    await repository.reset();
    clearWorkspaceSession();
    await hydrate(false);
    if (snapshot)
      snapshot = {
        ...(snapshot as DemoSnapshot),
        message: 'La clase de ejemplo está lista para empezar de nuevo.',
      };
    emit();
  } catch (error) {
    showError(error);
  }
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => snapshot;
const serverSnapshot = () => null;
export function useDemo() {
  const path = usePathname();
  const live = path.startsWith('/aula');
  const data = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  useEffect(() => {
    void hydrate(live);
    let failures = 0,
      retryAt = 0,
      authorizationLost = false;
    const refresh = () => {
      failures = 0;
      retryAt = 0;
      authorizationLost = false;
      void refreshDemo();
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('online', refresh);
    const activityId = path.startsWith('/aula/actividad/') ? path.split('/')[3] : null;
    let revision: string | null = null,
      syncing = false,
      cancelled = false;
    const synchronize = async () => {
      if (
        document.visibilityState !== 'visible' ||
        syncing ||
        authorizationLost ||
        Date.now() < retryAt
      )
        return;
      if (!activityId) {
        refresh();
        return;
      }
      syncing = true;
      try {
        const value = await requestJson<{ revision: string }>(
          `/api/sync?activity=${encodeURIComponent(activityId)}`,
        );
        if (cancelled) return;
        const recovering = failures > 0;
        failures = 0;
        retryAt = 0;
        if (revision !== value.revision || recovering) {
          revision = value.revision;
          await refreshDemo();
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof WorkspaceHttpError && [401, 403].includes(error.status)) {
          authorizationLost = true;
          generation++;
          remote = null;
          refreshPending = null;
          feedbackByAnswer.clear();
          snapshot = { state: null, userId: '', live: true, error: error.message, message: null };
          emit();
          if (error.status === 403) await refreshDemo();
        } else {
          failures++;
          retryAt = Date.now() + Math.min(8000, 1000 * 2 ** (failures - 1));
          if (failures === 1) showError(error);
        }
      } finally {
        syncing = false;
      }
    };
    const timer = live
      ? window.setInterval(
          () => {
            void synchronize();
          },
          activityId ? 1000 : 4000,
        )
      : null;
    return () => {
      cancelled = true;
      window.removeEventListener('storage', refresh);
      window.removeEventListener('online', refresh);
      if (timer) window.clearInterval(timer);
    };
  }, [live, path]);
  return data?.live === live ? data : null;
}
