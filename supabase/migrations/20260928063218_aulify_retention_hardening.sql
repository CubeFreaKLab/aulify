-- Cola relacional de objetos pendientes; conserva las 44 relaciones de dominio.
alter table app.file_objects add column purge_job_id uuid references app.purge_jobs(id);
create index file_purge_job on app.file_objects(purge_job_id) where purge_job_id is not null;
create index purge_due on app.purge_jobs(status,due_at,next_retry_at);
alter table app.help_progress add constraint help_state check(state in ('offered','skipped','completed') and guide_version>0);
alter table app.integrity_events add constraint event_interval check(visible_at is null or visible_at>=hidden_at);
alter table app.incident_reviews add constraint incident_state check(status in ('pending','reviewed_no_action','reviewed_observation'));

create function app.assert_editor(value jsonb,depth int default 0) returns void language plpgsql set search_path='' as $$
declare x record; begin
 if depth>30 then raise exception 'EDITOR_DEPTH_LIMIT'; end if;
 if jsonb_typeof(value)='object' then
  for x in select * from jsonb_each(value) loop
   if x.key in ('correctOptionId','correctOptionIds','correctOrder','correct','pairs','manualGuide','explanation','hint','solutions','expected_position') then raise exception 'PRIVATE_EDITOR_CONTENT: Las soluciones no pertenecen al documento visible.'; end if;
   if x.key in ('url','href','src') and jsonb_typeof(x.value)='string' and x.value#>>'{}' !~ '^(https://|/api/files/|#)' then raise exception 'INVALID_EDITOR_URL'; end if;
   perform app.assert_editor(x.value,depth+1);
  end loop;
 elsif jsonb_typeof(value)='array' then
  for x in select v from jsonb_array_elements(value) v loop perform app.assert_editor(x.v,depth+1); end loop;
 end if;
end $$;
create function app.validate_draft() returns trigger language plpgsql security definer set search_path='' as $$
declare x jsonb; f uuid; owner uuid; begin
 if new.document ? 'editorDocument' then
  if jsonb_typeof(new.document->'editorDocument')<>'array' or jsonb_array_length(new.document->'editorDocument')>200 then raise exception 'INVALID_EDITOR_DOCUMENT'; end if;
  perform app.assert_editor(new.document->'editorDocument');
 end if;
 select owner_id into owner from app.resources where id=new.resource_id;
 delete from app.draft_files where resource_id=new.resource_id;
 for x in select value from jsonb_array_elements(new.document->'blocks') where value->>'type'='image' and value->>'fileId' is not null loop
  f:=(x->>'fileId')::uuid;
  if not exists(select 1 from app.file_objects where id=f and owner_id=owner and state='ready' and byte_size<=5242880 and mime_type in ('image/jpeg','image/png','image/webp')) then raise exception 'INVALID_IMAGE'; end if;
  insert into app.draft_files values(new.resource_id,f) on conflict do nothing;
 end loop; return new;
end $$;
create trigger validate_draft after insert or update on app.resource_drafts for each row execute function app.validate_draft();

create or replace function app.attempt_score(t uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare x record; bn numeric:=0; bd numeric:=1; dn numeric:=0; dd numeric:=1; divisor numeric; q numeric:=0; pending int:=0; complete boolean; note numeric; n numeric; d numeric;
begin
 for x in select aq.id,qu.max_points,g.points_num,g.points_den,exists(select 1 from app.powerup_uses where attempt_question_id=aq.id and kind='double') doubled from app.attempt_questions aq join app.questions qu using(version_id,question_key) left join lateral(select * from app.question_grades where attempt_question_id=aq.id order by revision_no desc limit 1) g on true where aq.attempt_id=t loop
  q:=q+x.max_points*100;
  if x.points_num is null then pending:=pending+1; else
   bn:=bn*x.points_den+x.points_num*bd; bd:=bd*x.points_den; divisor:=gcd(bn,bd); bn:=bn/divisor; bd:=bd/divisor;
   if x.doubled then dn:=dn*x.points_den+x.points_num*dd; dd:=dd*x.points_den; divisor:=gcd(dn,dd); dn:=dn/divisor; dd:=dd/divisor; end if;
  end if;
 end loop;
 select a.*,qs.bonus_affects_grade,at.closed_at,at.close_reason,r.decision into x from app.attempts at join app.participants p on p.id=at.participant_id join app.activities a on a.id=p.activity_id join app.quiz_settings qs on qs.activity_id=a.id left join app.attempt_resolutions r on r.attempt_id=at.id where at.id=t;
 complete:=pending=0 and x.closed_at is not null and coalesce(x.decision,'')<>'exclude' and (x.close_reason not in('withdrawal','archive','teacher_early') or x.decision='evaluate');
 if complete and q>0 then
  n:=bn; d:=bd; if x.bonus_affects_grade then n:=bn*dd+dn*bd;d:=bd*dd; end if;
  -- Q y M en centésimas: redondeo half-up mediante división entera exacta.
  n:=n*(x.max_grade*100)*100; d:=d*q;
  note:=least(x.max_grade,div(n*2+d,d*2)/100);
 end if;
 return jsonb_build_object('basePoints',bn/bd,'bonusPoints',dn/dd,'gamePoints',bn/bd+dn/dd,'maximumPoints',q/100,'pending',pending,'complete',coalesce(complete,false),'grade',note);
end $$;

create function app.maintenance(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare job record; file record; t record; ids uuid[]; cnt int:=0;
begin
 if p_action='tick' then
  for t in select at.id from app.attempts at join app.participants p on p.id=at.participant_id where at.closed_at is null and app.deadline(p.activity_id,p.id,at.started_at)<=now() limit 500 loop perform app.close_attempt(t.id,'deadline'); end loop;
  delete from app.integrity_events ev using app.attempts at,app.participants p where ev.attempt_id=at.id and at.participant_id=p.id and app.deadline(p.activity_id)+interval '30 days'<=now();
  for job in select pj.* from app.purge_jobs pj join app.subjects s on s.id=pj.subject_id where pj.status in ('scheduled','failed') and pj.due_at<=now() and (pj.next_retry_at is null or pj.next_retry_at<=now()) and s.archived_at+interval '30 days'<=now() for update of pj,s skip locked limit 10 loop
   update app.subjects set purge_started_at=now() where id=job.subject_id;
   update app.purge_jobs set status='running',phase='objects' where id=job.id;
   select array_agg(distinct sf.file_id) into ids from app.submission_files sf join app.submission_versions sv on sv.id=sf.submission_version_id join app.submissions su on su.id=sv.submission_id join app.participants p on p.id=su.participant_id join app.activities a on a.id=p.activity_id where a.subject_id=job.subject_id;
   -- Quitar referencias de la materia antes de decidir qué objetos son exclusivos.
   delete from app.subjects where id=job.subject_id;
   update app.file_objects f set state='delete_pending',purge_job_id=job.id where f.id=any(ids) and not exists(select 1 from app.draft_files where file_id=f.id) and not exists(select 1 from app.content_blocks where file_id=f.id) and not exists(select 1 from app.submission_files where file_id=f.id);
  end loop;
  update app.file_objects f set state='delete_pending' where f.created_at<now()-interval '1 day' and f.state in ('pending','ready') and not exists(select 1 from app.draft_files where file_id=f.id) and not exists(select 1 from app.content_blocks where file_id=f.id) and not exists(select 1 from app.submission_files where file_id=f.id);
  update app.purge_jobs pj set status='done',phase='records',completed_at=now() where pj.status='running' and pj.subject_id is null and not exists(select 1 from app.file_objects where purge_job_id=pj.id);
  return jsonb_build_object('files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'bucket',f.bucket,'path',f.object_path)) from (select * from app.file_objects where state='delete_pending' order by created_at limit 100) f),'[]'::jsonb));
 elsif p_action='confirmFiles' then
  for file in select f.* from app.file_objects f where f.state='delete_pending' and f.id in(select value::uuid from jsonb_array_elements_text(p_payload->'ids')) for update loop
   if exists(select 1 from storage.objects where bucket_id=file.bucket and name=file.object_path) then raise exception 'STORAGE_OBJECT_REMAINS'; end if;
   delete from app.file_objects where id=file.id;cnt:=cnt+1;
  end loop;
  update app.purge_jobs pj set status='done',phase='records',completed_at=now() where pj.status='running' and pj.subject_id is null and not exists(select 1 from app.file_objects where purge_job_id=pj.id);
  return jsonb_build_object('deleted',cnt);
 else raise exception 'UNKNOWN_MAINTENANCE_ACTION'; end if;
end $$;
revoke all on function app.maintenance(text,jsonb) from public,anon,authenticated;
grant execute on function app.maintenance(text,jsonb) to service_role;
revoke all on all functions in schema app from public,anon,authenticated;
grant execute on function app.command(text,jsonb),app.snapshot(),app.can_file(uuid),app.can_storage_object(text,text) to authenticated;
grant execute on function app.file(uuid) to authenticated;
grant execute on function app.register_file(uuid,uuid,text,text,bigint,text),app.maintenance(text,jsonb) to service_role;
create function public.aulify_file(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select app.file(p_id); $$;
create function public.aulify_register_file(p_owner uuid,p_id uuid,p_name text,p_mime text,p_size bigint,p_sha256 text) returns jsonb language sql security invoker set search_path='' as $$ select app.register_file(p_owner,p_id,p_name,p_mime,p_size,p_sha256); $$;
create function public.aulify_maintenance(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select app.maintenance(p_action,p_payload); $$;
revoke all on function public.aulify_file(uuid),public.aulify_register_file(uuid,uuid,text,text,bigint,text),public.aulify_maintenance(text,jsonb) from public,anon,authenticated;
grant execute on function public.aulify_file(uuid) to authenticated;
grant execute on function public.aulify_register_file(uuid,uuid,text,text,bigint,text),public.aulify_maintenance(text,jsonb) to service_role;
