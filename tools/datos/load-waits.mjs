// Retry-After admite segundos o una fecha HTTP; no adelantar la espera indicada.
export function retryAfterMs(value, now = Date.now()) {
  if (!value?.trim()) return 0;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? seconds * 1000 : 0;
  }
  const deadline = Date.parse(text);
  return Number.isFinite(deadline) ? Math.max(0, deadline - now) : 0;
}
