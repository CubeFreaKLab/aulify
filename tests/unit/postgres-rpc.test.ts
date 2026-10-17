import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { databaseFailure, databaseRpcSql, executeDatabaseRpc } from '../../src/lib/postgres-rpc';

const student = '11111111-1111-4111-8111-111111111111';
const activity = '22222222-2222-4222-8222-222222222222';
const lease = (result: unknown) => ({
  query: vi.fn().mockResolvedValue(result),
  release: vi.fn(),
});
const asLease = (value: ReturnType<typeof lease>) => value as unknown as PoolClient;

describe('RPC PostgreSQL con identidad limitada a la transacción', () => {
  it('usa un rol fijo, identidad verificada y controles locales antes de la RPC', () => {
    const sql = databaseRpcSql('activity', student, [activity]);
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('SET LOCAL ROLE authenticated;');
    expect(sql).toContain("SET LOCAL statement_timeout='8s';");
    expect(sql).toContain(`"sub":"${student}"`);
    expect(sql).toContain("set_config('request.jwt.claim.sub','',true)");
    expect(sql).toContain(`public.aulify_activity_snapshot('${activity}'::uuid)`);
    expect(sql.trim()).toMatch(/COMMIT;$/);
    expect(() => databaseRpcSql('activity', 'unverified', [activity])).toThrow('INVALID_IDENTITY');
    expect(() => databaseRpcSql('activity', student, ["'; COMMIT;"])).toThrow('INVALID_ACTIVITY');
  });

  it('escapa comillas y barras de los datos sin convertirlos en instrucciones SQL', () => {
    const payload = { args: ["texto '; COMMIT; SELECT pg_sleep(9); -- \\ fin", { texto: 'ñ 😀' }] };
    const sql = databaseRpcSql('command', student, ['saveDraft', payload]);
    expect(sql).toContain('E\'{"args":["texto \'\'; COMMIT;');
    expect(sql).toContain('ñ 😀');
    expect(sql).toContain("public.aulify_command('saveDraft',");
  });

  it('solo la cola de sincronización utiliza el rol del servicio', () => {
    const sql = databaseRpcSql('sync', null, [
      [{ key: 'x', userId: student, activityId: activity }],
    ]);
    expect(sql).toContain('SET LOCAL ROLE service_role;');
    expect(sql).toContain('public.aulify_service_sync_batch(');
    expect(() => databaseRpcSql('sync', student, [[]])).toThrow('INVALID_PAYLOAD');
    expect(() => databaseRpcSql('command', null, ['saveDraft', {}])).toThrow('INVALID_IDENTITY');
  });

  it('entrega una confirmación solamente después del COMMIT y libera la conexión', async () => {
    const value = { attempt: { id: 'saved' } };
    const client = lease([
      { command: 'BEGIN', rows: [] },
      { command: 'SELECT', rows: [{ value }] },
      { command: 'COMMIT', rows: [] },
    ]);
    await expect(
      executeDatabaseRpc(asLease(client), 'command', student, ['submitAnswer', { args: [] }]),
    ).resolves.toEqual({ data: value, error: null, status: 200 });
    expect(client.release).toHaveBeenCalledExactlyOnceWith();
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('no entrega un resultado previo si el cierre de la transacción falla', async () => {
    const client = lease([
      { command: 'SELECT', rows: [{ value: { attempt: { id: 'uncommitted' } } }] },
    ]);
    const result = await executeDatabaseRpc(asLease(client), 'command', student, [
      'submitAnswer',
      { args: [] },
    ]);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('08006');
    expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('destruye una conexión fallida sin reenviar la escritura ni filtrar datos del error', async () => {
    const client = lease(null);
    client.query.mockRejectedValue({
      code: 'P0001',
      message: 'IDEMPOTENCY_CONFLICT: private detail',
      detail: 'secret',
      query: 'private SQL',
    });
    const result = await executeDatabaseRpc(asLease(client), 'command', student, [
      'submitAnswer',
      { args: [] },
    ]);
    expect(result.error).toEqual({ code: 'P0001', message: 'IDEMPOTENCY_CONFLICT' });
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(databaseFailure(new Error('password=secret'))).toEqual({ code: '08006', message: '' });
  });
});
