/** Ejecutar en servidor/Actions con secretos protegidos. Nunca importar al navegador. */
const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Faltan las variables privadas de mantenimiento.');
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
async function request(path,body,method='POST'){
 const response=await fetch(`${url.replace(/\/$/,'')}${path}`,{method,headers,body:JSON.stringify(body)});
 if(!response.ok)throw new Error(`HTTP_${response.status}`);
 return response.json();
}
let total=0;
for(let batch=0;batch<20;batch++){
 const result=await request('/rest/v1/rpc/aulify_maintenance',{p_action:'tick',p_payload:{}});
 if(!result.files.length)break;
 for(const bucket of new Set(result.files.map(f=>f.bucket))){
  const files=result.files.filter(f=>f.bucket===bucket);
  await request(`/storage/v1/object/${encodeURIComponent(bucket)}`,{prefixes:files.map(f=>f.path)},'DELETE');
  const confirmation=await request('/rest/v1/rpc/aulify_maintenance',{p_action:'confirmFiles',p_payload:{ids:files.map(f=>f.id)}});
  total+=confirmation.deleted;
 }
}
console.log(JSON.stringify({completedAt:new Date().toISOString(),deletedFileRecords:total}));
