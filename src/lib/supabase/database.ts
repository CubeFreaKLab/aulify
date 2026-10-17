import 'server-only';
import { Pool } from 'pg';
import { databaseFailure, executeDatabaseRpc, type DatabaseOperation } from '@/lib/postgres-rpc';
import { supabaseConfig } from './config';
import { SUPABASE_POSTGRES_CA } from './postgres-ca';

let pools: { read: Pool; command: Pool } | null = null;
export const hasDatabaseTransport = () => Boolean(process.env.AULIFY_DATABASE_URL);

function databasePools() {
  if (pools) return pools;
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
  const create = () => {
    const pool = new Pool({
      host: connection.hostname,
      port: 6543,
      database: 'postgres',
      user: decodeURIComponent(connection.username),
      password: decodeURIComponent(connection.password),
      ssl: { rejectUnauthorized: true, ca: SUPABASE_POSTGRES_CA },
      application_name: 'aulify-server',
      max: 4,
      connectionTimeoutMillis: 6_000,
      idleTimeoutMillis: 10_000,
      maxLifetimeSeconds: 180,
      query_timeout: 12_000,
      allowExitOnIdle: true,
    });
    pool.on('error', () => {
      console.warn('aulify.database.idle_connection_closed');
    });
    return pool;
  };
  pools = { read: create(), command: create() };
  return pools;
}

/** Called only after getClaims verified the HTTP session, or by the server-only sync queue. */
export async function databaseRpc<T = unknown>(
  operation: DatabaseOperation,
  userId: string | null,
  args: unknown[],
) {
  try {
    const pool = databasePools()[operation === 'command' ? 'command' : 'read'];
    const lease = await pool.connect();
    return await executeDatabaseRpc<T>(lease, operation, userId, args);
  } catch (error) {
    return { data: null, error: databaseFailure(error), status: 0 };
  }
}
