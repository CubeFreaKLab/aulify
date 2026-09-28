import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';

const base = process.env.AULIFY_LOAD_URL || 'http://127.0.0.1:3002';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('El sondeo requiere la aplicación local autorizada.');
const accounts = JSON.parse(await fs.readFile('.local-private/load-accounts.json', 'utf8'));
const cookies = JSON.parse(await fs.readFile('.local-private/load-http-sessions.json', 'utf8'));
if (accounts.projectRef !== 'bnqyyumfmyexsqszglab') throw new Error('Proyecto incorrecto.');
const perGroup = Number(process.env.AULIFY_PROBE_STUDENTS_PER_GROUP || 1);
if(!Number.isInteger(perGroup)||perGroup<1||perGroup>50)throw new Error('El sondeo se limita a entre ocho y 204 sesiones.');
const selected = accounts.users.filter(a => a.position <= perGroup);
const sessions = selected.map(a => ({ id:a.id, role: a.role, group: a.group, jar: new Map(Object.entries(cookies[a.id]?.cookies || {})), activityId: null }));
const report = { startedAt: new Date().toISOString(), scope: 'Sondeo HTTP acotado de solo lectura; no sustituye Q-06', base, gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), buildId: (await fs.readFile('.next/BUILD_ID', 'utf8')).trim(), sessionCount: sessions.length, authentication: 'Cookies ya preparadas; no se realizan nuevos accesos', measurements: [] };
const records = [];
const percentile = (array, percentile) => [...array].sort((a, b) => a - b)[Math.ceil(array.length * percentile) - 1];
async function request(session, route, stage) {
  const start = performance.now();
  try {
    const response = await fetch(base + route, { headers: { Cookie: [...session.jar].map(([k,v]) => `${k}=${v}`).join('; '), Origin: base, 'Sec-Fetch-Site': 'same-origin' }, signal: AbortSignal.timeout(15000) });
    for (const header of response.headers.getSetCookie()) { const pair = header.split(';', 1)[0], index = pair.indexOf('='); if (pair.slice(index + 1)) session.jar.set(pair.slice(0,index), pair.slice(index+1)); else session.jar.delete(pair.slice(0,index)); }
    const text = await response.text();
    records.push({ stage, role: session.role, route: route.split('?')[0], status: response.status, ms: performance.now() - start, bytes: Buffer.byteLength(text) });
    if (!response.ok) return null;
    return JSON.parse(text);
  } catch (error) {
    records.push({ stage, role: session.role, route: route.split('?')[0], status: 0, ms: performance.now()-start, error: error.name, bytes: 0 });
    return null;
  }
}
function needsRefresh(session){
 try{let v=[...session.jar].filter(([k])=>k.includes('auth-token')).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v).join('');v=decodeURIComponent(v);if(v.startsWith('base64-'))v=Buffer.from(v.slice(7),'base64url').toString();return (JSON.parse(v).expires_at??0)*1000<Date.now()+90000;}catch{return true;}
}
let previousRenewal=0;const activityByGroup=new Map();
try {
for (const session of sessions) {
  if(needsRefresh(session)){await new Promise(r=>setTimeout(r,Math.max(0,2500-(Date.now()-previousRenewal))));previousRenewal=Date.now();report.preparationRenewals=(report.preparationRenewals||0)+1;}
  const result = await request(session, activityByGroup.has(session.group)?`/api/workspace?activity=${activityByGroup.get(session.group)}`:'/api/workspace', 'preparation');
  const activity = result?.state.activities.filter(a => a.title.startsWith('Carga individual · warmup')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  if (!activity) {report.preparationFailure={sessionIndex:sessions.indexOf(session),lastStatus:records.at(-1)?.status,activityCount:result?.state?.activities?.length??null};throw new Error('No se obtuvo una sesión válida o su actividad de prueba. No se inicia el sondeo.');}
  session.activityId = activity.id;activityByGroup.set(session.group,activity.id);
  report.preparedSessions=(report.preparedSessions||0)+1;
  if(report.preparedSessions%25===0)console.log(`Preparación de lectura: ${report.preparedSessions}/${sessions.length}`);
}
for (const route of ['/api/sync', '/api/workspace']) {
  for (const concurrency of [...new Set(sessions.length>20?[20,sessions.length]:[1,8,sessions.length])]) {
    const stage = `${route} concurrency=${concurrency}`;
    const jobs = Array.from({length: sessions.length>20?2:5}, () => sessions).flat();
    let index = 0;
    const start = performance.now();
    await Promise.all(Array.from({length:concurrency}, async () => { while(index < jobs.length) { const session=jobs[index++]; await request(session, `${route}?activity=${session.activityId}`, stage); } }));
    const measured = records.filter(r => r.stage === stage);
    const failed = measured.filter(r => r.status !== 200).length;
    report.measurements.push({ stage, concurrency, requests: measured.length, failed, elapsedMs: performance.now()-start, p50Ms: percentile(measured.map(r=>r.ms),0.5), p95Ms: percentile(measured.map(r=>r.ms),0.95), byRole: Object.fromEntries(['teacher','student'].map(role => { const subset=measured.filter(r=>r.role===role); return [role,{count:subset.length,failed:subset.filter(r=>r.status!==200).length,p95Ms:percentile(subset.map(r=>r.ms),0.95)}]; })) });
    console.log(`${stage}: ${measured.length} solicitudes, ${failed} fallos, p95=${report.measurements.at(-1).p95Ms.toFixed(2)}ms.`);
    if (failed / measured.length > 0.1) { report.stoppedAtFailureLimit = true; break; }
  }
  if (report.stoppedAtFailureLimit) break;
}
}catch(error){report.failure=error.message;report.status='failed-preparation-or-probe';process.exitCode=1;console.error(JSON.stringify(report.preparationFailure??{error:error.message}));}finally{
for(const s of sessions)cookies[s.id]={cookies:Object.fromEntries(s.jar),savedAt:new Date().toISOString()};
await fs.writeFile('.local-private/load-http-sessions.json',JSON.stringify(cookies)+'\n');
report.completedAt = new Date().toISOString();
report.records = records;
report.observedBodyBytes=records.reduce((sum,r)=>sum+r.bytes,0);
report.conservativeEstimatedBytes=report.observedBodyBytes*2+records.length*1024;
report.workspaceScope="activity";
const path = `docs/verificacion/datos-sondeo-${report.startedAt.replace(/[^0-9]/g,'').slice(0,14)}.json`;
await fs.writeFile(path, JSON.stringify(report,null,2)+'\n');
console.log(`Registro: ${path}.`);

}
