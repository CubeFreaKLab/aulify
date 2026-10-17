import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { loadTargetFromEnvironment } from './load-target.mjs';
import { openLoadEventStream } from './load-events.mjs';

const target=await loadTargetFromEnvironment(process.env.AULIFY_LOAD_URL);
await target.verifyBuild();
const accounts=JSON.parse(await fs.readFile('.local-private/load-accounts.json','utf8'));
const fixtures=JSON.parse(await fs.readFile('.local-private/load-fixtures.json','utf8'));
const cookies=JSON.parse(await fs.readFile('.local-private/load-http-sessions.json','utf8'));
assert.equal(accounts.projectRef,'bnqyyumfmyexsqszglab');
const group=fixtures.groups[0];
const teacher=accounts.users.find(u=>u.role==='teacher'&&u.group===group.group);
const students=accounts.users.filter(u=>u.role==='student'&&u.group===group.group).slice(0,2);
const outsider=accounts.users.find(u=>u.role==='student'&&u.group!==group.group);
const jar=user=>Object.entries(cookies[user.id].cookies).map(([k,v])=>`${k}=${v}`).join('; ');
const request=(user,path,body)=>target.request(path,{method:body?'POST':'GET',headers:{...(user?{Cookie:jar(user)}:{}),...(body?{'Content-Type':'application/json'}:{}),Origin:process.env.AULIFY_LOAD_URL,'Sec-Fetch-Site':'same-origin'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
const command=async(user,action,...args)=>{const r=await request(user,'/api/commands',{action,args});assert.equal(r.status,200,`Comando ${action}: HTTP ${r.status}`);return(await r.json()).result;};
const report={startedAt:new Date().toISOString(),buildId:process.env.AULIFY_EXPECTED_BUILD_ID,sourceCommit:target.metadata.sourceCommit,checks:[],limitations:['Recorrido HTTP de dos estudiantes ficticios; no es la prueba de 200 ni una prueba de navegador.']};
const check=(name)=>{report.checks.push({name,passed:true});console.log(`PASS ${name}`);};
const streams=[],events=[[],[]];
let subject;
try {
 subject=await command(teacher,'createSubject',{name:'Verificación de avisos',course:'Prueba técnica',year:2026,description:'Datos ficticios del transporte SSE'});
 const {code}=await command(teacher,'renewCode',subject.id,true);
 for(const s of students){const m=await command(s,'requestMembership',code);await command(teacher,'decideMembership',m.id,'approved');}
 const settings={purpose:'practice',pace:'guided',maxGrade:100,weight:1,countsTowardAverage:false,maxAttempts:1,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),timeLimitMinutes:null,timeZone:'America/La_Paz',feedback:'immediate',manualCorrection:false,shuffleQuestions:false,shuffleOptions:false,streaks:false,sound:false,ranking:false,teams:false,allowHint:false,allowDouble:false,bonusAffectsGrade:false,reportVisibility:false};
 const activity=await command(teacher,'createActivity',group.versionId,subject.id,settings,'Recorrido de avisos');
 for(const s of students)await command(s,'joinGuidedRoom',activity.id);
 assert.equal((await request(null,`/api/events?activity=${activity.id}`)).status,401);check('Sin sesión no se abre el flujo');
 assert.equal((await request(outsider,`/api/events?activity=${activity.id}`)).status,403);check('Una cuenta de otra materia no abre el flujo');
 for(const [index,s] of students.entries()){
  const stream=openLoadEventStream({connect:signal=>target.request(`/api/events?activity=${activity.id}`,{headers:{Cookie:jar(s)},signal}),opened:r=>assert.equal(r.status,200),failed:()=>events[index].push({event:'failure',at:performance.now()}),event:event=>events[index].push({event,at:performance.now()}),bytes:()=>{}});
  streams.push(stream);await stream.ready;
 }
 check('Dos cuentas autorizadas reciben ready');
 const started=performance.now();await command(teacher,'startGuidedSession',activity.id);
 const waitFor=async(test)=>{const deadline=Date.now()+15000;while(!test()){assert.ok(Date.now()<deadline,'No se recibió el aviso esperado');await new Promise(r=>setTimeout(r,50));}};
 await waitFor(()=>events.every(items=>items.some(item=>item.event==='changed'&&item.at>=started)));
 report.openHintMs=events.map(items=>Math.round(items.find(item=>item.event==='changed'&&item.at>=started).at-started));
 for(const s of students){const r=await request(s,`/api/workspace?activity=${activity.id}`);assert.equal(r.status,200);const data=await r.json();assert.equal(data.studentActivities[activity.id].activity.guided.questionOpen,true);assert.ok(data.studentActivities[activity.id].attempt.id);}
 check('El aviso de apertura permite leer la pregunta y el intento persistidos');
 await new Promise(r=>setTimeout(r,250));const peerBefore=events[1].filter(e=>e.event==='changed'||e.event==='revoked').length;
 const teacherView=await request(teacher,`/api/workspace?activity=${activity.id}`);assert.equal(teacherView.status,200);
 const membership=(await teacherView.json()).state.memberships.find(m=>m.studentId===students[0].id&&m.status==='approved');assert.ok(membership);
 await command(teacher,'withdrawMembership',membership.id,'Verificación controlada de revocación');
 await waitFor(()=>events[0].some(e=>e.event==='revoked'));
 assert.equal((await request(students[0],`/api/events?activity=${activity.id}`)).status,403);
 check('Retirar la matrícula cierra el flujo y rechaza una nueva conexión');
 await new Promise(r=>setTimeout(r,250));
 assert.equal(events[1].filter(e=>e.event==='changed'||e.event==='revoked').length,peerBefore);
 assert.equal((await request(students[1],`/api/workspace?activity=${activity.id}`)).status,200);
 check('La revocación no se envía al compañero ni le quita acceso');
 assert.ok(events.every(items=>!items.some(e=>e.event==='failure')));check('El recorrido no tuvo desconexiones inesperadas');
 report.passed=true;
} catch(error){report.passed=false;report.failure=error.message.replace(/https?:\/\/\S+/g,'[URL]');process.exitCode=1;console.error(report.failure);}
finally {
 await Promise.allSettled(streams.map(s=>s.stop()));
 if(subject)try{await command(teacher,'archiveSubject',subject.id);report.fixtureArchived=true;}catch{report.fixtureArchived=false;}
 report.completedAt=new Date().toISOString();
 const path='docs/verificacion/avisos-actividad-preview-20261017.json';await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(`Informe: ${path}`);
}
