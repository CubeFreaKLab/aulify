import fs from 'node:fs/promises';
import {createHash,randomUUID as id} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

const script='tools/datos/administrative-close-check.mjs', hash=v=>createHash('sha256').update(v).digest('hex');
const report={startedAt:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:'PGlite aislado; comandos de usuario como authenticated',script:{path:script,sha256:hash(await fs.readFile(script))},migrations:[],cases:[],limitations:['No acredita Auth remoto, concurrencia, interfaz ni confirmaciones visuales.','Los datos y fechas de este ensayo son ficticios; no ejecuta operaciones sobre Supabase.']};
const db=new PGlite(), teacher=id(), students=[id(),id()], questions=[0,1].map(i=>({id:id(),type:'true-false',prompt:`Pregunta ${i+1}`,points:2,correct:true,hint:'Pista de prueba.'}));
const row=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const owner=()=>db.exec('reset role');
const as=async(user)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);};
const command=async(action,...args)=>(await row('select public.aulify_command($1,$2) result',[action,{args}])).result;
const snapshot=async()=>(await row('select public.aulify_snapshot() result')).result;
let active,version;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);active.checks.push({label,result:'passed'});};
const rejected=async(fn,code,label)=>{let error;try{await fn();}catch(e){error=e;}assert.ok(error,label);assert.match(error.message,code);active.checks.push({label,result:'rejected-as-expected'});};
const scenario=async(name,fn)=>{active={name,checks:[]};report.cases.push(active);try{await fn();active.status='passed';}catch(e){active.status='failed';active.failure=e.message;process.exitCode=1;}console.log(`${active.status}: ${name}`);};
const settings={purpose:'practice',pace:'individual',maxGrade:100,weight:1,countsTowardAverage:true,maxAttempts:1,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),timeLimitMinutes:null,timeZone:'America/La_Paz',feedback:'hidden',manualCorrection:false,shuffleQuestions:false,shuffleOptions:false,streaks:false,sound:false,ranking:false,teams:false,allowHint:true,allowDouble:true,bonusAffectsGrade:false,reportVisibility:false};
async function join(subject,user,code){await as(user);const request=await command('requestMembership',code);await as(teacher);return command('decideMembership',request.id,'approved');}
async function fixture(){
 await as(teacher);const subject=await command('createSubject',{name:'Cierre administrativo',course:'3.º A',year:2026,description:'Prueba aislada.'});
 const code=(await snapshot()).state.subjects.find(s=>s.id===subject.id).code,memberships=[];
 for(const student of students)memberships.push(await join(subject,student,code));
 const activity=await command('createActivity',version.id,subject.id,settings,'Dos preguntas');
 const attempts=[];
 for(const student of students){await as(student);const attempt=await command('startAttempt',activity.id);await command('useHint',attempt.id,questions[0].id);await command('submitAnswer',attempt.id,questions[0].id,{type:'true-false',value:true},id(),true);attempts.push(attempt);}
 return{subject,code,memberships,activity,attempts};
}
async function state(attempt){await owner();return row("select at.closed_at,at.close_reason,app.attempt_score(at.id) score,(select count(*) from app.responses r join app.attempt_questions aq on aq.id=r.attempt_question_id where aq.attempt_id=at.id)::int responses,(select count(*) from app.powerup_uses where participant_id=at.participant_id)::int powerups from app.attempts at where at.id=$1",[attempt.id]);}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security;grant all on storage.objects to authenticated;grant usage on schema storage to authenticated;`);
 for(const name of(await fs.readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){const sql=await fs.readFile(`supabase/migrations/${name}`,'utf8');await db.exec(sql);report.migrations.push({name,sha256:hash(sql)});}
 for(const [index,user]of[teacher,...students].entries())await db.query('insert into auth.users values($1,$2,now(),$3)',[user,`test${index}@example.test`,{role:index?'student':'teacher',name:`Prueba ${index}`}]);
 await as(teacher);const resource={id:id(),ownerId:teacher,title:'Cierre y evaluación',kind:'quiz',revision:1,updatedAt:new Date().toISOString(),blocks:[{id:id(),type:'quiz',questions}]};await command('saveDraft',resource,0);version=await command('publishResource',resource.id);
 await scenario('AP-29: retiro, evaluación y exclusión con reingreso',async()=>{
  const f=await fixture();
  for(let i=0;i<2;i++){
   await as(teacher);await command('withdrawMembership',f.memberships[i].id,'Retiro de prueba');
   await as(students[i]);await rejected(()=>command('readAttempt',f.attempts[i].id),/MEMBERSHIP_REQUIRED/,'El retiro revoca la lectura del intento');
   await rejected(()=>command('submitAnswer',f.attempts[i].id,questions[1].id,{type:'true-false',value:true},id(),false),/MEMBERSHIP_REQUIRED/,'El retiro revoca nuevas respuestas');
   const s=await state(f.attempts[i]);equal(s.close_reason,'withdrawal','Cierre administrativo por retiro');equal(s.responses,1,'Conserva la respuesta confirmada');equal(s.score.complete,false,'No convierte un cierre administrativo en nota');equal(s.score.pending,1,'La omisión espera resolución');equal(s.powerups,2,'Conserva pista y doble consumidos');
  }
  await as(teacher);await rejected(()=>command('resolveAttempt',f.attempts[0].id,'evaluate',''),/resolution_kind/,'La resolución exige un motivo');
  await command('resolveAttempt',f.attempts[0].id,'evaluate','Evaluar lo recibido');
  const evaluated=await state(f.attempts[0]);equal(evaluated.score.complete,true,'La evaluación resuelve la omisión');equal(evaluated.score.grade,50,'Una de dos preguntas vale 50 sobre 100');equal(evaluated.responses,1,'No inventa una respuesta a la omisión');
  await as(teacher);await command('resolveAttempt',f.attempts[1].id,'exclude','Excluir esta participación');
  const excluded=await state(f.attempts[1]);equal(excluded.score.complete,false,'La exclusión no genera resultado evaluable');equal(excluded.score.pending,1,'La exclusión no asigna cero a omisiones');
  await as(teacher);await rejected(()=>command('publishGrade',f.activity.id,students[1]),/REVIEW_PENDING/,'La exclusión no permite publicar una nota ficticia');
  for(let i=0;i<2;i++){
   await join(f.subject,students[i],f.code);await as(students[i]);const visible=await command('readAttempt',f.attempts[i].id);equal(visible.status,'closed','Reingresar no reabre el intento');
   await rejected(()=>command('startAttempt',f.activity.id),/ATTEMPTS_EXHAUSTED/,'Reingresar no devuelve la oportunidad consumida');
   equal((await state(f.attempts[i])).powerups,2,'Reingresar no devuelve los potenciadores');
  }
 });
 await scenario('AP-30: archivo y restauración conservan cierre y fechas',async()=>{
  const f=await fixture();await as(teacher);await command('archiveSubject',f.subject.id);
  const closed=[];
  for(let i=0;i<2;i++){await as(students[i]);await rejected(()=>command('readAttempt',f.attempts[i].id),/MEMBERSHIP_REQUIRED/,'La materia archivada revoca acceso estudiantil');const s=await state(f.attempts[i]);closed.push(s.closed_at);equal(s.close_reason,'archive','El intento registra cierre por archivo');equal(s.score.complete,false,'Archivo deja resolución pendiente');}
  await as(teacher);await rejected(()=>command('resolveAttempt',f.attempts[0].id,'evaluate','Resolver en archivo'),/FORBIDDEN/,'Materia archivada permanece de solo lectura');await command('restoreSubject',f.subject.id);
  for(let i=0;i<2;i++){await as(students[i]);const a=await command('readActivity',f.activity.id);equal(new Date(a.activity?.settings?.closesAt??a.settings?.closesAt).toISOString(),new Date(settings.closesAt).toISOString(),'Restaurar no amplía el vencimiento');const at=await command('readAttempt',f.attempts[i].id);equal(at.status,'closed','Restaurar no reabre intentos');equal((await state(f.attempts[i])).closed_at,closed[i],'Conserva el instante de cierre');}
  await owner();equal((await row("select count(*)::int n from app.purge_jobs where subject_id=$1 and status='cancelled'",[f.subject.id])).n,1,'Cancela la purga programada al restaurar dentro del plazo');
 });
 report.status=report.cases.every(c=>c.status==='passed')?'passed':'failed';
}catch(e){report.status='failed';report.failure=e.message;process.exitCode=1;}finally{await db.close();report.completedAt=new Date().toISOString();report.checks=report.cases.reduce((n,c)=>n+c.checks.length,0);await fs.writeFile('docs/verificacion/cierres-administrativos.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks}));}
