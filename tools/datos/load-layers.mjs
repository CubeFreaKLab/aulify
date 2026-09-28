import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
const base='http://127.0.0.1:3002';
const accounts=JSON.parse(await fs.readFile('.local-private/load-accounts.json','utf8'));
const cookies=JSON.parse(await fs.readFile('.local-private/load-http-sessions.json','utf8'));
const checkpoint=JSON.parse(await fs.readFile('.local-private/protocol-confirmed.json','utf8'));
const env=Object.fromEntries((await fs.readFile('.env.local','utf8')).split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
if(env.NEXT_PUBLIC_SUPABASE_URL!=='https://bnqyyumfmyexsqszglab.supabase.co'||accounts.projectRef!=='bnqyyumfmyexsqszglab')throw new Error('Proyecto no autorizado');
const sessions=accounts.users.filter(a=>a.position<=24).map(a=>{const jar=cookies[a.id]?.cookies??{};let v=Object.entries(jar).filter(([k])=>k.includes('auth-token')).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v).join('');v=decodeURIComponent(v);if(v.startsWith('base64-'))v=Buffer.from(v.slice(7),'base64url').toString();let session;try{session=JSON.parse(v);}catch{throw new Error('Sesión privada no válida');}if(!session.access_token||session.expires_at*1000<Date.now()+120000)throw new Error('Token próximo a vencer: renovar fuera de la medición');return{role:a.role,group:a.group,cookie:Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '),jwt:session.access_token,activityId:checkpoint.activities[a.group]};});
if(sessions.length!==100)throw new Error('Escenario de cien sesiones incompleto');
const report={startedAt:new Date().toISOString(),scope:'Comparación breve de la misma RPC autorizada, directa frente a ruta HTTP local; no sustituye Q-06.',buildId:(await fs.readFile('.next/BUILD_ID','utf8')).trim(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sessionCount:100,measurements:[],records:[],limitations:['RPC directa incluye red/PostgREST/PostgreSQL; no aísla tiempo SQL.','HTTP incluye proxy, validación JWT y ruta Next.js además de RPC.','Orden alternado para reducir sesgo de calentamiento; no elimina variabilidad de red.','Tokens existentes y válidos; no se renueva ni simula autenticación durante la medición.']};
const p=(a,n)=>[...a].sort((a,b)=>a-b)[Math.ceil(a.length*n)-1];
let bytes=0;
async function request(s,layer,stage){const start=performance.now();try{
 const res=layer==='rpc'?await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/rpc/aulify_sync',{method:'POST',headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:`Bearer ${s.jwt}`,'Content-Type':'application/json'},body:JSON.stringify({p_activity_id:s.activityId}),signal:AbortSignal.timeout(15000)}):await fetch(base+`/api/sync?activity=${s.activityId}`,{headers:{Cookie:s.cookie,Origin:base,'Sec-Fetch-Site':'same-origin'},signal:AbortSignal.timeout(15000)});
 const text=await res.text();bytes+=Buffer.byteLength(text);report.records.push({layer,stage,role:s.role,status:res.status,ms:performance.now()-start,bytes:Buffer.byteLength(text)});if(res.ok){const j=JSON.parse(text);if(!/^[a-f0-9]{32}$/.test(j.revision))throw new Error('Contrato de huella inesperado');}
 }catch(e){report.records.push({layer,stage,role:s.role,status:0,ms:performance.now()-start,error:e.name});}}
try{
 await request(sessions[0],'http','warmup');await request(sessions[0],'rpc','warmup');
 for(const concurrency of [20,100])for(const layer of concurrency===20?['http','rpc']:['rpc','http']){
  if(report.stoppedAtFailureLimit)break;
  const stage=`${layer}-${concurrency}`;const jobs=Array.from({length:2},()=>sessions).flat();let i=0;const start=performance.now();
  await Promise.all(Array.from({length:concurrency},async()=>{while(i<jobs.length){const s=jobs[i++];await request(s,layer,stage);}}));
  const rows=report.records.filter(x=>x.stage===stage);const result={layer,concurrency,requests:rows.length,failed:rows.filter(x=>x.status!==200).length,elapsedMs:performance.now()-start,p50Ms:p(rows.map(x=>x.ms),.5),p95Ms:p(rows.map(x=>x.ms),.95)};report.measurements.push(result);console.log(JSON.stringify(result));if(result.failed/result.requests>.1){report.stoppedAtFailureLimit=true;break;}
 }
 report.status='completed';
}catch(e){report.status='failed';report.failure=e.message;process.exitCode=1;}finally{report.completedAt=new Date().toISOString();report.observedBodyBytes=bytes;report.conservativeEstimatedBytes=bytes*2+report.records.length*1024;const path=`docs/verificacion/datos-capas-sync-${report.startedAt.replace(/[^0-9]/g,'').slice(0,14)}.json`;await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(`Informe: ${path}`);}
