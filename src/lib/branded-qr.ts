import { create } from 'qrcode';

/** Preserve the four-module quiet zone and use high correction for the small brand inset. */
export function brandedQrSvg(url: string, logoSvg: string): string {
  const { modules } = create(url, { errorCorrectionLevel: 'H' });
  const size = modules.size;
  const margin = 4;
  const total = size + margin * 2;
  const finders = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  let cells = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7)) continue;
      if (modules.get(y, x)) cells += `M${x + margin} ${y + margin}h1v1h-1z`;
    }
  }
  const eyes = finders
    .map(
      ([x, y]) =>
        `<g transform="translate(${x + margin} ${y + margin})"><rect width="7" height="7" rx=".7" fill="#416f35"/><rect x="1" y="1" width="5" height="5" rx=".3" fill="white"/><rect x="2" y="2" width="3" height="3" rx=".3" fill="#416f35"/></g>`,
    )
    .join('');
  const logoSize = size * 0.16;
  const center = total / 2;
  const logo = `data:image/svg+xml,${encodeURIComponent(logoSvg)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="320" height="320"><rect width="${total}" height="${total}" rx="2" fill="white"/><path d="${cells}" fill="#191919" shape-rendering="crispEdges"/>${eyes}<circle cx="${center}" cy="${center}" r="${logoSize * 0.62}" fill="white"/><image href="${logo}" x="${center - logoSize / 2}" y="${center - logoSize / 2}" width="${logoSize}" height="${logoSize}"/></svg>`;
}

export async function createBrandedQr(url: string): Promise<string> {
  const response = await fetch('/brand/aulify-symbol.svg');
  if (!response.ok) throw new Error('Logo unavailable');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(brandedQrSvg(url, await response.text()))}`;
}
