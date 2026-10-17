import 'server-only';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { databaseFailure, executeDatabaseRpc, type DatabaseOperation } from '@/lib/postgres-rpc';
import { supabaseConfig } from './config';
import { SUPABASE_POSTGRES_CA } from './postgres-ca';

type DatabasePools = { read: Pool; command: Pool };
const poolKey = Symbol.for('aulify.postgres.pools');
const poolRegistry = globalThis as typeof globalThis & { [poolKey]?: DatabasePools };
export const hasDatabaseTransport = () => Boolean(process.env.AULIFY_DATABASE_URL);

function databasePools() {
  if (poolRegistry[poolKey]) return poolRegistry[poolKey];
  const { url } = supabaseConfig();
  const project = new URL(url).hostname.split('.')[0];
  const connection = new URL(process.env.AULIFY_DATABASE_URL || '');
  if (
    !['postgres:', 'postgresql:'].includes(connection.protocol) ||
    !/^aws-\d+-[a-z]+-[a-z]+-\d+\.pooler\.supabase\.com$/.test(connection.hostname) ||
    connection.port !== '6543' ||
    decodeURIComponent(connection.username) !== `postgres.${project}` ||
    !connection.password ||
    connection.pathname !== '/postgres' ||
    connection.search ||
    connection.hash
  )
    throw { code: '08006' };
  const create = (max: number) => {
    const pool = new Pool({
      host: connection.hostname,
      port: 6543,
      database: 'postgres',
      user: decodeURIComponent(connection.username),
      password: decodeURIComponent(connection.password),
      ssl: { rejectUnauthorized: true, ca: SUPABASE_POSTGRES_CA },
      application_name: 'aulify-server',
      max,
      connectionTimeoutMillis: 6_000,
      idleTimeoutMillis: 5_000,
      maxLifetimeSeconds: 180,
      query_timeout: 12_000,
      allowExitOnIdle: true,
    });
    pool.on('error', () => {
      console.warn('aulify.database.idle_connection_closed');
    });
    // Fluid can suspend a process before a normal idle timer runs. Keep its
    // cleanup alive so suspended instances do not retain pooler client slots.
    if (process.env.VERCEL === '1') attachDatabasePool(pool);
    return pool;
  };
  poolRegistry[poolKey] = { read: create(4), command: create(8) };
  return poolRegistry[poolKey];
}

/** Called only after getClaims verified the HTTP session, or by the server-only sync queue. */
export async function databaseRpc<T = unknown>(
  operation: DatabaseOperation,
  userId: string | null,
  args: unknown[],
) {
  const startedAt = performance.now();
  let pool: Pool | undefined;
  let acquiredAt: number | undefined;
  const observe = (code?: string) => {
    const finishedAt = performance.now();
    const acquireMs = Math.round((acquiredAt ?? finishedAt) - startedAt);
    const queryMs = acquiredAt === undefined ? 0 : Math.round(finishedAt - acquiredAt);
    if (code || acquireMs > 500 || queryMs > 1_000)
      console.warn('aulify.database.pressure', {
        operation,
        stage: acquiredAt === undefined ? 'acquire' : 'query',
        acquireMs,
        queryMs,
        total: pool?.totalCount ?? 0,
        idle: pool?.idleCount ?? 0,
        waiting: pool?.waitingCount ?? 0,
        code: code ?? null,
      });
  };
  try {
    pool = databasePools()[operation === 'command' ? 'command' : 'read'];
    const lease = await pool.connect();
    acquiredAt = performance.now();
    const result = await executeDatabaseRpc<T>(lease, operation, userId, args);
    observe(result.error?.code);
    return result;
  } catch (error) {
    const failure = databaseFailure(error);
    observe(failure.code);
    return { data: null, error: failure, status: 0 };
  }
}
