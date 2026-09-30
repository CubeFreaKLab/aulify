// Lista cerrada: nunca guardar descripciones, cabeceras completas ni valores de usuario.
export function serverTiming(value) {
  if (typeof value !== 'string') return undefined;
  const result = {};
  for (const entry of value.split(',')) {
    const match = entry.trim().match(/^(prepare|rpc|encode);dur=(\d+(?:\.\d+)?)$/);
    if (match) {
      const duration = Number(match[2]);
      if (Number.isFinite(duration)) result[match[1]] = duration;
    }
  }
  return Object.keys(result).length ? result : undefined;
}
