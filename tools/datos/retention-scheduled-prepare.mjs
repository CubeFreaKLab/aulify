import fs from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

// Prepara un objeto propio para observar el cron existente. No ejecuta tick ni borra objetos.
const statePath='.local-private/retention-scheduled-fixture.json';
const reportPath='docs/verificacion/conservacion-programada.json';
if(await fs.stat(statePath).then(()=>true,()=>false))throw new Error('Ya existe este fixture; continuar su observación.');
const env=Object.fromEntries((await fs.readFile('.env.local','utf8')).split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const accounts=JSON.parse(await fs.readFile('.local-private/remote-test-accounts.json','utf8'));
const url=env.NEXT_PUBLIC_SUPABASE_URL;
if(url!=='https://bnqyyumfmyexsqszglab.supabase.co'||accounts.projectRef!=='bnqyyumfmyexsqszglab')throw new Error('Proyecto incorrecto.');
const client=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const admin=client(env.SUPABASE_SECRET_KEY??env.SUPABASE_SERVICE_ROLE_KEY);
const rpc=async(c,name,args)=>{const r=await c.rpc(name,args);if(r.error)throw new Error(`${r.error.code}:${r.error.message}`);if(r.data?.error)throw new Error(r.data.error.code);return r.data;};
const command=(c,action,...args)=>rpc(c,'aulify_command',{p_action:action,p_payload:{args}});
const state={project:accounts.projectRef,runId:randomUUID(),stage:'preparing'};
const report={runId:state.runId,startedAt:new Date().toISOString(),status:'preparing',limitations:[
 'Vencimiento representado por fechas sintéticas; la espera del cron se mide con reloj real a partir de la elegibilidad preparada.',
 'Un solo fixture no demuestra un SLA general de disponibilidad del programador.',
 'No ejecutar mantenimiento manual mientras se observe este fixture, para no atribuirlo al cron.']};
const save=async()=>{await fs.writeFile(statePath,JSON.stringify(state,null,2)+'\n');await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');};
try{
 await save();const sessions={};
 for(const role of ['teacher','student']){const c=client(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??env.NEXT_PUBLIC_SUPABASE_ANON_KEY);const a=accounts.users[role];const r=await c.auth.signInWithPassword({email:a.email,password:a.password});if(r.error)throw new Error(`Auth ${r.error.status}`);sessions[role]=c;}
 const {teacher,student}=sessions;const prefix=`AP31-cron-${state.runId.slice(0,8)}`;
 state.subject=await command(teacher,'createSubject',{name:prefix,course:'3C',year:2026,description:'Fixture de observación del mantenimiento programado.'});await save();
 const view=await rpc(teacher,'aulify_snapshot',{});const code=view.state.subjects.find(s=>s.id===state.subject.id).code;
 const membership=await command(student,'requestMembership',code);await command(teacher,'decideMembership',membership.id,'approved');
 state.task=await command(teacher,'createTask',{subjectId:state.subject.id,title:prefix,instructions:'Objeto ficticio exclusivo.',opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),maxGrade:20,weight:1,countsTowardAverage:true,allowLate:false});await save();
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6wsAAAAAASUVORK5CYII=','base64');
 const id=randomUUID(),owner=accounts.users.student.id,name=`${prefix}.png`;
 const reserve=await rpc(admin,'aulify_reserve_upload',{p_owner:owner,p_id:id,p_name:name,p_purpose:'submission',p_size:bytes.length,p_mime:'image/png'});
 state.file={id,owner,bucket:reserve.bucket,path:reserve.path,byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};await save();
 if(reserve.bucket!=='aulify-files'||reserve.path!==`${owner}/${id}`)throw new Error('Ruta inesperada.');
 const uploaded=await admin.storage.from(reserve.bucket).upload(reserve.path,bytes,{contentType:'image/png',upsert:false});if(uploaded.error)throw new Error(`Storage ${uploaded.error.statusCode}`);
 const file=await rpc(admin,'aulify_register_file',{p_owner:owner,p_id:id,p_name:name,p_mime:'image/png',p_size:bytes.length,p_sha256:state.file.sha256});
 state.submission=await command(student,'submitTask',state.task.id,[file],'Objeto para observar purga programada.',randomUUID());await save();
 await command(teacher,'archiveSubject',state.subject.id);state.stage='archived-awaiting-test-eligibility';report.status=state.stage;report.subjectId=state.subject.id;report.fileId=id;report.fileBytes=bytes.length;await save();
 console.log(JSON.stringify({status:report.status,subjectId:state.subject.id,fileId:id}));
}catch(error){report.status='failed';report.failure=error.message;await save();throw error;}
