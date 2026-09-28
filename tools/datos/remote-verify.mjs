import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const environment=Object.fromEntries((await fs.readFile('.env.local','utf8')).split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const url=environment.NEXT_PUBLIC_SUPABASE_URL;
const publishable=environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret=environment.SUPABASE_SECRET_KEY??environment.SUPABASE_SERVICE_ROLE_KEY;
if(url!=='https://bnqyyumfmyexsqszglab.supabase.co'||!publishable||!secret)throw new Error('Proyecto o variables de prueba no válidos.');
const client=(key)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const admin=client(secret),anon=client(publishable);
const accountPath='.local-private/remote-test-accounts.json';
const statePath='.local-private/remote-test-fixtures.json';
const reportPath='docs/verificacion/datos-remotos.json';
const report={startedAt:new Date().toISOString(),environment:'Supabase remoto, PostgreSQL 17, Auth y Storage',sdk:'@supabase/supabase-js 2.117.2',checks:[],limitations:['Cuentas ficticias confirmadas con API de administración; no se verifican entrega de correo, confirmación por SMTP ni recuperación por correo.','Las carreras cubren tres solicitudes simultáneas; no sustituyen la meta de carga de 204 usuarios.','La validación de bytes del endpoint web se verifica aparte: aquí se prueban reserva, Storage y RPC.']};
const checks=report.checks;
const record=(name,result='passed',detail)=>{checks.push({name,result,...detail?{detail}:{}});console.log(`${result==='passed'?'PASS':'INFO'} ${name}`);};
const assert=(v,name)=>{if(!v)throw new Error(name);record(name);};
async function rpc(c,name,args={}){const {data,error}=await c.rpc(name,args);if(error)throw error;if(data?.error)throw data.error;return data;}
const command=(c,action,...args)=>rpc(c,'aulify_command',{p_action:action,p_payload:{args}});
const snapshot=(c)=>rpc(c,'aulify_snapshot');
async function denied(fn,name){try{await fn();throw new Error('unexpected-success');}catch(e){if(e.message==='unexpected-success'||['42702','42703','42883','42P01'].includes(e.code))throw e;record(name,'passed',e.code??e.name??'rejected');}}
let accounts;
try{accounts=JSON.parse(await fs.readFile(accountPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;accounts={projectRef:'bnqyyumfmyexsqszglab',createdAt:new Date().toISOString(),users:{}};}
if(accounts.projectRef!=='bnqyyumfmyexsqszglab')throw new Error('Archivo de cuentas de otro proyecto.');
await fs.mkdir('.local-private',{recursive:true});
const definitions={teacher:['teacher','Ana Torres · prueba'],teacherOther:['teacher','Diego Cruz · prueba'],student:['student','Lucía Vega · prueba'],studentOther:['student','Mateo Ríos · prueba']};
const clients={};
const fixtures={runId:crypto.randomUUID(),createdAt:new Date().toISOString(),projectRef:accounts.projectRef};
try{
 for(const [key,[role,name]] of Object.entries(definitions)){
  if(!accounts.users[key]){
   const email=`aulify-${key.toLowerCase()}-${crypto.randomUUID().slice(0,8)}@example.test`;
   const password=crypto.randomBytes(24).toString('base64url')+'aA9!';
   const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name,role}});
   if(error)throw error;
   accounts.users[key]={id:data.user.id,email,password,role,name};
   await fs.writeFile(accountPath,JSON.stringify(accounts,null,2)+'\n');
  }
  const c=client(publishable);const {error}=await c.auth.signInWithPassword({email:accounts.users[key].email,password:accounts.users[key].password});if(error)throw error;clients[key]=c;
 }
 record('Cuatro cuentas ficticias y sesiones JWT independientes, sin envío de correo');
 if(process.argv.includes('--accounts-only')){report.completedAt=new Date().toISOString();await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');process.exit(0);}
 const {teacher,teacherOther,student,studentOther}=clients;
 await denied(()=>snapshot(anon),'Anónimo no obtiene snapshot');
 await denied(()=>command(anon,'createSubject',{}),'Anónimo no ejecuta comandos');
 await denied(()=>rpc(student,'aulify_maintenance',{p_action:'tick',p_payload:{}}),'Estudiante no ejecuta mantenimiento');
 const changed=await student.auth.updateUser({data:{role:'teacher'}});if(changed.error)throw changed.error;
 assert((await snapshot(student)).state.users.find(x=>x.id===accounts.users.student.id).role==='student','Cambiar user_metadata no cambia el rol de producto');
 await denied(()=>command(student,'createSubject',{name:'Materia ajena',course:'3.º',year:2026,description:''}),'Metadata manipulada no concede permisos docentes');
 await student.auth.updateUser({data:{role:'student'}});
 const subject=await command(teacher,'createSubject',{name:'Biología · recorrido integrado',course:'3.º A',year:2026,description:'Contenido ficticio para comprobar Aulify.'});fixtures.subjectId=subject.id;
 let ts=await snapshot(teacher);const code=ts.state.subjects.find(x=>x.id===subject.id).code;
 const request=await command(student,'requestMembership',code);const otherRequest=await command(studentOther,'requestMembership',code);
 assert(request.status==='pending','Solicitar código deja pendiente sin aprobación automática');
 await denied(()=>command(teacherOther,'decideMembership',request.id,'approved'),'Docente ajeno no aprueba solicitudes');
 await command(teacher,'decideMembership',request.id,'approved');await command(teacher,'decideMembership',otherRequest.id,'approved');
 record('Dos estudiantes aprobados, membresías separadas');
 const id=()=>crypto.randomUUID(),opts=(texts=['Opción A','Opción B'])=>texts.map(text=>({id:id(),text}));
 const a=opts(['Clorofila','Hemoglobina']),b=opts(['Luz','Agua']),l=opts(['Raíz','Hoja']),r=opts(['Absorbe agua','Capta luz']),o=opts(['Germinación','Crecimiento']),g=opts(['Oxígeno','Helio']),blank=id(),textBlank=id();
 const questions=[
  {id:id(),type:'single',prompt:'¿Qué pigmento permite captar la luz?',points:2,options:a,correctOptionId:a[0].id,hint:'Piensa en el color verde.',explanation:'La clorofila capta energía luminosa.'},
  {id:id(),type:'multiple',prompt:'Selecciona los recursos utilizados por la planta.',points:3,options:b,correctOptionIds:b.map(x=>x.id)},
  {id:id(),type:'true-false',prompt:'La fotosíntesis libera oxígeno.',points:2,correct:true},
  {id:id(),type:'matching',prompt:'Relaciona estructura y función.',points:2,left:l,right:r,pairs:{[l[0].id]:r[0].id,[l[1].id]:r[1].id}},
  {id:id(),type:'ordering',prompt:'Ordena las etapas.',points:2,items:o,correctOrder:o.map(x=>x.id)},
  {id:id(),type:'fill-options',prompt:'Completa la afirmación.',points:2,template:`La planta libera {${blank}}.`,blanks:[{id:blank,options:g,correctOptionId:g[0].id}]},
  {id:id(),type:'fill-text',prompt:'Nombra un recurso necesario.',points:2,template:`La planta necesita {${textBlank}}.`,blanks:[{id:textBlank,label:'recurso'}],manual:true,manualGuide:'Aceptar explicación pertinente sobre agua o luz.'},
  {id:id(),type:'open',prompt:'Explica por qué la fotosíntesis es importante.',points:5,manual:true,manualGuide:'Valorar relación entre energía, alimento y oxígeno.'},
 ];
 const answers=[{type:'single',optionId:a[0].id},{type:'multiple',optionIds:b.map(x=>x.id)},{type:'true-false',value:true},{type:'matching',pairs:questions[3].pairs},{type:'ordering',itemIds:o.map(x=>x.id)},{type:'fill-options',choices:{[blank]:g[0].id}},{type:'fill-text',texts:{[textBlank]:'agua'}},{type:'open',text:'Produce alimento para las plantas y libera oxígeno.'}];
 const draft={id:id(),title:'La fotosíntesis paso a paso',kind:'quiz',blocks:[{id:id(),type:'heading',text:'La energía de las plantas',level:2},{id:id(),type:'text',text:'Las plantas transforman energía luminosa en energía química. Revisa la explicación y participa.'},{id:id(),type:'quiz',questions}],ownerId:accounts.users.teacher.id,revision:1,updatedAt:new Date().toISOString()};
 fixtures.resourceId=draft.id;fixtures.questions=questions;fixtures.answers=answers;
 await command(teacher,'saveDraft',draft,0);
 const competing=await Promise.allSettled([command(teacher,'saveDraft',{...draft,title:'Fotosíntesis · versión A'},1),command(teacher,'saveDraft',{...draft,title:'Fotosíntesis · versión B'},1)]);
 assert(competing.filter(x=>x.status==='fulfilled').length===1&&competing.some(x=>x.status==='rejected'&&x.reason.message.includes('REVISION_CONFLICT')),'Carrera de dos borradores acepta uno y detecta conflicto');
 const version=await command(teacher,'publishResource',draft.id);fixtures.versionId=version.id;
 assert(version.blocks.find(x=>x.type==='quiz').questions.length===8,'Ocho tipos publicados mediante RPC en tablas separadas');
 const settings={purpose:'practice',pace:'individual',maxGrade:20,weight:2,countsTowardAverage:true,maxAttempts:3,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+7*86400000).toISOString(),timeLimitMinutes:null,timeZone:'America/La_Paz',feedback:'hidden',manualCorrection:false,shuffleQuestions:false,shuffleOptions:true,streaks:false,sound:false,ranking:false,teams:false,allowHint:true,allowDouble:true,bonusAffectsGrade:true,reportVisibility:true};
 const activity=await command(teacher,'createActivity',version.id,subject.id,settings,'Práctica de fotosíntesis');fixtures.activityId=activity.id;
 const safe=await snapshot(student), serialized=JSON.stringify(safe);
 assert(!serialized.includes('correctOptionId')&&!serialized.includes('manualGuide')&&!serialized.includes('La clorofila capta energía luminosa.')&&!serialized.includes('Piensa en el color verde.'),'Snapshot estudiantil excluye soluciones, guía, explicación y pista reservadas');
 const starts=await Promise.all([command(student,'startAttempt',activity.id),command(student,'startAttempt',activity.id),command(student,'startAttempt',activity.id)]);
 assert(new Set(starts.map(x=>x.id)).size===1,'Carrera de tres inicios produce un solo intento');const attempt=starts[0];fixtures.attemptId=attempt.id;
 await denied(()=>command(studentOther,'readAttempt',attempt.id),'Estudiante no lee intento de compañero');
 await denied(()=>command(student,'submitAnswer',attempt.id,questions[1].id,answers[1],id(),false),'Servidor rechaza pregunta fuera de orden');
 const hint1=await command(student,'useHint',attempt.id,questions[0].id),hint2=await command(student,'useHint',attempt.id,questions[0].id);assert(hint1===hint2,'Pista idempotente sin doble consumo');
 const key=id();const concurrent=await Promise.all([command(student,'submitAnswer',attempt.id,questions[0].id,answers[0],key,true),command(student,'submitAnswer',attempt.id,questions[0].id,answers[0],key,true),command(student,'submitAnswer',attempt.id,questions[0].id,answers[0],key,true)]);
 assert(concurrent.every(x=>x.attempt.answers.length===1&&x.feedback===null),'Carrera de tres respuestas idénticas no duplica respuesta ni revela acierto');
 await denied(()=>command(student,'submitAnswer',attempt.id,questions[0].id,{type:'single',optionId:a[1].id},key,true),'Misma clave con contenido distinto rechazada');
 await denied(()=>command(student,'submitAnswer',attempt.id,questions[1].id,answers[1],id(),true),'Doble no puede usarse en otra pregunta');
 await command(student,'reportVisibility',attempt.id,id(),new Date().toISOString(),new Date().toISOString());
 let response;for(let i=1;i<questions.length;i++)response=await command(student,'submitAnswer',attempt.id,questions[i].id,answers[i],id(),false);
 assert(response.attempt.status==='closed','La última respuesta cierra intento individual');
 await denied(()=>command(teacher,'publishGrade',activity.id,accounts.users.student.id),'Escritura pendiente impide publicar');
 await denied(()=>command(teacher,'updateActivity',activity.id,settings),'Reglas congeladas tras iniciar');
 await command(teacher,'reviewAnswer',attempt.id,questions[6].id,2,'Respuesta válida');await command(teacher,'reviewAnswer',attempt.id,questions[7].id,4,'Puedes explicar mejor la transformación de energía.');
 const evaluation=await command(teacher,'publishGrade',activity.id,accounts.users.student.id,'Buen avance');assert(evaluation.grade===20,'Corrección y doble calculados en servidor, nota limitada al máximo');
 const results=(await snapshot(student)).studentResults[subject.id];assert(results.find(x=>x.activityId===activity.id).grade===20&&!results.find(x=>x.activityId===activity.id).reviewVisible,'Nota publicada con desglose oculto');
 assert((await snapshot(studentOther)).state.evaluations.every(x=>x.studentId===accounts.users.studentOther.id),'Notas de otro estudiante ausentes del snapshot');
 await command(teacher,'reviewIncident',attempt.id,'reviewed_no_action','Señal revisada sin sanción.');
 const guided=await command(teacher,'createActivity',version.id,subject.id,{...settings,pace:'guided',maxAttempts:1,feedback:'immediate',ranking:true,teams:true},'Sesión guiada de repaso');fixtures.guidedId=guided.id;
 await command(teacher,'autoTeams',guided.id,2);await command(student,'joinGuidedRoom',guided.id);await command(studentOther,'joinGuidedRoom',guided.id);
 await denied(()=>command(student,'startAttempt',guided.id),'Sala guiada espera inicio docente');await command(teacher,'startGuidedSession',guided.id);
 const gat=await command(student,'startAttempt',guided.id);fixtures.guidedAttemptId=gat.id;
 const immediate=await command(student,'submitAnswer',gat.id,questions[0].id,answers[0],id(),false);assert(immediate.feedback.correct===true,'Retroalimentación inmediata autorizada');
 await denied(()=>command(teacher,'closeGuidedQuestion',guided.id,false),'Cierre guiado exige confirmar respuestas pendientes');await command(teacher,'closeGuidedQuestion',guided.id,true);
 for(let i=1;i<questions.length;i++){await command(teacher,'openNextGuidedQuestion',guided.id);await command(teacher,'closeGuidedQuestion',guided.id,true);}
 assert((await command(student,'readAttempt',gat.id)).closeReason==='guided-complete','Sesión finaliza normalmente y conserva omisiones');
 const ranking=await command(student,'ranking',guided.id);assert(ranking.individual.length===2&&ranking.teams.length===2&&!JSON.stringify(ranking).includes(accounts.users.studentOther.id)&&!JSON.stringify(ranking).includes('@'),'Clasificación muestra alias y equipos sin identidades ni correos');
 await command(teacher,'publishGrade',guided.id,accounts.users.student.id);await command(teacher,'publishGrade',guided.id,accounts.users.studentOther.id);
 const task=await command(teacher,'createTask',{subjectId:subject.id,title:'Mapa conceptual de las plantas',instructions:'Adjunta tu mapa en PDF o imagen.',opensAt:settings.opensAt,closesAt:settings.closesAt,maxGrade:20,weight:1,countsTowardAverage:true,allowLate:false});fixtures.taskId=task.id;
 const fileId=id(),bytes=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'),mime='application/pdf',name='mapa-conceptual-prueba.pdf';fixtures.fileId=fileId;
 await denied(()=>rpc(student,'aulify_reserve_upload',{p_owner:accounts.users.student.id,p_id:fileId,p_name:name,p_purpose:'submission',p_size:bytes.length,p_mime:mime}),'Estudiante no llama reserva privilegiada directamente');
 const reserve=await rpc(admin,'aulify_reserve_upload',{p_owner:accounts.users.student.id,p_id:fileId,p_name:name,p_purpose:'submission',p_size:bytes.length,p_mime:mime});
 const signedUpload=await admin.storage.from(reserve.bucket).createSignedUploadUrl(reserve.path,{upsert:false});if(signedUpload.error)throw signedUpload.error;
 const uploaded=await anon.storage.from(reserve.bucket).uploadToSignedUrl(reserve.path,signedUpload.data.token,bytes,{contentType:mime});if(uploaded.error)throw uploaded.error;record('Carga directa con URL firmada a bucket privado');
 const downloaded=await admin.storage.from(reserve.bucket).download(reserve.path);if(downloaded.error)throw downloaded.error;
 const received=Buffer.from(await downloaded.data.arrayBuffer());assert(received.equals(bytes),'Bytes descargados para validación coinciden con la carga');
 const registered=await rpc(admin,'aulify_register_file',{p_owner:accounts.users.student.id,p_id:fileId,p_name:name,p_mime:mime,p_size:bytes.length,p_sha256:crypto.createHash('sha256').update(received).digest('hex')});
 const submission=await command(student,'submitTask',task.id,[registered],'Mapa de práctica',id());fixtures.submissionId=submission.id;
 await denied(async()=>{const r=await studentOther.storage.from(reserve.bucket).download(reserve.path);if(r.error)throw r.error;},'Storage RLS niega descarga a compañero');
 await denied(async()=>{const r=await anon.storage.from(reserve.bucket).download(reserve.path);if(r.error)throw r.error;},'Storage niega descarga anónima');
 await denied(()=>rpc(teacherOther,'aulify_file',{p_id:fileId}),'RPC de archivo niega docente ajeno');
 const privateFile=await rpc(teacher,'aulify_file',{p_id:fileId});const signed=await teacher.storage.from(privateFile.bucket).createSignedUrl(privateFile.path,60);if(signed.error)throw signed.error;
 assert((await fetch(signed.data.signedUrl)).ok,'Docente autorizado puede descargar mediante URL temporal');
 await command(teacher,'reviewTask',submission.id,18,'Mapa claro.');await command(teacher,'publishTaskGrade',submission.id);
 await denied(()=>command(student,'submitTask',task.id,[registered],'Cambio sin permiso',id()),'Tarea corregida requiere autorización de reentrega');
 await command(teacher,'allowResubmission',task.id,accounts.users.student.id,settings.closesAt,'Revisa los conceptos.');
 const nextSubmission=await command(student,'submitTask',task.id,[registered],'Mapa revisado',id());assert(nextSubmission.version===2,'Reentrega conserva la primera versión y su nota');
 const manual=await command(teacher,'createManualActivity',{subjectId:subject.id,title:'Participación en clase',description:'Explicación oral.',occursAt:new Date().toISOString(),maxGrade:100,weight:1,countsTowardAverage:true});fixtures.manualId=manual.id;
 await command(teacher,'gradeManual',manual.id,accounts.users.student.id,90,'Participación clara.',null,true);record('Actividad manual con publicación individual');
 await command(teacher,'archiveSubject',subject.id);await denied(()=>command(student,'readActivity',activity.id),'Archivo revoca el acceso a actividades');await command(teacher,'restoreSubject',subject.id);assert((await snapshot(student)).state.subjects.some(x=>x.id===subject.id),'Restauración devuelve acceso sin reabrir intentos');
 const membership=(await snapshot(teacher)).state.memberships.find(x=>x.subjectId===subject.id&&x.studentId===accounts.users.student.id&&x.status==='approved');
 const second=await command(student,'startAttempt',activity.id);await command(teacher,'withdrawMembership',membership.id,'Prueba de revocación');
 await denied(()=>rpc(student,'aulify_file',{p_id:fileId}),'Retiro revoca consulta del archivo de tarea');await command(teacher,'resolveAttempt',second.id,'exclude','Conservar prueba sin afectar la nota publicada.');
 const freshCode=(await snapshot(teacher)).state.subjects.find(x=>x.id===subject.id).code;const rejoin=await command(student,'requestMembership',freshCode);await command(teacher,'decideMembership',rejoin.id,'approved');
 assert((await command(student,'readActivity',activity.id)).attemptsRemaining===1,'Reingreso mantiene oportunidades consumidas');
 record('Fixture queda activo, dos docentes y dos estudiantes conservados para E2E');
 report.status='passed';report.completedAt=new Date().toISOString();
}catch(error){
 report.status='failed';report.failedAt=new Date().toISOString();report.failure={code:error.code??'ERROR',message:error.message};
 console.error(`FAIL ${report.failure.code}: ${report.failure.message}`);process.exitCode=1;
}finally{
 await fs.writeFile(statePath,JSON.stringify(fixtures,null,2)+'\n');await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(`REPORT ${checks.length} comprobaciones; estado ${report.status??'setup'}; credenciales solo en archivo local excluido.`);
}
