/** Fecha mínima del próximo intento automático, según Retry-After del servidor. */
export function retryAfterDeadline(value: string | null, now = Date.now()): number {
  if (!value?.trim()) return 0;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const milliseconds = Number(text) * 1000;
    return Number.isSafeInteger(milliseconds) ? now + milliseconds : 0;
  }
  const date = Date.parse(text);
  return Number.isFinite(date) && date > now ? date : 0;
}
