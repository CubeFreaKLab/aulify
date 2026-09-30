import fs from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';

// Tres etapas explícitas; las fechas sintéticas y el tick se controlan por SQL separado.
// Sólo borra las rutas aleatorias creadas por prepare y guardadas en el manifiesto privado.
const stage=process.argv[2];
if(!['prepare','partial','finish'].includes(stage))throw new Error('Usar prepare, partial o finish.');
const statePath='.local-private/retention-storage-remote.json';
const reportPath='docs/verificacion/conservacion-storage-remota.json';
const env=Object.fromEntries((await fs.readFile('.env.local','utf8')).split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const url=env.NEXT_PUBLIC_SUPABASE_URL;
const accounts=JSON.parse(await fs.readFile('.local-private/remote-test-accounts.json','utf8'));
if(url!=='https://bnqyyumfmyexsqszglab.supabase.co'||accounts.projectRef!=='bnqyyumfmyexsqszglab')throw new Error('Proyecto distinto del autorizado.');
const make=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const admin=make(env.SUPABASE_SECRET_KEY??env.SUPABASE_SERVICE_ROLE_KEY);
const rpc=async(client,name,args)=>{const r=await client.rpc(name,args);if(r.error)throw new Error(`${r.error.code}:${r.error.message}`);if(r.data?.error)throw new Error(r.data.error.code);return r.data;};
const command=(client,action,...args)=>rpc(client,'aulify_command',{p_action:action,p_payload:{args}});
const hash=data=>createHash('sha256').update(data).digest('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6wsAAAAAASUVORK5CYII=','base64');
let state,report;
if(stage==='prepare'){
 if(await fs.stat(statePath).then(()=>true,()=>false))throw new Error('Ya existe un manifiesto; no repetir prepare.');
 state={project:accounts.projectRef,runId:randomUUID(),stage:'preparing',teacher:accounts.users.teacher.id,student:accounts.users.student.id,files:[]};
 report={startedAt:new Date().toISOString(),environment:'Supabase remoto, PostgreSQL y Storage privados',runId:state.runId,checks:[],limitations:[
  'Cuentas ficticias existentes; no se prueba SMTP.',
  'La referencia biblioteca/entrega se siembra por SQL como topología histórica. El comando público rechaza el archivo ajeno.',
  'El vencimiento se prepara con fechas sintéticas, explícitas; no representa treinta días transcurridos.',
  'El fallo parcial se introduce omitiendo un borrado antes de confirmar, sin simular una caída del proveedor.',
  'Ejecución manual controlada; no acredita todavía el plazo de la ejecución programada ni la carrera remota restauración/purga.']};
}else{
 state=JSON.parse(await fs.readFile(statePath,'utf8'));
 report=JSON.parse(await fs.readFile(reportPath,'utf8'));
 if(state.project!==accounts.projectRef||state.runId!==report.runId)throw new Error('Manifiesto incoherente.');
}
const save=async()=>{await fs.writeFile(statePath,JSON.stringify(state,null,2)+'\n');await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');};
const pass=label=>{report.checks.push({label,result:'passed',at:new Date().toISOString()});console.log(`PASS ${label}`);};
const denied=async(fn,code,label)=>{await assert.rejects(fn,error=>error.message.includes(code));pass(label);};
async function login(role){const c=make(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??env.NEXT_PUBLIC_SUPABASE_ANON_KEY);const a=accounts.users[role];const r=await c.auth.signInWithPassword({email:a.email,password:a.password});if(r.error)throw new Error(`Auth ${r.error.status}`);return c;}
async function upload(owner,purpose,label){
 const id=randomUUID(),name=`ap31-${state.runId.slice(0,8)}-${label}.png`;
 const reservation=await rpc(admin,'aulify_reserve_upload',{p_owner:owner,p_id:id,p_name:name,p_purpose:purpose,p_size:png.length,p_mime:'image/png'});
 const file={id,name,owner,bucket:reservation.bucket,path:reservation.path,label};state.files.push(file);await save();
 assert.equal(file.bucket,'aulify-files');assert.equal(file.path,`${owner}/${id}`);
 const uploaded=await admin.storage.from(file.bucket).upload(file.path,png,{contentType:'image/png',upsert:false});if(uploaded.error)throw new Error(`Storage upload ${uploaded.error.statusCode}`);
 const registered=await rpc(admin,'aulify_register_file',{p_owner:owner,p_id:id,p_name:name,p_mime:'image/png',p_size:png.length,p_sha256:hash(png)});
 file.registered=registered;await save();return file;
}
async function read(file){const r=await admin.storage.from(file.bucket).download(file.path);if(r.error)throw new Error(`Storage read ${r.error.statusCode}`);return Buffer.from(await r.data.arrayBuffer());}
async function remove(file){
 assert.ok(state.files.some(f=>f.id===file.id&&f.path===file.path&&f.bucket===file.bucket));
 assert.equal(file.path,`${file.owner}/${file.id}`);assert.equal(file.bucket,'aulify-files');
 const r=await admin.storage.from(file.bucket).remove([file.path]);if(r.error)throw new Error(`Storage remove ${r.error.statusCode}`);
}
const confirm=ids=>rpc(admin,'aulify_maintenance',{p_action:'confirmFiles',p_payload:{ids}});
try{
 if(stage==='prepare'){
  await save();const teacher=await login('teacher'),student=await login('student');const prefix=`AP31-${state.runId.slice(0,8)}`;
  state.subject=await command(teacher,'createSubject',{name:`${prefix} vencida`,course:'3A',year:2026,description:'Fixture ficticio de conservación.'});await save();
  state.control=await command(teacher,'createSubject',{name:`${prefix} vigente`,course:'3B',year:2026,description:'Control que debe conservarse.'});await save();
  const view=await rpc(teacher,'aulify_snapshot',{});const code=view.state.subjects.find(s=>s.id===state.subject.id).code;
  const request=await command(student,'requestMembership',code);await command(teacher,'decideMembership',request.id,'approved');
  state.task=await command(teacher,'createTask',{subjectId:state.subject.id,title:`${prefix} entrega`,instructions:'Tres imágenes ficticias.',opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),maxGrade:20,weight:1,countsTowardAverage:true,allowLate:false});await save();
  const shared=await upload(state.teacher,'resource','compartido');const a=await upload(state.student,'submission','exclusivo-a');const b=await upload(state.student,'submission','exclusivo-b');
  state.resource={id:randomUUID(),ownerId:state.teacher,title:`${prefix} biblioteca`,kind:'resource',revision:1,updatedAt:new Date().toISOString(),blocks:[{id:randomUUID(),type:'image',fileId:shared.id,url:`/api/files/${shared.id}`,alt:'Punto ficticio para comprobar conservación.'}]};
  await command(teacher,'saveDraft',state.resource,0);state.version=await command(teacher,'publishResource',state.resource.id);await save();
  await denied(()=>command(student,'submitTask',state.task.id,[shared.registered],'',randomUUID()),'INVALID_FILES','El contrato de entrega rechaza el archivo de otra cuenta');
  state.submission=await command(student,'submitTask',state.task.id,[a.registered,b.registered],'Entrega ficticia propia.',randomUUID());await save();
  for(const file of state.files)assert.equal(hash(await read(file)),hash(png));pass('Tres objetos reales conservan sus bytes y metadatos');
  await command(teacher,'archiveSubject',state.subject.id);state.stage='prepared';report.status='prepared';await save();
 }else{
  const shared=state.files.find(f=>f.label==='compartido'),a=state.files.find(f=>f.label==='exclusivo-a'),b=state.files.find(f=>f.label==='exclusivo-b');
  const ids=[a.id,b.id];
  if(stage==='partial'){
   assert.equal(state.stage,'prepared');
   const teacher=await login('teacher');
   await denied(()=>command(teacher,'restoreSubject',state.subject.id),'RESTORE_UNAVAILABLE','La materia vencida no se restaura');
   await denied(()=>confirm(ids),'STORAGE_OBJECT_REMAINS','La confirmación rechaza metadatos con objetos todavía presentes');
   assert.equal(hash(await read(shared)),hash(png));pass('El objeto compartido conserva los bytes tras retirar la materia');
   const authorized=await rpc(teacher,'aulify_file',{p_id:shared.id});assert.equal(authorized.path,shared.path);pass('El docente conserva acceso autorizado al archivo de biblioteca');
   await remove(a);
   await denied(()=>confirm(ids),'STORAGE_OBJECT_REMAINS','Un borrado parcial no permite confirmar el lote completo');
   assert.equal(hash(await read(b)),hash(png));pass('El segundo objeto sigue presente después del fallo parcial');
   state.stage='partial';report.status='partial-verified';
  }else{
   assert.equal(state.stage,'partial');
   // El primer objeto ya no existe: la API debe admitir repetir su borrado.
   await remove(a);await remove(b);pass('El reintento admite repetir el borrado y elimina el segundo objeto');
   assert.equal((await confirm(ids)).deleted,2);pass('Confirma ambos metadatos sólo después de retirar sus objetos');
   assert.equal((await confirm(ids)).deleted,0);pass('Repetir la confirmación no duplica la eliminación');
   assert.equal(hash(await read(shared)),hash(png));pass('La biblioteca conserva sus bytes íntegros al terminar el reintento');
   state.stage='finished';report.status='storage-steps-passed';report.completedStorageAt=new Date().toISOString();
  }
  await save();
 }
 console.log(JSON.stringify({stage:state.stage,reportPath,checks:report.checks.length}));
}catch(error){report.status='failed';report.failure={stage,message:error.message};await save();throw error;}
