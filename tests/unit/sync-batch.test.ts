import { describe, expect, it, vi } from 'vitest';
import { createSyncBatchQueue, type SyncRequest } from '../../src/lib/sync-batch';

const revision = (number = 1) => ({
  revision: number.toString(16).padStart(32, '0'),
  serverTime: '2026-10-03T00:00:00Z',
  nextDeadline: null,
});
const replies = (requests: SyncRequest[]) =>
  requests.map((request, index) => ({ key: request.key, value: revision(index + 1) }));

describe('Agrupación de sincronización por identidad verificada', () => {
  it('agrupa identidades distintas y reúne solo lecturas simultáneas de la misma pareja', async () => {
    const execute = vi.fn(async (requests: SyncRequest[]) => replies(requests).reverse());
    const queue = createSyncBatchQueue(execute, 1);
    const first = queue.read('student-a', 'activity');
    expect(queue.read('student-a', 'activity')).toBe(first);
    const second = queue.read('student-b', 'activity');
    expect(await first).toEqual(revision(1));
    expect(await second).toEqual(revision(2));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].map((item) => item.userId)).toEqual(['student-a', 'student-b']);
  });

  it('propaga el rechazo de un participante sin cancelar la lectura autorizada de otro', async () => {
    const queue = createSyncBatchQueue(
      async (requests) => [
        { key: requests[0].key, error: { code: '42501' } },
        { key: requests[1].key, value: revision() },
      ],
      1,
    );
    const denied = expect(queue.read('withdrawn', 'activity')).rejects.toEqual({ code: '42501' });
    const allowed = expect(queue.read('approved', 'activity')).resolves.toEqual(revision());
    await Promise.all([denied, allowed]);
  });

  it('consulta de nuevo después de terminar; no mantiene una caché de permisos o resultados', async () => {
    let calls = 0;
    const queue = createSyncBatchQueue(
      async (requests) => requests.map((item) => ({ key: item.key, value: revision(++calls) })),
      1,
    );
    expect(await queue.read('student', 'activity')).toEqual(revision(1));
    expect(await queue.read('student', 'activity')).toEqual(revision(2));
  });

  it('no entrega una respuesta sin correlación ni acepta claves repetidas', async () => {
    const queue = createSyncBatchQueue(
      async (requests) => [
        { key: requests[0].key, value: revision() },
        { key: requests[0].key, value: revision() },
      ],
      1,
    );
    await Promise.all([
      expect(queue.read('a', 'activity')).rejects.toEqual({ code: 'XX000' }),
      expect(queue.read('b', 'activity')).rejects.toEqual({ code: 'XX000' }),
    ]);
  });

  it('limita el tamaño de cada lote y procesa la cola restante', async () => {
    const execute = vi.fn(async (requests: SyncRequest[]) => replies(requests));
    const queue = createSyncBatchQueue(execute, 1, 2);
    await Promise.all([
      queue.read('a', 'activity'),
      queue.read('b', 'activity'),
      queue.read('c', 'activity'),
    ]);
    expect(execute.mock.calls.map(([requests]) => requests.length)).toEqual([2, 1]);
  });

  it('libera las lecturas tras un fallo de transporte y permite reintentar', async () => {
    const execute = vi.fn(async (requests: SyncRequest[]) => replies(requests));
    execute.mockRejectedValueOnce({ name: 'TimeoutError' });
    const queue = createSyncBatchQueue(execute, 1);
    await expect(queue.read('a', 'activity')).rejects.toEqual({ name: 'TimeoutError' });
    await expect(queue.read('a', 'activity')).resolves.toEqual(revision());
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
