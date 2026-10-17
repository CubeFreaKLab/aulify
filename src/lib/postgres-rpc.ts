import { escapeLiteral, type PoolClient, type QueryResult } from 'pg';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type UserDatabaseOperation = 'command' | 'activity' | 'overview';
export type DatabaseOperation = UserDatabaseOperation | 'sync';
export type DatabaseFailure = { code: string; message: string };

/** Fixed RPCs only. Every value uses the driver's PostgreSQL literal escaping. */
export function databaseRpcSql(
  operation: DatabaseOperation,
  userId: string | null,
  args: unknown[],
) {
  if (operation !== 'sync' && (!userId || !uuid.test(userId))) throw new Error('INVALID_IDENTITY');
  const literal = (value: unknown) => {
    const json = JSON.stringify(value);
    if (json === undefined || json.includes('\u0000')) throw new Error('INVALID_PAYLOAD');
    return `${escapeLiteral(json)}::jsonb`;
  };
  let call: string;
  switch (operation) {
    case 'command':
      if (args.length !== 2 || typeof args[0] !== 'string') throw new Error('INVALID_PAYLOAD');
      call = `public.aulify_command(${escapeLiteral(args[0])},${literal(args[1])})`;
      break;
    case 'activity':
      if (args.length !== 1 || typeof args[0] !== 'string' || !uuid.test(args[0]))
        throw new Error('INVALID_ACTIVITY');
      call = `public.aulify_activity_snapshot(${escapeLiteral(args[0])}::uuid)`;
      break;
    case 'overview':
      if (args.length) throw new Error('INVALID_PAYLOAD');
      call = 'public.aulify_workspace_overview()';
      break;
    case 'sync':
      if (userId !== null || args.length !== 1 || !Array.isArray(args[0]))
        throw new Error('INVALID_PAYLOAD');
      call = `public.aulify_service_sync_batch(${literal(args[0])})`;
      break;
    default:
      throw new Error('INVALID_OPERATION');
  }
  const role = operation === 'sync' ? 'service_role' : 'authenticated';
  const claims = { sub: userId, role };
  // One round trip, unnamed simple-query protocol (Supavisor transaction mode).
  // LOCAL role, claims and limits are reset on COMMIT or ROLLBACK. No session identity.
  return `BEGIN;
SET LOCAL ROLE ${role};
SET LOCAL statement_timeout='8s';
SET LOCAL lock_timeout='8s';
SET LOCAL idle_in_transaction_session_timeout='12s';
SELECT set_config('request.jwt.claims',${escapeLiteral(JSON.stringify(claims))},true),
       set_config('request.jwt.claim.sub','',true);
SELECT ${call} AS value;
COMMIT;`;
}

export function databaseFailure(error: unknown): DatabaseFailure {
  const code = error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined;
  const message = error && typeof error === 'object' ? Reflect.get(error, 'message') : undefined;
  // Only SQLSTATE and a closed application error token leave the driver boundary.
  // Connection strings, server detail, SQL, stack traces and constraint data never do.
  return {
    code: typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : '08006',
    message: typeof message === 'string' ? /^[A-Z][A-Z_]+\b/.exec(message)?.[0] || '' : '',
  };
}

type DatabaseLease = Pick<PoolClient, 'query' | 'release'>;
export async function executeDatabaseRpc<T = unknown>(
  lease: DatabaseLease,
  operation: DatabaseOperation,
  userId: string | null,
  args: unknown[],
): Promise<{ data: T | null; error: DatabaseFailure | null; status: number }> {
  try {
    const result = (await lease.query(
      databaseRpcSql(operation, userId, args),
    )) as unknown as QueryResult[];
    // The returned projection is not an acknowledgement until COMMIT also succeeds.
    if (
      !Array.isArray(result) ||
      result.at(-1)?.command !== 'COMMIT' ||
      result.at(-2)?.command !== 'SELECT' ||
      result.at(-2)?.rows.length !== 1
    )
      throw { code: '08006' };
    const data = result.at(-2)!.rows[0].value as T;
    lease.release();
    return { data, error: null, status: 200 };
  } catch (error) {
    // Destroy the lease: an aborted or uncertain transaction never returns to the pool.
    // There is no automatic write retry or fallback to a second transport.
    lease.release(true);
    return { data: null, error: databaseFailure(error), status: 0 };
  }
}
