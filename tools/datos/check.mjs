import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
process.on('unhandledRejection',e=>{console.error(`FAIL: ${e.message}\n${e.internalQuery??''}\n${e.where??''}`);process.exit(1);});
process.on('uncaughtException',e=>{console.error(`FAIL: ${e.message}\n${e.internalQuery??''}\n${e.where??''}`);process.exit(1);});
const {PGlite}=await import(process.env.PGLITE_MODULE ? pathToFileURL(path.resolve(process.env.PGLITE_MODULE)).href : '@electric-sql/pglite');
const db=new PGlite();
const checks=[];
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security; grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;`);
for(const f of (await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
 try{await db.exec(await fs.readFile(`supabase/migrations/${f}`,'utf8'));console.log(`APPLIED ${f}`);}catch(e){console.error(`FAILED ${f}: ${e.message}\n${e.where??''}\n${e.query?.slice(Math.max(0,Number(e.position)-180),Number(e.position)+180)??''}`);process.exit(1);}
}
const users={teacher:'10000000-0000-4000-8000-000000000001',student:'10000000-0000-4000-8000-000000000002',other:'10000000-0000-4000-8000-000000000003'};
for(const [name,id] of Object.entries(users))await db.query(`insert into auth.users values($1,$2,now(),$3)`,[id,`${name}@example.test`,{name,role:name==='student'?'student':'teacher'}]);
await db.exec('set role authenticated');
const as=async(name)=>{await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[users[name]]);};
const command=async(action,...args)=>(await db.query('select public.aulify_command($1,$2) result',[action,{args}])).rows[0].result;
const assert=(b,msg)=>{if(!b)throw new Error(msg);checks.push({case:msg,result:'passed'});console.log(`PASS ${msg}`);};
const reject=async(fn,label)=>{try{await fn();throw new Error('unexpected-success');}catch(e){if(e.message==='unexpected-success'||['42702','42703','42883','42P01'].includes(e.code))throw e;checks.push({case:label,result:'rejected-as-expected',code:e.code});console.log(`PASS rechazo ${label}: ${e.message.split(':')[0]}`);}};
if(process.argv.includes('--compile-only'))process.exit(0);
await as('teacher');
const subject=await command('createSubject',{name:'Biología',course:'3.º A',year:2026,description:'Datos ficticios'});
assert(subject.id,'crear materia');
let snapshot=(await db.query('select public.aulify_snapshot() result')).rows[0].result;
assert(snapshot.state.subjects.length===1,'snapshot docente');
const code=snapshot.state.subjects[0].code;
await as('student');
const request=await command('requestMembership',code); assert(request.status==='pending','solicitar sin acceso');
await reject(()=>command('archiveSubject',subject.id),'estudiante no archiva');
await as('other');await reject(()=>command('decideMembership',request.id,'approved'),'docente ajeno no aprueba');
await as('teacher');await command('decideMembership',request.id,'approved');
const id=()=>crypto.randomUUID();
const opts=()=>[{id:id(),text:'A'},{id:id(),text:'B'}];
const a=opts(),b=opts(),l=opts(),r=opts(),o=opts(),g=opts(),blank=id(),textBlank=id();
const questions=[
 {id:id(),type:'single',prompt:'Selección',points:2,options:a,correctOptionId:a[0].id,hint:'Pista privada',explanation:'Explicación privada'},
 {id:id(),type:'multiple',prompt:'Múltiple',points:3,options:b,correctOptionIds:b.map(x=>x.id)},
 {id:id(),type:'true-false',prompt:'Verdadero',points:2,correct:true},
 {id:id(),type:'matching',prompt:'Relaciones',points:2,left:l,right:r,pairs:{[l[0].id]:r[0].id,[l[1].id]:r[1].id}},
 {id:id(),type:'ordering',prompt:'Secuencia',points:2,items:o,correctOrder:o.map(x=>x.id)},
 {id:id(),type:'fill-options',prompt:'Espacios',points:2,template:`Es {${blank}}`,blanks:[{id:blank,options:g,correctOptionId:g[0].id}]},
 {id:id(),type:'fill-text',prompt:'Escritura',points:2,template:`Es {${textBlank}}`,blanks:[{id:textBlank,label:'concepto'}],manual:true,manualGuide:'Valorar concepto'},
 {id:id(),type:'open',prompt:'Explica',points:5,manual:true,manualGuide:'Valorar explicación'},
];
const answers=[{type:'single',optionId:a[0].id},{type:'multiple',optionIds:b.map(x=>x.id)},{type:'true-false',value:true},{type:'matching',pairs:questions[3].pairs},{type:'ordering',itemIds:o.map(x=>x.id)},{type:'fill-options',choices:{[blank]:g[0].id}},{type:'fill-text',texts:{[textBlank]:'Respuesta escrita'}},{type:'open',text:'Explicación del estudiante'}];
const draft={id:id(),ownerId:users.teacher,title:'Fotosíntesis',kind:'quiz',blocks:[{id:id(),type:'quiz',questions}],revision:1,updatedAt:new Date().toISOString()};
await command('saveDraft',draft,0);
await command('saveDraft',draft,1);
await reject(()=>command('saveDraft',draft,1),'conflicto de borrador');
const version=await command('publishResource',draft.id); assert(version.blocks[0].questions.length===8,'ocho tipos publicados en filas');
const settings={purpose:'practice',pace:'individual',maxGrade:20,weight:2,countsTowardAverage:true,maxAttempts:3,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),timeLimitMinutes:null,timeZone:'America/La_Paz',feedback:'hidden',manualCorrection:false,shuffleQuestions:false,shuffleOptions:true,streaks:false,sound:false,ranking:false,teams:false,allowHint:true,allowDouble:true,bonusAffectsGrade:true,reportVisibility:true};
const activity=await command('createActivity',version.id,subject.id,settings,'Práctica'); assert(activity.id,'crear actividad');
await as('student');
snapshot=(await db.query('select public.aulify_snapshot() result')).rows[0].result;
const serialized=JSON.stringify(snapshot);
assert(!serialized.includes('correctOptionId')&&!serialized.includes('manualGuide')&&!serialized.includes('Explicación privada')&&!serialized.includes('Pista privada'),'snapshot no filtra soluciones/guías/pistas');
const attempt=await command('startAttempt',activity.id); const same=await command('startAttempt',activity.id);assert(attempt.id===same.id,'inicio idempotente recupera intento');
await reject(()=>command('submitAnswer',attempt.id,questions[1].id,answers[1],id(),false),'orden de pregunta');
await command('useHint',attempt.id,questions[0].id);await command('useHint',attempt.id,questions[0].id);
const key=id(); let response=await command('submitAnswer',attempt.id,questions[0].id,answers[0],key,true);assert(response.feedback===null,'acierto oculto no se filtra');
await command('submitAnswer',attempt.id,questions[0].id,answers[0],key,true);
await reject(()=>command('submitAnswer',attempt.id,questions[0].id,{type:'single',optionId:a[1].id},key,true),'idempotencia con contenido distinto');
await reject(()=>command('submitAnswer',attempt.id,questions[1].id,answers[1],id(),true),'doble consumo único');
for(let i=1;i<questions.length;i++)response=await command('submitAnswer',attempt.id,questions[i].id,answers[i],id(),false);
assert(response.attempt.status==='closed','cierre última pregunta');
await command('reportVisibility',attempt.id,id(),new Date().toISOString());
await as('teacher');
await reject(()=>command('updateActivity',activity.id,settings),'reglas congeladas');
await reject(()=>command('publishGrade',activity.id,users.student),'escritura pendiente impide publicar');
await command('reviewAnswer',attempt.id,questions[6].id,2,'Correcto');
await command('reviewAnswer',attempt.id,questions[7].id,4,'Falta detalle');
const evaluation=await command('publishGrade',activity.id,users.student);assert(evaluation.grade===20,'nota con doble limitada al máximo');
await as('student');
snapshot=(await db.query('select public.aulify_snapshot() result')).rows[0].result;
assert(snapshot.studentResults[subject.id][0].reviewVisible===false&&snapshot.studentResults[subject.id][0].grade===20,'nota publicada sin soluciones ocultas');
await reject(()=>db.query('select * from app.question_secrets'),'sin SELECT de soluciones');
await reject(()=>db.query('select app.question_json($1,$2,true)',[version.id,questions[0].id]),'sin llamada de helper privado');
await as('teacher');
const manual=await command('createManualActivity',{subjectId:subject.id,title:'Participación',description:'Observación',occursAt:new Date().toISOString(),maxGrade:100,weight:1,countsTowardAverage:true});
await command('gradeManual',manual.id,users.student,90,'Buen trabajo',null,true);
await command('archiveSubject',subject.id);
await as('student');await reject(()=>command('readActivity',activity.id),'archivo revoca acceso');
await as('teacher');await command('restoreSubject',subject.id);
await command('setHelpPreference','completed',1);
await command('updateSubject',subject.id,{name:'Biología 2026',course:'3.º A',year:2026,description:'Actualizada'});
await command('renewCode',subject.id,true);
// Sesión guiada: sin inicio por estudiante; orden y cierre controlados por docente.
const guided=await command('createActivity',version.id,subject.id,{...settings,pace:'guided',maxAttempts:1,feedback:'immediate',ranking:true,teams:true},'Sesión guiada');
await command('configureTeams',guided.id,[{name:'Equipo verde',studentIds:[users.student]}]);
await command('autoTeams',guided.id,1);
await as('student'); await command('joinGuidedRoom',guided.id); await reject(()=>command('startAttempt',guided.id),'guiada espera inicio docente');
await as('teacher');await command('startGuidedSession',guided.id);
await as('student');const gat=await command('startAttempt',guided.id);
const immediate=await command('submitAnswer',gat.id,questions[0].id,answers[0],id(),false);assert(immediate.feedback.correct===true,'retroalimentación inmediata');
await as('teacher');await command('closeGuidedQuestion',guided.id,false);await command('openNextGuidedQuestion',guided.id);
await reject(()=>command('closeGuidedQuestion',guided.id,false),'confirmar omisiones guiadas');
await command('closeGuidedQuestion',guided.id,true);
for(let i=2;i<questions.length;i++){await command('openNextGuidedQuestion',guided.id);await command('closeGuidedQuestion',guided.id,true);}
let gatFinal=await command('readAttempt',gat.id);assert(gatFinal.status==='closed'&&gatFinal.closeReason==='guided-complete','última pregunta finaliza guiada');
const ranking=await command('ranking',guided.id);assert(ranking.individual.length===1&&ranking.teams.length===1,'clasificación individual y por equipos');
await command('publishGrade',guided.id,users.student);
const task=await command('createTask',{subjectId:subject.id,title:'Mapa conceptual',instructions:'Adjunta un PDF',opensAt:settings.opensAt,closesAt:settings.closesAt,maxGrade:20,weight:1,countsTowardAverage:true,allowLate:false});
await as('student');await reject(()=>command('submitTask',task.id,[{id:id(),name:'falso.pdf',size:12,mimeType:'application/pdf'}],'Entrega falsa'),'archivo no validado');
const file=id();
await db.exec('reset role');await db.query(`insert into storage.objects(bucket_id,name,owner_id,metadata) values('aulify-files',$1,$2,$3)`,[`${users.student}/${file}`,users.student,{size:12,mimetype:'application/pdf'}]);await db.exec('set role service_role');
await db.query('select public.aulify_reserve_upload($1,$2,$3,$4,$5,$6)',[users.student,file,'mapa.pdf','submission',12,'application/pdf']);
await db.query('select public.aulify_register_file($1,$2,$3,$4,$5,$6)',[users.student,file,'mapa.pdf','application/pdf',12,'a'.repeat(64)]);
await db.exec('set role authenticated');await as('student');
const submission=await command('submitTask',task.id,[{id:file}],'Mi mapa',id());assert(submission.files.length===1,'entrega atómica con archivo validado');
await as('teacher');await command('reviewTask',submission.id,18,'Bien');await command('publishTaskGrade',submission.id);
await as('student');await reject(()=>command('submitTask',task.id,[{id:file}],'Otra entrega',id()),'reentrega requiere permiso');
await as('teacher');await command('allowResubmission',task.id,users.student,settings.closesAt,'Mejorar');
await as('student');const newer=await command('submitTask',task.id,[{id:file}],'Reentrega',id());assert(newer.version===2,'reentrega conserva versión anterior');
await db.query('select public.aulify_file($1)',[file]);
await as('other');await reject(()=>db.query('select public.aulify_file($1)',[file]),'archivo privado entre docentes');
await as('teacher');
// Retiro cierra administrativamente y la resolución no devuelve intentos.
await as('student');const second=await command('startAttempt',activity.id);await as('teacher');
snapshot=(await db.query('select public.aulify_snapshot() result')).rows[0].result;
const membership=snapshot.state.memberships.find(m=>m.studentId===users.student&&m.status==='approved');
await command('withdrawMembership',membership.id,'Prueba controlada');
await command('resolveAttempt',second.id,'exclude','Excluir intento retirado');
await as('student');await reject(()=>db.query('select public.aulify_file($1)',[file]),'retiro revoca descarga de tarea');
await as('teacher');await command('archiveSubject',subject.id);
await db.exec('reset role');await db.query("update app.subjects set archived_at=now()-interval '30 days' where id=$1",[subject.id]);await db.query("update app.purge_jobs set due_at=now() where subject_id=$1 and status='scheduled'",[subject.id]);await db.exec('set role authenticated');
await reject(()=>command('restoreSubject',subject.id),'30 días exactos impiden restaurar');
await db.exec('set role service_role');const purge=(await db.query("select public.aulify_maintenance('tick') result")).rows[0].result;
assert(purge.files.some(f=>f.id===file),'purga descubre archivo exclusivo');
await reject(()=>db.query("select public.aulify_maintenance('confirmFiles',$1)",[{ids:[file]}]),'purga no afirma borrado mientras existen bytes');
await db.exec('reset role');await db.query("delete from storage.objects where name=$1",[`${users.student}/${file}`]);await db.exec('set role service_role');await db.query("select public.aulify_maintenance('confirmFiles',$1)",[{ids:[file]}]);
await db.exec('reset role');assert((await db.query('select count(*)::int n from app.resources')).rows[0].n===1,'purga conserva biblioteca independiente');
assert((await db.query("select count(*)::int n from app.purge_jobs where status='done'")).rows[0].n===1,'trabajo de purga completado');
assert((await db.query('select count(*)::int n from app.subjects')).rows[0].n===0,'purga elimina materia');
await db.exec('set role authenticated');await as('student');
for(let i=0;i<9;i++)assert((await command('requestMembership','ZZZZZZZZ')).error.code==='CODE_INVALID',`código inválido contabilizado ${i+1}`);
assert((await command('requestMembership','ZZZZZZZZ')).error.code==='RATE_LIMIT','décimo intento adicional limitado');
await reject(()=>db.query('select public.aulify_maintenance($1,$2)',['tick',{}]),'mantenimiento no disponible al estudiante');
await reject(()=>db.query('select public.aulify_reserve_upload($1,$2,$3,$4,$5,$6)',[users.student,id(),'x.pdf','submission',1,'application/pdf']),'cliente no reserva usando privilegios de servicio');
await db.exec('reset role');
const catalog=(await db.query(`select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relkind='r'`)).rows;
assert(catalog.length===45&&catalog.every(x=>x.relrowsecurity),'RLS en las 45 tablas propias');
const publicFunctions=(await db.query(`select p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aulify_%'`)).rows;
assert(publicFunctions.length===6&&publicFunctions.every(x=>!x.prosecdef&&!x.anon),'seis wrappers públicos invoker sin ejecución anónima');
await db.exec('set role anon');
await reject(()=>db.query('select public.aulify_snapshot()'),'anon no obtiene snapshot');
await reject(()=>db.query('select public.aulify_command($1,$2)',['createSubject',{args:[]}]),'anon no ejecuta comandos');
await db.exec('reset role');
const engine=(await db.query('select version() value')).rows[0].value;
const reportIndex=process.argv.indexOf('--report');
if(reportIndex>=0)await fs.writeFile(process.argv[reportIndex+1],JSON.stringify({executedAt:new Date().toISOString(),engine,runtime:'PGlite 0.5.8',migrationFiles:(await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort(),checks,limitations:['Instancia PostgreSQL aislada en memoria.','Auth y Storage se representan mediante esquemas mínimos de prueba; no sustituye pruebas de JWT, correo, API Storage o concurrencia de producción.','No se aplicaron migraciones remotas en esta ejecución.']},null,2)+'\n');
console.log(`FINISHED ${checks.length} checks`); await db.close();
