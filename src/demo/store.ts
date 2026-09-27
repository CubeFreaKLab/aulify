'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { createDemoRepository, DEMO_IDS, type DemoRepository, type DemoState } from '@/domain';

export interface DemoSnapshot {
  state: DemoState | null;
  userId: string;
  error: string | null;
  message: string | null;
}
let snapshot: DemoSnapshot | null = null;
let repository: DemoRepository | null = null;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((listener) => listener());
}
function readProfile() {
  return new URLSearchParams(window.location.search).get('perfil') === 'estudiante'
    ? DEMO_IDS.student
    : new URLSearchParams(window.location.search).get('perfil') === 'docente'
      ? DEMO_IDS.teacher
      : window.sessionStorage.getItem('aulify.demo.profile') || DEMO_IDS.teacher;
}
function hydrate() {
  if (snapshot) {
    const profile = new URLSearchParams(window.location.search).get('perfil');
    if (profile) switchProfile(profile === 'estudiante' ? DEMO_IDS.student : DEMO_IDS.teacher);
    return;
  }
  try {
    repository = createDemoRepository(window.localStorage);
    const userId = readProfile();
    window.sessionStorage.setItem('aulify.demo.profile', userId);
    snapshot = { state: repository.load(), userId, error: null, message: null };
  } catch (error) {
    snapshot = {
      state: null,
      userId: DEMO_IDS.teacher,
      error: error instanceof Error ? error.message : 'No pudimos abrir la demostración.',
      message: null,
    };
  }
  emit();
  window.addEventListener('storage', () => refreshDemo());
}
export function refreshDemo() {
  if (!repository || !snapshot) return;
  try {
    snapshot = { ...snapshot, state: repository.load() };
    emit();
  } catch (error) {
    showError(error);
  }
}
function showError(error: unknown) {
  snapshot = {
    state: snapshot?.state || null,
    userId: snapshot?.userId || DEMO_IDS.teacher,
    message: null,
    error: error instanceof Error ? error.message : 'No se pudo completar la acción.',
  };
  emit();
}
export function runDemo<T>(
  operation: (repository: DemoRepository) => T,
  message?: string,
): T | undefined {
  if (!repository) {
    showError(new Error('La demostración todavía se está preparando.'));
    return;
  }
  try {
    const result = operation(repository);
    snapshot = {
      state: repository.load(),
      userId: snapshot?.userId || DEMO_IDS.teacher,
      error: null,
      message: message || null,
    };
    emit();
    return result;
  } catch (error) {
    showError(error);
    return undefined;
  }
}
export function getDemoRepository() {
  if (!repository) throw new Error('Demostración no preparada.');
  return repository;
}
export function switchProfile(userId: string) {
  if (!snapshot) return;
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
export function resetDemo() {
  runDemo((repo) => repo.reset(), 'La clase de ejemplo está lista para empezar de nuevo.');
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => snapshot;
const serverSnapshot = () => null;
export function useDemo() {
  const data = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  useEffect(hydrate, []);
  return data;
}
