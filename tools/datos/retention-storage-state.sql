-- Recibe un manifiesto ficticio mediante SET LOCAL aulify.retention_fixture y una
-- acción prepare/tick/inspect en aulify.retention_action. No recibe credenciales.
-- tick aborta y revierte si la purga o su cola alcanzaran objetos ajenos al fixture.
set local statement_timeout='15s';
set local lock_timeout='1s';
do $retention$
declare
 f jsonb:=current_setting('aulify.retention_fixture')::jsonb;
 action text:=current_setting('aulify.retention_action');
 fixture_subject_id uuid:=(f->>'subject')::uuid; fixture_control_id uuid:=(f->>'control')::uuid;
 fixture_resource_id uuid:=(f->>'resource')::uuid; fixture_version_id uuid:=(f->>'version')::uuid;
 fixture_submission_id uuid:=(f->>'submission')::uuid; fixture_shared_id uuid:=(f->>'shared')::uuid;
 fixture_exclusive_ids uuid[]:=array[(f->>'exclusiveA')::uuid,(f->>'exclusiveB')::uuid];
 queue jsonb; output jsonb; fixture_job_id uuid;
begin
 if jsonb_typeof(f)<>'object' or f->>'runId' is null or action not in ('prepare','tick','inspect') then
  raise exception 'INVALID_FIXTURE_ACTION';
 end if;
 if not exists(select 1 from app.subjects s where s.id=fixture_control_id and s.name='AP31-'||left(f->>'runId',8)||' vigente')
 or not exists(select 1 from app.resources r where r.id=fixture_resource_id and r.title='AP31-'||left(f->>'runId',8)||' biblioteca') then
  raise exception 'FIXTURE_IDENTITY_MISMATCH';
 end if;
 if action='prepare' then
  if not exists(select 1 from app.subjects s where s.id=fixture_subject_id and s.name='AP31-'||left(f->>'runId',8)||' vencida' and s.archived_at is not null)
  or (select count(*) from app.file_objects where id=any(fixture_exclusive_ids||fixture_shared_id) and state='ready')<>3
  or not exists(select 1 from app.content_blocks b where b.version_id=fixture_version_id and b.file_id=fixture_shared_id) then
   raise exception 'INCOMPLETE_FIXTURE';
  end if;
  -- Topología histórica explícita; el contrato público ya rechazó el archivo ajeno.
  insert into app.submission_files values(fixture_submission_id,fixture_shared_id,3);
  update app.subjects s set archived_at=now()-interval '31 days' where s.id=fixture_subject_id;
  update app.purge_jobs j set due_at=now() where j.subject_id=fixture_subject_id and j.status='scheduled' returning id into fixture_job_id;
  if fixture_job_id is null then raise exception 'MISSING_PURGE_JOB'; end if;
 elsif action='tick' then
  if exists(select 1 from app.purge_jobs j join app.subjects s on s.id=j.subject_id
   where j.status in ('scheduled','failed') and j.due_at<=now()
   and (j.next_retry_at is null or j.next_retry_at<=now()) and s.archived_at+interval '30 days'<=now()
   and s.id<>fixture_subject_id) then raise exception 'UNRELATED_DUE_SUBJECT'; end if;
  if exists(select 1 from app.file_objects o where o.state='delete_pending' and not(o.id=any(fixture_exclusive_ids))) then
   raise exception 'UNRELATED_PENDING_FILE'; end if;
  if exists(select 1 from app.file_objects o where o.created_at<now()-interval '1 day' and o.state in ('pending','ready')
   and not exists(select 1 from app.draft_files where file_id=o.id)
   and not exists(select 1 from app.content_blocks where file_id=o.id)
   and not exists(select 1 from app.submission_files where file_id=o.id)
   and not(o.id=any(fixture_exclusive_ids))) then raise exception 'UNRELATED_ORPHAN_FILE'; end if;
  set local role service_role;
  queue:=public.aulify_maintenance('tick');
  reset role;
  if exists(select 1 from jsonb_array_elements(queue->'files') v where not((v->>'id')::uuid=any(fixture_exclusive_ids))) then
   raise exception 'UNEXPECTED_PURGE_FILE';
  end if;
 end if;
 output:=jsonb_build_object('checkedAt',clock_timestamp(),'action',action,'jobId',fixture_job_id,'queue',queue,
  'job',(select jsonb_build_object('id',j.id,'status',j.status,'phase',j.phase,'completedAt',j.completed_at)
   from app.purge_jobs j where j.id=coalesce((f->>'jobId')::uuid,fixture_job_id)),
  'subjectExists',exists(select 1 from app.subjects s where s.id=fixture_subject_id),
  'sharedSubmissionRefs',(select count(*) from app.submission_files where file_id=fixture_shared_id),
  'sharedDraftRefs',(select count(*) from app.draft_files where file_id=fixture_shared_id),
  'sharedPublishedRefs',(select count(*) from app.content_blocks where file_id=fixture_shared_id),
  'files',(select jsonb_agg(jsonb_build_object('id',o.id,'state',o.state,'job',o.purge_job_id,
   'objectExists',exists(select 1 from storage.objects so where so.bucket_id=o.bucket and so.name=o.object_path)) order by o.id)
   from app.file_objects o where o.id=any(fixture_exclusive_ids||fixture_shared_id)),
  'protected',jsonb_build_object(
   'subjects', (select md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'')) from app.subjects s where s.id<>fixture_subject_id),
   'control',(select md5(to_jsonb(s)::text) from app.subjects s where s.id=fixture_control_id),
   'draft',(select md5(to_jsonb(d)::text) from app.resource_drafts d where d.resource_id=fixture_resource_id),
   'version',(select md5(to_jsonb(v)::text) from app.resource_versions v where v.id=fixture_version_id),
   'otherFiles',(select md5(coalesce(jsonb_agg(to_jsonb(o) order by o.id)::text,'')) from app.file_objects o where not(o.id=any(fixture_exclusive_ids))),
   'authAccounts',(select count(*) from auth.users),
   'profileIdentities',(select md5(coalesce(jsonb_agg(id order by id)::text,'')) from app.profiles)));
 perform set_config('aulify.retention_result',output::text,true);
end $retention$;
select current_setting('aulify.retention_result')::jsonb as verification;
