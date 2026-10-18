import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenActivityEvents } from '../../src/lib/activity-event-source';
import { isActivityHint, isActivityChangeData } from '../../src/lib/activity-events';

class Source {
  static all: Source[] = [];
  events = new Map<string, (event?: { data: string }) => void>();
  close = vi.fn();
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    Source.all.push(this);
  }
  addEventListener(name: string, fn: (event?: { data: string }) => void) {
    this.events.set(name, fn);
  }
  emit(name: string, data?: string) {
    this.events.get(name)?.(data === undefined ? undefined : { data });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  Source.all = [];
});
describe('Avisos compartidos del navegador', () => {
  it('distingue cambios comunes sin aceptar mensajes inválidos como una instrucción', () => {
    expect(isActivityChangeData('{"activityChanged":true}')).toBe(true);
    for (const input of [undefined, '{}', 'null', 'no json', '{"activityChanged":"true"}'])
      expect(isActivityChangeData(input)).toBe(false);
    vi.stubGlobal('EventSource', Source);
    const listener = { changed: vi.fn(), connected: vi.fn() };
    const leave = listenActivityEvents('student', 'activity', listener);
    Source.all[0].emit('changed', '{"activityChanged":true}');
    expect(listener.changed).toHaveBeenLastCalledWith(true);
    Source.all[0].emit('changed', '{}');
    expect(listener.changed).toHaveBeenLastCalledWith(false);
    leave();
  });
  it('comparte una conexión por identidad/actividad y la cierra al salir el último componente', () => {
    vi.stubGlobal('EventSource', Source);
    const a = { changed: vi.fn(), connected: vi.fn() };
    const b = { changed: vi.fn(), connected: vi.fn() };
    const leaveA = listenActivityEvents('student', 'activity', a);
    const leaveB = listenActivityEvents('student', 'activity', b);
    expect(Source.all).toHaveLength(1);
    Source.all[0].emit('ready');
    Source.all[0].emit('changed');
    expect(a.changed).toHaveBeenCalledOnce();
    expect(b.changed).toHaveBeenCalledOnce();
    expect(b.connected).toHaveBeenLastCalledWith(true);
    leaveA();
    expect(Source.all[0].close).not.toHaveBeenCalled();
    leaveB();
    expect(Source.all[0].close).toHaveBeenCalledOnce();
  });
  it('separa cuentas, informa la pérdida de conexión y cierra una matrícula revocada', () => {
    vi.stubGlobal('EventSource', Source);
    const listener = { changed: vi.fn(), connected: vi.fn() };
    const leave = listenActivityEvents('one', 'activity', listener);
    const leaveOther = listenActivityEvents('two', 'activity', {
      changed: vi.fn(),
      connected: vi.fn(),
    });
    expect(Source.all).toHaveLength(2);
    Source.all[0].emit('ready');
    Source.all[0].onerror?.();
    expect(listener.connected).toHaveBeenLastCalledWith(false);
    Source.all[0].emit('revoked');
    expect(listener.changed).toHaveBeenCalledOnce();
    expect(Source.all[0].close).toHaveBeenCalledOnce();
    leave();
    leaveOther();
  });
  it('no requiere EventSource para conservar el sondeo de respaldo', () => {
    vi.stubGlobal('EventSource', undefined);
    const listener = { changed: vi.fn(), connected: vi.fn() };
    expect(() => listenActivityEvents('a', 'b', listener)()).not.toThrow();
    expect(listener.connected).not.toHaveBeenCalled();
  });
  it('rechaza identificadores y tipos inválidos en el aviso de servidor', () => {
    const id = '10000000-0000-4000-8000-000000000001';
    expect(isActivityHint({ activityId: id, studentId: id, revoked: true })).toBe(true);
    for (const input of [
      null,
      {},
      { activityId: 'wrong' },
      { activityId: id, studentId: 4 },
      { activityId: id, revoked: 'true' },
    ])
      expect(isActivityHint(input)).toBe(false);
  });
});
