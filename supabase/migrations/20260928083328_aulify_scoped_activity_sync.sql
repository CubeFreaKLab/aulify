-- Metadatos técnicos: una revisión opaca no reemplaza las relaciones de dominio.
create table app.activity_sync_versions (
 activity_id uuid primary key references app.activities(id) on delete cascade,
 public_revision bigint not null default 0 check(public_revision>=0),
 teacher_revision bigint not null default 0 check(teacher_revision>=0)
);
create table app.participant_sync_versions (
 participant_id uuid primary key references app.participants(id) on delete cascade,
 student_revision bigint not null default 0 check(student_revision>=0)
);
alter table app.activity_sync_versions enable row level security;
alter table app.participant_sync_versions enable row level security;
revoke all on app.activity_sync_versions,app.participant_sync_versions from public,anon,authenticated;
insert into app.activity_sync_versions(activity_id) select id from app.activities;
insert into app.participant_sync_versions(participant_id) select id from app.participants;

create function app.bump_sync_revision(a uuid,p uuid,pub boolean,student_change boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if a is null or not exists(select 1 from app.activities where id=a) then return; end if;
 insert into app.activity_sync_versions(activity_id,public_revision,teacher_revision)
 values(a,case when pub then 1 else 0 end,1)
 on conflict(activity_id) do update set
  public_revision=activity_sync_versions.public_revision+case when pub then 1 else 0 end,
  teacher_revision=activity_sync_versions.teacher_revision+1;
 if student_change and p is not null and exists(select 1 from app.participants where id=p and activity_id=a) then
  insert into app.participant_sync_versions(participant_id,student_revision) values(p,1)
  on conflict(participant_id) do update set student_revision=participant_sync_versions.student_revision+1;
 end if;
end $$;

create function app.track_sync_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare j jsonb:=coalesce(to_jsonb(new),to_jsonb(old)); a uuid; p uuid; s uuid;
 pub boolean:=false; student_change boolean:=false; rec record;
begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return null; end if;
 case tg_table_name
 when 'subjects','memberships','invitation_codes' then
  s:=case when tg_table_name='subjects' then (j->>'id')::uuid else (j->>'subject_id')::uuid end;
  for rec in select id from app.activities where subject_id=s order by id loop
   perform app.bump_sync_revision(rec.id,null,tg_table_name='subjects',false);
  end loop;
  return null;
 when 'activities' then a:=(j->>'id')::uuid;pub:=true;
 when 'quiz_settings','guided_sessions','session_questions','teams' then
  a:=(j->>'activity_id')::uuid;pub:=true;
 when 'participants' then a:=(j->>'activity_id')::uuid;p:=(j->>'id')::uuid;student_change:=true;
 when 'attempts','powerup_uses','team_members','evaluation_revisions' then
  p:=(j->>'participant_id')::uuid;
  student_change:=case when tg_table_name='evaluation_revisions' then j->>'published_at' is not null or to_jsonb(old)->>'published_at' is not null else true end;
  pub:=tg_table_name='team_members';
 when 'responses','question_grades' then
  select at.participant_id into p from app.attempt_questions aq join app.attempts at on at.id=aq.attempt_id where aq.id=(j->>'attempt_question_id')::uuid;
  student_change:=tg_table_name='responses';
 when 'attempt_resolutions','integrity_events','incident_reviews' then
  select participant_id into p from app.attempts where id=(j->>'attempt_id')::uuid;
  student_change:=tg_table_name='attempt_resolutions';
 when 'deadline_extensions' then
  a:=(j->>'activity_id')::uuid;p:=(j->>'participant_id')::uuid;
  pub:=p is null;student_change:=p is not null;
 else return null;
 end case;
 if a is null and p is not null then select activity_id into a from app.participants where id=p; end if;
 perform app.bump_sync_revision(a,p,pub,student_change);
 return null;
end $$;
-- Los contadores se actualizan al finalizar la transacción, después de los bloqueos de dominio.
do $$ declare t text; begin
 foreach t in array array['subjects','memberships','invitation_codes','activities','quiz_settings','guided_sessions','session_questions','teams','participants','attempts','powerup_uses','team_members','evaluation_revisions','responses','question_grades','attempt_resolutions','integrity_events','incident_reviews','deadline_extensions'] loop
  execute format('create constraint trigger aulify_sync_revision after insert or update or delete on app.%I deferrable initially deferred for each row execute function app.track_sync_revision()',t);
 end loop;
end $$;
revoke all on function app.bump_sync_revision(uuid,uuid,boolean,boolean),app.track_sync_revision() from public,anon,authenticated;

create or replace function app.activity_sync(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=app.require_user(); a app.activities; s app.subjects; owner boolean; p uuid;
 public_rev bigint; teacher_rev bigint; student_rev bigint; duration int;
 common_deadline timestamptz; next_deadline timestamptz;
begin
 select * into a from app.activities where id=p_activity_id;
 select * into s from app.subjects where id=a.subject_id;
 owner:=s.owner_id=u;
 if a.id is null or a.kind<>'quiz' or not coalesce(owner,false) and
  (a.published_at is null or s.archived_at is not null or s.purge_started_at is not null or
   not exists(select 1 from app.memberships where subject_id=s.id and student_id=u and status='approved')) then
  raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';
 end if;
 select pa.id into p from app.participants pa join app.memberships m on m.id=pa.membership_id where pa.activity_id=a.id and m.student_id=u;
 select v.public_revision,v.teacher_revision into public_rev,teacher_rev from app.activity_sync_versions v where v.activity_id=a.id;
 select v.student_revision into student_rev from app.participant_sync_versions v where v.participant_id=p;
 select duration_seconds into duration from app.quiz_settings where activity_id=a.id;
 select greatest(a.closes_at,max(new_deadline)) into common_deadline from app.deadline_extensions where activity_id=a.id and participant_id is null;
 next_deadline:=common_deadline;
 if duration is not null then
  select least(common_deadline,min(greatest(at.started_at+make_interval(secs=>duration),e.personal_deadline))) into next_deadline
  from app.attempts at join app.participants pa on pa.id=at.participant_id
  left join lateral(select max(new_deadline) personal_deadline from app.deadline_extensions where participant_id=pa.id) e on true
  where pa.activity_id=a.id and at.closed_at is null and (owner or pa.id=p);
 end if;
 if a.opens_at>now() then next_deadline:=least(next_deadline,a.opens_at); end if;
 return jsonb_build_object('revision',md5(jsonb_build_array(u,a.id,coalesce(public_rev,0),
  case when owner then coalesce(teacher_rev,0) else coalesce(student_rev,0) end,
  now()>=a.opens_at,next_deadline,now()>=next_deadline)::text),'serverTime',clock_timestamp(),'nextDeadline',next_deadline);
end $$;

create function app.activity_snapshot(p_activity_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=app.require_user(); a app.activities; s app.subjects; teacher boolean;
 profiles jsonb; subject jsonb; members jsonb; versions jsonb; attempts jsonb; powers jsonb; evaluations jsonb;
 studentviews jsonb:='{}'; participants jsonb; teams jsonb; incidents jsonb; drafts jsonb; rec record;
begin
 -- La autorización es actual, independiente del contador de revisión.
 perform app.activity_sync(p_activity_id);
 select * into a from app.activities where id=p_activity_id;
 select * into s from app.subjects where id=a.subject_id;
 teacher:=s.owner_id=u;
 for rec in select at.id from app.attempts at join app.participants pa on pa.id=at.participant_id
  join app.memberships m on m.id=pa.membership_id where pa.activity_id=a.id and at.closed_at is null
  and (teacher and s.archived_at is null and s.purge_started_at is null or m.student_id=u)
  and app.deadline(a.id,pa.id,at.started_at)<=now()
 loop perform app.close_attempt(rec.id,'deadline'); end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.display_name,'role',pr.role,'email',case when pr.id=u then au.email else '' end)),'[]') into profiles
 from app.profiles pr join auth.users au on au.id=pr.id where pr.id=u or teacher and exists(select 1 from app.memberships m where m.subject_id=s.id and m.student_id=pr.id);
 subject:=jsonb_strip_nulls(jsonb_build_object('id',s.id,'ownerId',s.owner_id,'name',s.name,'course',s.course_label,'year',s.school_year,'description',s.description,
  'status',case when s.archived_at is null then 'active' else 'archived' end,'archivedAt',s.archived_at))||jsonb_build_object('code',case when teacher then(select code from app.invitation_codes where subject_id=s.id and revoked_at is null)else null end);
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'subjectId',m.subject_id,'studentId',m.student_id,'status',case m.status when 'withdrawn' then 'removed' else m.status end,'requestedAt',m.created_at,'decidedAt',m.updated_at)),'[]') into members from app.memberships m where m.subject_id=s.id and (teacher or m.student_id=u);
 versions:=case when teacher then jsonb_build_array(app.version_json(a.version_id,true)) else '[]'::jsonb end;
 select coalesce(jsonb_agg(app.attempt_json(at.id,teacher)),'[]') into attempts from app.attempts at join app.participants pa on pa.id=at.participant_id join app.memberships m on m.id=pa.membership_id where pa.activity_id=a.id and (teacher or m.student_id=u);
 select coalesce(jsonb_agg(jsonb_build_object('activityId',pa.activity_id,'studentId',m.student_id,'kind',pu.kind,'questionId',aq.question_key,'attemptId',aq.attempt_id,'at',pu.consumed_at)),'[]') into powers from app.powerup_uses pu join app.participants pa on pa.id=pu.participant_id join app.memberships m on m.id=pa.membership_id join app.attempt_questions aq on aq.id=pu.attempt_question_id where pa.activity_id=a.id and (teacher or m.student_id=u);
 select coalesce(jsonb_agg(app.evaluation_json(e.id)),'[]') into evaluations from app.evaluation_revisions e join app.participants pa on pa.id=e.participant_id join app.memberships m on m.id=pa.membership_id where pa.activity_id=a.id and e.published_at is not null and (teacher or m.student_id=u);
 if not teacher then studentviews:=jsonb_build_object(a.id,app.student_activity(a.id)); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',pa.id,'activityId',pa.activity_id,'studentId',m.student_id,'alias','Participante '||lpad(pa.alias_no::text,2,'0'))),'[]') into participants from app.participants pa join app.memberships m on m.id=pa.membership_id where pa.activity_id=a.id and teacher;
 select coalesce(jsonb_agg(jsonb_build_object('id',te.id,'activityId',te.activity_id,'name',te.name,'studentIds',(select jsonb_agg(m.student_id) from app.team_members tm join app.participants pa on pa.id=tm.participant_id join app.memberships m on m.id=pa.membership_id where tm.team_id=te.id))),'[]') into teams from app.teams te where te.activity_id=a.id and teacher;
 select coalesce(jsonb_agg(to_jsonb(ir)||jsonb_build_object('signalCount',(select count(*) from app.integrity_events where attempt_id=ir.attempt_id))),'[]') into incidents from app.incident_reviews ir join app.attempts at on at.id=ir.attempt_id join app.participants pa on pa.id=at.participant_id where pa.activity_id=a.id and teacher;
 select coalesce(jsonb_agg(app.evaluation_json(e.id)),'[]') into drafts from app.evaluation_revisions e join app.participants pa on pa.id=e.participant_id where pa.activity_id=a.id and e.published_at is null and teacher;
 return jsonb_build_object('userId',u,'state',jsonb_build_object('schemaVersion',1,'revision',floor(extract(epoch from clock_timestamp())*1000),
  'users',profiles,'subjects',jsonb_build_array(subject),'memberships',members,'resources','[]'::jsonb,'versions',versions,'activities',jsonb_build_array(app.activity_json(a.id)),
  'attempts',attempts,'powerups',powers,'evaluations',evaluations,'tasks','[]'::jsonb,'submissions','[]'::jsonb,'manualActivities','[]'::jsonb,'helpPreferences','[]'::jsonb),
  'studentActivities',studentviews,'studentResults','{}'::jsonb,'participants',participants,'teams',teams,'incidents',incidents,'draftEvaluations',drafts,
  'readings','[]'::jsonb,'resubmissionWindows','[]'::jsonb);
end $$;
create function public.aulify_activity_snapshot(p_activity_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select app.activity_snapshot(p_activity_id); $$;
revoke all on function app.activity_snapshot(uuid),public.aulify_activity_snapshot(uuid) from public,anon,authenticated;
grant execute on function app.activity_snapshot(uuid),public.aulify_activity_snapshot(uuid) to authenticated;
