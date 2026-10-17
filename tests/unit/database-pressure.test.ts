import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { databaseRpc } from '../../src/lib/supabase/database';

const mocks = vi.hoisted(() => ({ connect: vi.fn(), execute: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@vercel/functions', () => ({ attachDatabasePool: vi.fn() }));
vi.mock('@/lib/postgres-rpc', async () => ({
  ...(await import('../../src/lib/postgres-rpc')),
  executeDatabaseRpc: mocks.execute,
}));
vi.mock('pg', async () => ({
  ...(await vi.importActual('pg')),
  Pool: class {
    totalCount = 2;
    idleCount = 0;
    waitingCount = 3;
    connect = mocks.connect;
    on() {}
  },
}));

describe('Diagnóstico de espera sin datos privados', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, Symbol.for('aulify.postgres.pools'));
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');
    vi.stubEnv(
      'AULIFY_DATABASE_URL',
      'postgresql://postgres.example:private-password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
    );
    vi.stubEnv('VERCEL', '0');
    mocks.connect.mockReset();
    mocks.execute.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(globalThis, Symbol.for('aulify.postgres.pools'));
  });
  it('identifica la espera de conexión sin registrar la excepción ni su contraseña', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.connect.mockRejectedValue(
      new Error('private-password: timeout exceeded when trying to connect'),
    );
    const result = await databaseRpc('command', 'private-user', ['private-answer']);
    expect(result.error?.code).toBe('08006');
    expect(log).toHaveBeenCalledWith(
      'aulify.database.pressure',
      expect.objectContaining({ stage: 'acquire', waiting: 3, code: '08006' }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /private-password|private-user|private-answer/,
    );
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('distingue un fallo al ejecutar SQL de uno al obtener la conexión', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.connect.mockResolvedValue({});
    mocks.execute.mockResolvedValue({
      data: null,
      error: { code: '57014', message: '' },
      status: 0,
    });
    await databaseRpc('activity', 'private-user', ['private-activity']);
    expect(log).toHaveBeenCalledWith(
      'aulify.database.pressure',
      expect.objectContaining({ operation: 'activity', stage: 'query', code: '57014' }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-user|private-activity/);
  });
});
