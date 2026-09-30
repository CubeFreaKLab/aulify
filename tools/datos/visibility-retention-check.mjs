import fs from 'node:fs/promises';
import {createHash, randomUUID as id} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

const args=process.argv.slice(2), value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const cutoff=value('--through',null), reportPath=value('--report','docs/verificacion/conservacion-senales.json');
if(cutoff!==null&&!/^\d{14}$/.test(cutoff))throw new Error('Versión de migración inválida.');
const script='tools/datos/visibility-retention-check.mjs', hash=v=>createHash('sha256').update(v).digest('hex');
const report={startedAt:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:'PGlite aislado con Auth/Storage mínimos; sin red',script:{path:script,sha256:hash(await fs.readFile(script))},migrations:[],cases:[],limitations:['No demuestra ejecución del mantenimiento remoto ni su frecuencia.','Las operaciones de usuario usan authenticated; únicamente el ajuste temporal de fixtures usa el propietario local.','La frontera de treinta días se representa con timestamps relativos a now() dentro de una transacción; no se espera treinta días reales.']};
const db=new PGlite(), teacher=id(), student=id();
let active;
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);active.checks.push({label,result:'passed'});};
const row=async(sql,args=[])=> (await db.query(sql,args)).rows[0];
const owner=()=>db.exec('reset role');
const as=async(user)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);};
const command=async(action,...args)=>(await row('select public.aulify_command($1,$2) result',[action,{args}])).result;
const tick=async()=>{await db.exec('set role service_role');return(await row("select public.aulify_maintenance('tick') result")).result;};
const scenario=async(name,fn)=>{active={name,checks:[]};report.cases.push(active);try{await fn();active.status='passed';}catch(e){active.status='failed';active.failure=e.message;process.exitCode=1;}finally{await owner();await db.exec('rollback');}console.log(`${active.status}: ${name}`);};
let subject,version;
const settings={purpose:'practice',pace:'individual',maxGrade:100,weight:1,countsTowardAverage:true,maxAttempts:1,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),timeLimitMinutes:null,timeZone:'America/La_Paz',feedback:'hidden',manualCorrection:false,shuffleQuestions:false,shuffleOptions:false,streaks:false,sound:false,ranking:false,teams:false,allowHint:false,allowDouble:false,bonusAffectsGrade:false,reportVisibility:true};
async function fixture(overrides={}){
 await as(teacher);const activity=await command('createActivity',version.id,subject.id,{...settings,...overrides},'Conservación de señales');
 await as(student);if(overrides.pace==='guided'){await command('joinGuidedRoom',activity.id);await as(teacher);await command('startGuidedSession',activity.id);await as(student);}
 const attempt=await command('startAttempt',activity.id);
 const reported=await command('reportVisibility',attempt.id,id(),new Date().toISOString(),null);
 return{activity,attempt,reported};
}
async function events(attempt){await owner();return Number((await row('select count(*) n from app.integrity_events where attempt_id=$1',[attempt.id])).n);}
try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security;grant all on storage.objects to authenticated;grant usage on schema storage to authenticated;`);
 for(const name of(await fs.readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')&&(!cutoff||n.slice(0,14)<=cutoff)).sort()){const sql=await fs.readFile(`supabase/migrations/${name}`,'utf8');await db.exec(sql);report.migrations.push({name,sha256:hash(sql)});}
 for(const [user,role]of[[teacher,'teacher'],[student,'student']])await db.query('insert into auth.users values($1,$2,now(),$3)',[user,`${role}@example.test`,{role,name:`Prueba ${role}`}]);
 await as(teacher);subject=await command('createSubject',{name:'Conservación',course:'3.º A',year:2026,description:'Fixture aislado.'});
 const snap=(await row('select public.aulify_snapshot() result')).result,code=snap.state.subjects.find(s=>s.id===subject.id).code;
 await as(student);const request=await command('requestMembership',code);await as(teacher);await command('decideMembership',request.id,'approved');
 const resource={id:id(),ownerId:teacher,title:'Recurso de prueba',kind:'quiz',revision:1,updatedAt:new Date().toISOString(),blocks:[{id:id(),type:'quiz',questions:[{id:id(),type:'true-false',prompt:'Una pregunta.',points:1,correct:true}]}]};
 await command('saveDraft',resource,0);version=await command('publishResource',resource.id);
 await scenario('Mantenimiento reservado al servicio',async()=>{
  await owner();const acl=await row("select has_function_privilege('anon','public.aulify_maintenance(text,jsonb)','execute') anon,has_function_privilege('authenticated','public.aulify_maintenance(text,jsonb)','execute') authenticated,has_function_privilege('service_role','public.aulify_maintenance(text,jsonb)','execute') service");
  equal(acl,{anon:false,authenticated:false,service:true},'La corrección no expone el mantenimiento a cuentas de usuario');
 });
 await scenario('AP-28: registro desactivado',async()=>{const f=await fixture({reportVisibility:false});equal(f.reported,false,'El comando no registra una señal');equal(await events(f.attempt),0,'No existen detalles guardados');});
 await scenario('AP-28: cierre guiado anterior al vencimiento programado',async()=>{
  const f=await fixture({pace:'guided'});equal(f.reported,true,'Señal aceptada antes del cierre');
  await as(teacher);await command('reviewIncident',f.attempt.id,'reviewed_no_action','Observación sin sanción.');await command('endGuidedSession',f.activity.id,'Cierre de prueba',true);
  await owner();await db.exec('begin');await db.query("update app.guided_sessions set started_at=now()-interval '31 days',closed_at=now()-interval '30 days'+interval '1 microsecond' where activity_id=$1",[f.activity.id]);
  await tick();equal(await events(f.attempt),1,'Un microsegundo antes del plazo conserva el detalle');
  await db.query("update app.guided_sessions set closed_at=now()-interval '30 days' where activity_id=$1",[f.activity.id]);
  await tick();equal(await events(f.attempt),0,'Exactamente a treinta días del cierre guiado elimina el detalle');
  const review=await row('select status,comment from app.incident_reviews where attempt_id=$1',[f.attempt.id]);equal(review,{status:'reviewed_no_action',comment:'Observación sin sanción.'},'Conserva únicamente la resolución docente');
  await tick();equal(await events(f.attempt),0,'La repetición no recupera señales');
 });
 await scenario('AP-28: entrega individual anticipada no cierra la actividad',async()=>{
  const f=await fixture();await owner();await db.exec('begin');await db.query("update app.attempts set started_at=now()-interval '32 days',closed_at=now()-interval '31 days',close_reason='submitted' where id=$1",[f.attempt.id]);
  await tick();equal(await events(f.attempt),1,'La actividad sigue abierta y conserva señales');
 });
 await scenario('AP-28: vencimiento general y ampliación de plazo',async()=>{
  const f=await fixture();await as(teacher);await command('extendDeadline',f.activity.id,new Date(Date.now()+7200000).toISOString(),'Ampliación de prueba',null);
  await owner();await db.exec('begin');await db.query("update app.activities set opens_at=now()-interval '32 days',closes_at=now()-interval '31 days' where id=$1",[f.activity.id]);
  await tick();equal(await events(f.attempt),1,'Una ampliación vigente conserva las señales');
  await db.query("update app.deadline_extensions set new_deadline=now()-interval '30 days' where activity_id=$1",[f.activity.id]);
  await tick();equal(await events(f.attempt),0,'Treinta días desde el plazo ampliado elimina los detalles');
 });
 report.status=report.cases.every(c=>c.status==='passed')?'passed':'failed';
}catch(e){report.status='failed';report.failure=e.message;process.exitCode=1;}finally{await db.close();report.completedAt=new Date().toISOString();report.checks=report.cases.reduce((n,c)=>n+c.checks.length,0);await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({reportPath,status:report.status,checks:report.checks}));}
