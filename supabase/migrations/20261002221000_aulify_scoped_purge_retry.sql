-- Reintentar un trabajo concreto sin cerrar intentos ni limpiar otras materias.
-- La entrada pública mantiene exclusivamente el permiso de service_role.
alter function app.maintenance(text,jsonb) rename to maintenance_global;

create function app.maintenance_job(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid := (p_payload->>'jobId')::uuid; job record; file record; ids uuid[]; cnt int := 0;
begin
 if target is null or not exists(select 1 from app.purge_jobs where id=target) then raise exception 'PURGE_JOB_NOT_FOUND'; end if;
 if p_action='tick' then
  for job in
   select pj.* from app.purge_jobs pj join app.subjects s on s.id=pj.subject_id
   where pj.id=target and pj.status in ('scheduled','failed') and pj.due_at<=now()
    and (pj.next_retry_at is null or pj.next_retry_at<=now()) and s.archived_at+interval '30 days'<=now()
   for update of pj,s skip locked
  loop
   update app.subjects set purge_started_at=now() where id=job.subject_id;
   update app.purge_jobs set status='running',phase='objects' where id=job.id;
   select array_agg(distinct sf.file_id) into ids from app.submission_files sf
    join app.submission_versions sv on sv.id=sf.submission_version_id
    join app.submissions su on su.id=sv.submission_id join app.participants p on p.id=su.participant_id
    join app.activities a on a.id=p.activity_id where a.subject_id=job.subject_id;
   delete from app.subjects where id=job.subject_id;
   update app.file_objects f set state='delete_pending',purge_job_id=job.id where f.id=any(ids)
    and not exists(select 1 from app.draft_files where file_id=f.id)
    and not exists(select 1 from app.content_blocks where file_id=f.id)
    and not exists(select 1 from app.submission_files where file_id=f.id);
  end loop;
 elsif p_action='confirmFiles' then
  if exists(select 1 from app.file_objects f where f.id in(select value::uuid from jsonb_array_elements_text(p_payload->'ids')) and f.purge_job_id is distinct from target) then raise exception 'PURGE_JOB_FILE_MISMATCH'; end if;
  for file in select f.* from app.file_objects f where f.state='delete_pending' and f.purge_job_id=target
   and f.id in(select value::uuid from jsonb_array_elements_text(p_payload->'ids')) for update loop
   if exists(select 1 from storage.objects where bucket_id=file.bucket and name=file.object_path) then raise exception 'STORAGE_OBJECT_REMAINS'; end if;
   delete from app.file_objects where id=file.id; cnt:=cnt+1;
  end loop;
 else raise exception 'UNKNOWN_MAINTENANCE_ACTION'; end if;
 update app.purge_jobs pj set status='done',phase='records',completed_at=now()
  where pj.id=target and pj.status='running' and pj.subject_id is null
   and not exists(select 1 from app.file_objects where purge_job_id=pj.id);
 if p_action='confirmFiles' then return jsonb_build_object('deleted',cnt); end if;
 return jsonb_build_object('files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'bucket',f.bucket,'path',f.object_path))
  from (select * from app.file_objects where state='delete_pending' and purge_job_id=target order by created_at limit 100) f),'[]'::jsonb));
end $$;

create function app.maintenance(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_payload ? 'jobId' then return app.maintenance_job(p_action,p_payload); end if;
 return app.maintenance_global(p_action,p_payload);
end $$;
revoke all on function app.maintenance_job(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function app.maintenance_global(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function app.maintenance(text,jsonb) from public,anon,authenticated;
grant execute on function app.maintenance(text,jsonb) to service_role;
