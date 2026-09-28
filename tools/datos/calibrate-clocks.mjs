import fs from 'node:fs/promises';

const accounts = JSON.parse(await fs.readFile('.local-private/load-accounts.json', 'utf8'));
const fixtures = JSON.parse(await fs.readFile('.local-private/protocol-confirmed.json', 'utf8'));
const cookies = JSON.parse(await fs.readFile('.local-private/load-http-sessions.json', 'utf8'));
if (accounts.projectRef !== 'bnqyyumfmyexsqszglab') throw new Error('Proyecto inesperado');
const teacher = accounts.users.find(u => u.role === 'teacher' && u.group === 0);
const cookie = Object.entries(cookies[teacher.id].cookies).map(([k, v]) => `${k}=${v}`).join('; ');
const report = { measuredAt: new Date().toISOString(), meaning: 'Desfase estimado servidor menos Windows; límites incluyen el viaje HTTP, sin asumir simetría de red.', samples: [] };
for (let i = 0; i < 3; i++) {
  const sent = Date.now();
  const response = await fetch(`http://127.0.0.1:3002/api/sync?activity=${fixtures.activities[0]}`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  const received = Date.now(), server = Date.parse(data.serverTime);
  if (!response.ok || !Number.isFinite(server)) throw new Error(`Respuesta no válida HTTP ${response.status}`);
  report.samples.push({ localSentAt: new Date(sent).toISOString(), localReceivedAt: new Date(received).toISOString(), serverTime: data.serverTime, roundTripMs: received - sent, estimatedOffsetMs: server - (sent + received) / 2, offsetLowerBoundMs: server - received, offsetUpperBoundMs: server - sent });
  await new Promise(resolve => setTimeout(resolve, 200));
}
const path = `docs/verificacion/datos-relojes-${report.measuredAt.replace(/[^0-9]/g, '').slice(0, 14)}.json`;
await fs.writeFile(path, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ path, ...report }));
