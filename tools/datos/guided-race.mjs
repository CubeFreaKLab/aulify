import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries((await fs.readFile('.env.local','utf8')).split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
if(env.NEXT_PUBLIC_SUPABASE_URL!=='https://bnqyyumfmyexsqszglab.supabase.co')throw new Error('Proyecto no autorizado.');
const accounts=JSON.parse(await fs.readFile('.local-private/load-accounts.json','utf8'));
const cookies=JSON.parse(await fs.readFile('.local-private/load-http-sessions.json','utf8'));
const fixtures=JSON.parse(await fs.readFile('.local-private/load-fixtures.json','utf8'));
const group=fixtures.groups[0];
const people=accounts.users.filter(a=>a.group===group.group&&a.position<=4);
const client = account => {
  const parts=Object.entries(cookies[account.id]?.cookies||{}).filter(([name])=>name.includes('auth-token')).sort(([a],[b])=>a.localeCompare(b)).map(([,value])=>value).join('');
  let value=decodeURIComponent(parts);if(value.startsWith('base64-'))value=Buffer.from(value.slice(7),'base64url').toString();
  let session;try{session=JSON.parse(value);}catch{throw new Error('Una sesión ficticia requiere renovación.');}
  if(!session.access_token)throw new Error('Sesión de prueba ausente.');
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{global:{headers:{Authorization:`Bearer ${session.access_token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
};
const teacher=client(people.find(p=>p.role==='teacher'));
const students=people.filter(p=>p.role==='student').map(p=>({...p,client:client(p)}));
const call=async(c,action,...args)=>{const {data,error}=await c.rpc('aulify_command',{p_action:action,p_payload:{args}});return{data,error:error?{code:error.code,message:error.message}:data?.error?{code:data.error.code,message:data.error.message}:null};};
const command=async(c,action,...args)=>{const r=await call(c,action,...args);if(r.error)throw new Error(`${action}: ${r.error.code}`);return r.data;};
const report={startedAt:new Date().toISOString(),mode:process.env.AULIFY_RACE_LABEL||'before-fix',scope:'Carrera entre respuestas de cuatro estudiantes y cierre docente de pregunta guiada',rounds:[],activities:[],unexpectedErrors:0};
if(!/^[a-z0-9-]+$/.test(report.mode))throw new Error('Etiqueta de ejecución no válida.');
const settings={purpose:'practice',pace:'guided',maxGrade:100,weight:1,countsTowardAverage:false,maxAttempts:1,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),timeLimitMinutes:null,timeZone:'America/La_Paz',feedback:'immediate',manualCorrection:false,shuffleQuestions:false,shuffleOptions:false,streaks:false,sound:false,ranking:false,teams:false,allowHint:false,allowDouble:false,bonusAffectsGrade:false,reportVisibility:false};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(let activityIndex=0;activityIndex<3;activityIndex++){
  const activity=await command(teacher,'createActivity',group.versionId,group.subjectId,settings,`Carrera guiada ${report.mode} ${activityIndex+1}`);
  report.activities.push(activity.id);
  for(const student of students)await command(student.client,'joinGuidedRoom',activity.id);
  await command(teacher,'startGuidedSession',activity.id);
  for(const student of students)student.attempt=(await command(student.client,'startAttempt',activity.id)).id;
  for(let index=0;index<10;index++){
    const question=group.questions[index],delay=index%3;
    const results=await Promise.all([
      ...students.map(async student=>{await pause(delay===0?0:delay===1?2:5);return{kind:'answer',result:await call(student.client,'submitAnswer',student.attempt,question.id,{type:'single',optionId:question.correctOptionId},crypto.randomUUID(),false)};}),
      (async()=>{await pause(delay===0?2:delay===1?0:3);return{kind:'close',result:await call(teacher,'closeGuidedQuestion',activity.id,true)};})(),
    ]);
    const row={activity:activityIndex+1,question:index+1,outcomes:results.map(r=>({kind:r.kind,code:r.result.error?.code??'OK',reason:r.result.error?.message.split(':')[0]??null}))};
    for(const outcome of row.outcomes)if(outcome.code!=='OK'&&!(outcome.kind==='answer'&&['QUESTION_CLOSED','ATTEMPT_CLOSED'].includes(outcome.reason)))report.unexpectedErrors++;
    report.rounds.push(row);
    if(results.find(r=>r.kind==='close').result.error)await command(teacher,'closeGuidedQuestion',activity.id,true);
    if(index<9)await command(teacher,'openNextGuidedQuestion',activity.id);
  }
  console.log(`Actividad de carrera ${activityIndex+1}/3 completada; errores inesperados acumulados: ${report.unexpectedErrors}.`);
}
report.completedAt=new Date().toISOString();
const path=`docs/verificacion/datos-carrera-guiada-${report.mode}.json`;
await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(`Informe: ${path}; ${report.rounds.length} rondas, ${report.unexpectedErrors} errores inesperados.`);
