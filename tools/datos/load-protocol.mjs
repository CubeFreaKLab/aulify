import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
const base='http://127.0.0.1:3002';
const accounts=JSON.parse(await fs.readFile('.local-private/load-accounts.json','utf8'));
const fixtures=JSON.parse(await fs.readFile('.local-private/load-fixtures.json','utf8'));
const cookies=JSON.parse(await fs.readFile('.local-private/load-http-sessions.json','utf8'));
if(accounts.projectRef!=='bnqyyumfmyexsqszglab'||accounts.users.length!==204)throw new Error('Proyecto o escenario no autorizado');
const sessions=accounts.users.map(a=>({...a,jar:new Map(Object.entries(cookies[a.id]?.cookies||{})),lastRevision:null,running:null,retryMs:1000,retryAt:0,authorizationLost:false}));
const teachers=sessions.filter(a=>a.role==='teacher'),students=sessions.filter(a=>a.role==='student');
const report={startedAt:new Date().toISOString(),scope:'Diagnóstico de 60 segundos con protocolo escalonado de 204 sesiones; no es Q-06 ni contiene calentamiento/medición completa.',buildId:(await fs.readFile('.next/BUILD_ID','utf8')).trim(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sessions:204,teachers:4,students:200,pollMs:1000,seconds:60,records:[],activities:[],authentication:{prepared:0,temporaryWaits:0,spacingMs:2500},limitations:['Aplicación compilada local y base remota Free; no mide render de 204 navegadores.','Una pregunta single-choice por estudiante y sin sesión guiada.','Preparación y auditoría fuera de medición.','Consumo estimado, no contador facturable.']};
let bytes=0,measuring=false,abortReason='',skipped=0;const delay=ms=>new Promise(r=>setTimeout(r,ms));
const p95=a=>a.length?[...a].sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1]:null;
const parallel=async(items,n,fn)=>{let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const j=i++;await fn(items[j]);}}));};
const request=async(s,path,body,stage)=>{if(abortReason&&measuring)return{error:'CUTOFF'};const start=performance.now(),measurement=measuring;try{
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:[...s.jar].map(([k,v])=>`${k}=${v}`).join('; '),Origin:base,'Sec-Fetch-Site':'same-origin',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 for(const h of response.headers.getSetCookie()){const pair=h.split(';',1)[0],i=pair.indexOf('=');if(pair.slice(i+1))s.jar.set(pair.slice(0,i),pair.slice(i+1));else s.jar.delete(pair.slice(0,i));}
 const text=await response.text();bytes+=Buffer.byteLength(text);report.records.push({stage,measurement,status:response.status,ms:performance.now()-start,bytes:Buffer.byteLength(text)});
 if(2*bytes+1024*report.records.length>1e9)abortReason='Transferencia adicional estimada superior a 1 GB';
 if(!response.ok)return{error:response.status,retryAfter:response.headers.get('Retry-After')};return{data:JSON.parse(text)};
 }catch(e){report.records.push({stage,measurement,status:0,ms:performance.now()-start,error:e.name});return{error:e.name};}};
const cmd=async(s,action,args,stage='prepare')=>{const r=await request(s,'/api/commands',{action,args},stage);if(r.error)throw new Error(`${action}: ${r.error}`);return r.data.result;};
function needsRefresh(s){try{let v=[...s.jar].filter(([k])=>k.includes('auth-token')).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v).join('');v=decodeURIComponent(v);if(v.startsWith('base64-'))v=Buffer.from(v.slice(7),'base64url').toString();return(JSON.parse(v).expires_at??0)*1000<Date.now()+90000;}catch{return true;}}
const saveCookies=async()=>{for(const s of sessions)cookies[s.id]={cookies:Object.fromEntries(s.jar),savedAt:new Date().toISOString()};await fs.writeFile('.local-private/load-http-sessions.json',JSON.stringify(cookies)+'\n');};
const loop=monitorEventLoopDelay({resolution:20});let timers=[],monitor;
try{
 let previousAuth=0;const activityByGroup=new Map();
 for(const s of sessions){
  if(needsRefresh(s)){await delay(Math.max(0,2500-(Date.now()-previousAuth)));previousAuth=Date.now();}
  let ready=false;
  for(let retry=0;retry<3;retry++){
   const r=await request(s,activityByGroup.has(s.group)?`/api/workspace?activity=${activityByGroup.get(s.group)}`:'/api/workspace',undefined,'authenticationPreparation');
   if(!r.error){ready=true;if(s.role==='teacher'){const a=r.data.state.activities.filter(a=>a.settings.pace==='individual').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];if(a)activityByGroup.set(s.group,a.id);}break;}
   if(![429,503].includes(r.error))throw new Error(`Preparación ficticia: HTTP ${r.error}`);
   report.authentication.temporaryWaits++;await delay(Math.min(60000,Math.max(30000,Number(r.retryAfter||30)*1000)));
  }
  if(!ready)throw new Error('Auth permanece temporalmente indisponible; sin medición');
  report.authentication.prepared++;await saveCookies();
  if(report.authentication.prepared%25===0)console.log(`Sesiones preparadas: ${report.authentication.prepared}/204`);
 }
 const settings={purpose:'practice',pace:'individual',maxGrade:100,weight:1,countsTowardAverage:false,maxAttempts:1,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),timeLimitMinutes:null,timeZone:'America/La_Paz',feedback:'hidden',manualCorrection:false,shuffleQuestions:false,shuffleOptions:false,streaks:false,sound:false,ranking:false,teams:false,allowHint:false,allowDouble:false,bonusAffectsGrade:false,reportVisibility:false};
 for(const t of teachers){const g=fixtures.groups.find(g=>g.group===t.group);const a=await cmd(t,'createActivity',[g.versionId,g.subjectId,settings,'Diagnóstico escalonado · 60 segundos']);report.activities.push(a.id);for(const s of sessions.filter(s=>s.group===t.group))s.activityId=a.id;}
 await parallel(students,6,async s=>{s.attemptId=(await cmd(s,'startAttempt',[s.activityId])).id;});
 report.measurementStartedAt=new Date().toISOString();const began=performance.now();measuring=true;loop.enable();
 const poll=s=>{if(s.running||performance.now()>=began+60000||abortReason||s.authorizationLost||Date.now()<s.retryAt){skipped++;return;}s.running=(async()=>{
  const sync=await request(s,`/api/sync?activity=${s.activityId}`,undefined,'sync');
  let error=sync.error;
  if(!error&&s.lastRevision!==sync.data.revision){const snap=await request(s,`/api/workspace?activity=${s.activityId}`,undefined,'snapshot');error=snap.error;if(!error)s.lastRevision=sync.data.revision;}
  if(error){if(error===401||error===403)s.authorizationLost=true;s.retryAt=Date.now()+s.retryMs;s.retryMs=Math.min(8000,s.retryMs*2);}else{s.retryAt=0;s.retryMs=1000;}
 })().finally(()=>s.running=null);};
 sessions.forEach((s,i)=>timers.push(setTimeout(()=>{poll(s);timers.push(setInterval(()=>poll(s),1000));},i*1000/204)));
 monitor=setInterval(()=>{const rs=report.records.filter(x=>x.measurement);console.log(`Diagnóstico: ${Math.round((performance.now()-began)/1000)}s, ${rs.length} solicitudes, ${rs.filter(x=>x.status!==200).length} fallos.`);},15000);
 await delay(Math.max(0,began+20000-performance.now()));const acks=[],dispatches=[];
 await Promise.all(students.map(async(s,i)=>{await delay(Math.max(0,began+20000+i*1900/200-performance.now()));if(abortReason)return;const q=fixtures.groups.find(g=>g.group===s.group).questions[0],key=crypto.randomUUID();dispatches.push(performance.now());const start=performance.now();const r=await request(s,'/api/commands',{action:'submitAnswer',args:[s.attemptId,q.id,{type:'single',optionId:q.correctOptionId},key,false]},'answer');if(r.data?.result?.attempt?.answers?.some(a=>a.idempotencyKey===key))acks.push({attemptId:s.attemptId,questionId:q.id,key,ms:performance.now()-start});}));
 report.burst={target:200,dispatched:dispatches.length,windowMs:Math.max(...dispatches)-Math.min(...dispatches),confirmed:acks.length,confirmationP95Ms:p95(acks.map(x=>x.ms))};
 await delay(Math.max(0,began+60000-performance.now()));timers.forEach(clearTimeout);clearInterval(monitor);await Promise.allSettled(sessions.map(s=>s.running));measuring=false;loop.disable();report.measurementEndedAt=new Date().toISOString();report.elapsedMs=performance.now()-began;report.skippedPollTicks=skipped;
 await fs.writeFile('.local-private/protocol-confirmed.json',JSON.stringify({savedAt:new Date().toISOString(),activities:report.activities,acks})+'\n');
 const measured=report.records.filter(x=>x.measurement);if(measured.filter(x=>x.status!==200).length/measured.length>.1)abortReason ||= 'Más del 10 % de fallos técnicos en la ventana de un minuto';
 const persisted=new Map();for(const t of teachers){const r=await request(t,`/api/workspace?activity=${t.activityId}`,undefined,'audit');if(r.error)throw new Error('Auditoría no completada');for(const at of r.data.state.attempts)for(const a of at.answers)persisted.set(`${at.id}:${a.questionId}`,a.idempotencyKey);}
 report.integrity={persisted:persisted.size,confirmed:acks.length,missingOrChangedConfirmed:acks.filter(a=>persisted.get(`${a.attemptId}:${a.questionId}`)!==a.key).length};report.status=abortReason?'stopped-at-safety-limit':'completed';
}catch(e){report.status='failed';report.failure=e.message;process.exitCode=1;}finally{
 timers.forEach(clearTimeout);clearInterval(monitor);loop.disable();await saveCookies();report.completedAt=new Date().toISOString();report.abortReason=abortReason||undefined;report.observedBodyBytes=bytes;report.conservativeEstimatedBytes=2*bytes+1024*report.records.length;report.generator={node:process.version,os:os.platform(),eventLoopP95Ms:loop.percentile(95)/1e6};
 const measured=report.records.filter(x=>x.measurement);report.measurements=Object.fromEntries(['sync','snapshot','answer'].map(stage=>{const rows=measured.filter(x=>x.stage===stage);return[stage,{count:rows.length,failed:rows.filter(x=>x.status!==200).length,p95Ms:p95(rows.map(x=>x.ms))}];}));
 const path=`docs/verificacion/datos-protocolo-60s-${report.startedAt.replace(/[^0-9]/g,'').slice(0,14)}.json`;await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({path,status:report.status,burst:report.burst,integrity:report.integrity,measurements:report.measurements,failure:report.failure,abortReason}));
}
