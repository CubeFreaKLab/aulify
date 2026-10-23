/** Server-side policy: a production deployment never exposes the sample classroom. */
export function isDemoEnabled() {
  return process.env.VERCEL_ENV !== 'production' && process.env.AULIFY_DEMO_ENABLED !== 'false';
}
