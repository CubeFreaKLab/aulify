import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
const base='http://127.0.0.1:3002';
const accounts=JSON.parse(await fs.readFile('.local-private/load-accounts.json','utf8'));
const fixtures=JSON.parse(await fs.readFile('.local-private/load-fixtures.json','utf8'));
const cookies=JSON.parse(await fs.readFile('.local-private/load-http-sessions.json','utf8'));
if(accounts.projectRef!=='bnqyyumfmyexsqszglab')throw new Error('Proyecto no autorizado');
const perGroup=Number(process.env.AULIFY_BURST_STUDENTS_PER_GROUP||5);
if(!Number.isInteger(perGroup)||perGroup<1||perGroup>50)throw new Error('Entre uno y cincuenta estudiantes por materia');
const sessions=accounts.users.filter(a=>a.position<=perGroup).map(a=>({...a,jar:new Map(Object.entries(cookies[a.id]?.cookies||{}))}));
const teachers=sessions.filter(a=>a.role==='teacher'),students=sessions.filter(a=>a.role==='student');
const report={startedAt:new Date().toISOString(),scope:'Sondeo HTTP de una ráfaga, sin calentamiento ni medición sostenida. No equivale a Q-06.',buildId:(await fs.readFile('.next/BUILD_ID','utf8')).trim(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),students:students.length,records:[],activities:[]};
let bytes=0;const p95=a=>a.length?[...a].sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1]:null;
const parallel=async(items,n,fn)=>{let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const j=i++;await fn(items[j]);}}));};
const request=async(s,path,body,stage)=>{const start=performance.now();try{const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:[...s.jar].map(([k,v])=>`${k}=${v}`).join('; '),Origin:base,'Sec-Fetch-Site':'same-origin',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});for(const h of response.headers.getSetCookie()){const pair=h.split(';',1)[0],i=pair.indexOf('=');if(pair.slice(i+1))s.jar.set(pair.slice(0,i),pair.slice(i+1));else s.jar.delete(pair.slice(0,i));}const text=await response.text();bytes+=Buffer.byteLength(text);report.records.push({stage,status:response.status,ms:performance.now()-start,bytes:Buffer.byteLength(text)});if(!response.ok)return{error:response.status,retryAfter:response.headers.get('Retry-After')};return{data:JSON.parse(text)};}catch(e){report.records.push({stage,status:0,ms:performance.now()-start,error:e.name});return{error:e.name};}};
const cmd=async(s,action,args,stage='prepare')=>{const r=await request(s,'/api/commands',{action,args},stage);if(r.error)throw new Error(`${action}: ${r.error}`);return r.data.result;};
try{
 report.authentication={prepared:0,waits:0,spacingMs:2500};
 let previousAuth=0;
 for(const s of sessions){
  await new Promise(r=>setTimeout(r,Math.max(0,2500-(Date.now()-previousAuth))));previousAuth=Date.now();
  let ready=false;
  for(let retry=0;retry<3;retry++){
   const r=await request(s,'/api/workspace',undefined,'authenticationPreparation');
   if(!r.error){ready=true;break;}
   if(![429,503].includes(r.error))throw new Error(`Preparación de sesión ficticia: HTTP ${r.error}`);
   report.authentication.waits++;await new Promise(resolve=>setTimeout(resolve,Math.min(60000,Math.max(30000,Number(r.retryAfter||30)*1000))));
  }
  if(!ready)throw new Error('Auth continúa temporalmente indisponible; sin ráfaga.');
  report.authentication.prepared++;
  console.log(`Sesiones de ráfaga preparadas: ${report.authentication.prepared}/${sessions.length}`);
 }
 const settings={purpose:'practice',pace:'individual',maxGrade:100,weight:1,countsTowardAverage:false,maxAttempts:1,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),timeLimitMinutes:null,timeZone:'America/La_Paz',feedback:'hidden',manualCorrection:false,shuffleQuestions:false,shuffleOptions:false,streaks:false,sound:false,ranking:false,teams:false,allowHint:false,allowDouble:false,bonusAffectsGrade:false,reportVisibility:false};
 for(const t of teachers){const group=fixtures.groups.find(g=>g.group===t.group);const activity=await cmd(t,'createActivity',[group.versionId,group.subjectId,settings,'Sondeo de respuestas · una ráfaga']);t.activityId=activity.id;report.activities.push(activity.id);for(const s of students.filter(s=>s.group===t.group))s.activityId=activity.id;}
 await parallel(students,8,async s=>{s.attemptId=(await cmd(s,'startAttempt',[s.activityId])).id;});
 const begun=performance.now(),dispatches=[],acks=[];
 await Promise.all(students.map(async(s,i)=>{await new Promise(r=>setTimeout(r,Math.max(0,begun+i*1900/students.length-performance.now())));const question=fixtures.groups.find(g=>g.group===s.group).questions[0],key=crypto.randomUUID();dispatches.push(performance.now());const start=performance.now();const r=await request(s,'/api/commands',{action:'submitAnswer',args:[s.attemptId,question.id,{type:'single',optionId:question.correctOptionId},key,false]},'answer');if(r.data?.result?.attempt?.answers?.some(a=>a.idempotencyKey===key)){acks.push({attemptId:s.attemptId,questionId:question.id,key,ms:performance.now()-start});}}));
 report.dispatchWindowMs=Math.max(...dispatches)-Math.min(...dispatches);report.confirmed=acks.length;report.confirmationP95Ms=p95(acks.map(a=>a.ms));
 const persisted=new Map();for(const t of teachers){const r=await request(t,`/api/workspace?activity=${t.activityId}`,undefined,'audit');if(r.error)throw new Error('Auditoría no completada');for(const at of r.data.state.attempts)for(const a of at.answers)persisted.set(`${at.id}:${a.questionId}`,a.idempotencyKey);}
 report.persisted=persisted.size;report.missingOrChangedConfirmed=acks.filter(a=>persisted.get(`${a.attemptId}:${a.questionId}`)!==a.key).length;report.status=report.confirmed===students.length&&report.missingOrChangedConfirmed===0?'completed':'failed';
}catch(e){report.status='failed';report.failure=e.message;process.exitCode=1;}finally{
 for(const s of sessions)cookies[s.id]={cookies:Object.fromEntries(s.jar),savedAt:new Date().toISOString()};await fs.writeFile('.local-private/load-http-sessions.json',JSON.stringify(cookies)+'\n');
 report.completedAt=new Date().toISOString();report.observedBodyBytes=bytes;report.conservativeEstimatedBytes=2*bytes+1024*report.records.length;
 const path=`docs/verificacion/datos-sondeo-respuestas-${report.startedAt.replace(/[^0-9]/g,'').slice(0,14)}.json`;await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({path,status:report.status,confirmed:report.confirmed,persisted:report.persisted,confirmationP95Ms:report.confirmationP95Ms,dispatchWindowMs:report.dispatchWindowMs,missing:report.missingOrChangedConfirmed,failure:report.failure}));
}
