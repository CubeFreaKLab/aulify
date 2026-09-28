create function app.submission_json(sv uuid,teacher boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('id',v.id,'taskId',p.activity_id,'studentId',m.student_id,'version',v.version_no,'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.original_name,'size',f.byte_size,'mimeType',f.mime_type,'objectKey',f.object_path) order by sf.position) from app.submission_files sf join app.file_objects f on f.id=sf.file_id where sf.submission_version_id=v.id),'[]'::jsonb),'note',v.note,'submittedAt',v.received_at,'late',v.late,'grade',e.grade,'comment',e.feedback,'gradedAt',e.created_at,'publishedAt',e.published_at)) from app.submission_versions v join app.submissions s on s.id=v.submission_id join app.participants p on p.id=s.participant_id join app.memberships m on m.id=p.membership_id left join lateral(select * from app.evaluation_revisions where submission_version_id=v.id and (teacher or published_at is not null) order by revision_no desc limit 1) e on true where v.id=sv;
$$;
create function app.task_json(a uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',x.id,'subjectId',x.subject_id,'title',x.title,'instructions',coalesce(x.instructions,''),'opensAt',x.opens_at,'closesAt',app.deadline(x.id),'maxGrade',x.max_grade,'weight',x.weight,'countsTowardAverage',x.counts_for_average,'allowLate',t.allow_late) from app.activities x join app.task_settings t on t.activity_id=x.id where x.id=a;
$$;
create function app.present_question(v uuid,k uuid,t uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j jsonb:=app.question_json(v,k,false); ord jsonb; key text; items jsonb; blanks jsonb:='[]'; b jsonb;
begin
 select item_order->'items' into ord from app.attempt_questions where attempt_id=t and version_id=v and question_key=k;
 if ord is null then select jsonb_agg(item_key order by md5(item_key::text||coalesce(auth.uid()::text,''))) into ord from app.question_items where version_id=v and question_key=k; end if;
 foreach key in array array['options','items','left','right'] loop
  if j ? key then select jsonb_agg(z.value order by coalesce(o.ordinality,0)) into items from jsonb_array_elements(j->key) z left join jsonb_array_elements_text(ord) with ordinality o on o.value=z.value->>'id'; j:=jsonb_set(j,array[key],items); end if;
 end loop;
 if j->>'type'='fill-options' then
  for b in select value from jsonb_array_elements(j->'blanks') loop
   select jsonb_agg(z.value order by coalesce(o.ordinality,0)) into items from jsonb_array_elements(b->'options') z left join jsonb_array_elements_text(ord) with ordinality o on o.value=z.value->>'id'; blanks:=blanks||jsonb_build_array(jsonb_set(b,'{options}',items));
  end loop; j:=jsonb_set(j,'{blanks}',blanks);
 end if; return j;
end $$;
create function app.student_activity(a uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare x app.activities; m uuid; p uuid; t uuid; v jsonb; q jsonb; ord jsonb;
begin
 select * into x from app.activities where id=a; m:=app.require_student(x.subject_id);
 if x.published_at is null then raise exception 'ACTIVITY_UNAVAILABLE'; end if;
 select id into p from app.participants where activity_id=a and membership_id=m;
 for t in select at.id from app.attempts at where at.participant_id=p and at.closed_at is null and app.deadline(a,p,at.started_at)<=now() loop perform app.close_attempt(t,'deadline'); end loop;
 select id into t from app.attempts where participant_id=p order by attempt_no desc limit 1;
 v:=app.version_json(x.version_id,false);
 select coalesce(jsonb_agg(z.question order by coalesce(aq.position,g.position*1000+qu.position)),'[]'::jsonb) into q from app.questions qu join app.question_groups g using(version_id,group_key) left join app.attempt_questions aq on aq.version_id=qu.version_id and aq.question_key=qu.question_key and aq.attempt_id=t cross join lateral(select app.present_question(qu.version_id,qu.question_key,t) question) z where qu.version_id=x.version_id;
 select jsonb_set(v,'{blocks}',jsonb_agg(case when b->>'type'='quiz' then jsonb_set(b,'{questions}',q) else b end order by n)) into v from jsonb_array_elements(v->'blocks') with ordinality z(b,n);
 return jsonb_build_object('activity',app.activity_json(a),'title',v->>'title','blocks',v->'blocks','editorDocument',v->'editorDocument','questions',q,'attempt',case when t is null then null else app.attempt_json(t) end,'attemptsRemaining',greatest(0,(select attempt_limit from app.quiz_settings where activity_id=a)-(select count(*) from app.attempts where participant_id=p)),'hintUsed',exists(select 1 from app.powerup_uses where participant_id=p and kind='hint'),'doubleUsed',exists(select 1 from app.powerup_uses where participant_id=p and kind='double'));
end $$;
create function app.activity_closed(a uuid) returns boolean language sql stable security definer set search_path='' as $$ select now()>=app.deadline(a) or exists(select 1 from app.guided_sessions where activity_id=a and closed_at is not null); $$;
create function app.student_results(s uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare m uuid:=app.require_student(s); x record; j jsonb:='[]'; visible boolean; answers jsonb; status text;
begin
 for x in select a.*,p.id participant_id,e.id evaluation_id,e.grade,e.published_at eval_published,e.attempt_id,e.submission_version_id,q.feedback_policy from app.activities a left join app.participants p on p.activity_id=a.id and p.membership_id=m left join lateral(select * from app.evaluation_revisions where participant_id=p.id and published_at is not null order by revision_no desc limit 1) e on true left join app.quiz_settings q on q.activity_id=a.id where a.subject_id=s and a.kind<>'reading' and a.published_at is not null order by coalesce(a.closes_at,a.occurs_on::timestamptz),a.id loop
  visible:=x.evaluation_id is not null and (x.feedback_policy='immediate' or x.feedback_policy='after_close' and app.activity_closed(x.id)); answers:=null;
  if x.evaluation_id is not null then status:='published';
  elsif exists(select 1 from app.attempts where participant_id=x.participant_id and closed_at is null) then status:='in-progress';
  elsif exists(select 1 from app.attempts where participant_id=x.participant_id and not (app.attempt_score(id)->>'complete')::boolean) or exists(select 1 from app.submissions where participant_id=x.participant_id) and not exists(select 1 from app.evaluation_revisions where participant_id=x.participant_id) then status:='pending-review';
  elsif exists(select 1 from app.attempts where participant_id=x.participant_id) or exists(select 1 from app.evaluation_revisions where participant_id=x.participant_id) then status:='unpublished'; else status:='not-started'; end if;
  if visible then select jsonb_agg(jsonb_build_object('questionId',aq.question_key,'points',g.points_num/g.points_den,'maximum',qu.max_points,'explanation',sec.feedback,'comment',g.comment) order by aq.position) into answers from app.evaluation_question_grades eq join app.question_grades g on g.id=eq.question_grade_id join app.attempt_questions aq on aq.id=g.attempt_question_id join app.questions qu using(version_id,question_key) join app.question_secrets sec using(version_id,question_key) where eq.evaluation_id=x.evaluation_id; end if;
  j:=j||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('activityId',x.id,'title',x.title,'maxGrade',x.max_grade,'status',status,'publishedAt',x.eval_published,'reviewVisible',coalesce(visible,false),'answers',answers))||jsonb_build_object('grade',x.grade));
 end loop; return j;
end $$;

create function app.ranking(a uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare x record; teacher boolean; rows jsonb; groups jsonb; provisional boolean;
begin
 select ac.*,qs.ranking_enabled,qs.feedback_policy,qs.teams_enabled into x from app.activities ac join app.quiz_settings qs on qs.activity_id=ac.id where ac.id=a;
 teacher:=app.owns_subject(x.subject_id,false); if not teacher then perform app.require_student(x.subject_id); end if;
 if not teacher and (not x.ranking_enabled or x.feedback_policy='hidden') then return jsonb_build_object('available',false,'reason','La clasificación está desactivada.'); end if;
 if not teacher and x.feedback_policy='after_close' and (not app.activity_closed(a) or exists(select 1 from app.participants p where p.activity_id=a and exists(select 1 from app.attempts at where at.participant_id=p.id and not exists(select 1 from app.attempt_resolutions where attempt_id=at.id and decision='exclude')) and not exists(select 1 from app.evaluation_revisions e where e.participant_id=p.id and e.published_at is not null))) then return jsonb_build_object('available',false,'reason','La clasificación se publicará al cerrar y revisar la actividad.'); end if;
 provisional:=not app.activity_closed(a) or exists(select 1 from app.attempts at join app.participants p on p.id=at.participant_id where p.activity_id=a and not (app.attempt_score(at.id)->>'complete')::boolean and not exists(select 1 from app.attempt_resolutions where attempt_id=at.id and decision='exclude'));
 with scores as(select p.id,p.alias_no,m.student_id,t.name team,coalesce((select max((app.attempt_score(at.id)->>'gamePoints')::numeric) from app.attempts at where at.participant_id=p.id and not exists(select 1 from app.attempt_resolutions where attempt_id=at.id and decision='exclude') and (provisional or (app.attempt_score(at.id)->>'complete')::boolean)),0) points from app.participants p join app.memberships m on m.id=p.membership_id left join app.team_members tm on tm.participant_id=p.id left join app.teams t on t.id=tm.team_id where p.activity_id=a), ranked as(select *,rank() over(order by points desc) rank from scores)
 select coalesce(jsonb_agg(jsonb_build_object('alias','Participante '||lpad(alias_no::text,2,'0'),'team',team,'points',points,'rank',rank)||case when teacher then jsonb_build_object('studentId',student_id) else '{}'::jsonb end order by rank,alias_no),'[]'::jsonb) into rows from ranked;
 if x.teams_enabled then with scores as(select tm.team_id,coalesce((select max((app.attempt_score(at.id)->>'gamePoints')::numeric) from app.attempts at where at.participant_id=tm.participant_id and not exists(select 1 from app.attempt_resolutions where attempt_id=at.id and decision='exclude') and (provisional or (app.attempt_score(at.id)->>'complete')::boolean)),0) points from app.team_members tm join app.teams te on te.id=tm.team_id where te.activity_id=a), totals as(select t.name,avg(s.points) points from app.teams t join scores s on s.team_id=t.id group by t.id,t.name), ranked as(select *,rank() over(order by points desc) rank from totals) select coalesce(jsonb_agg(to_jsonb(ranked) order by rank,name),'[]'::jsonb) into groups from ranked; end if;
 return jsonb_build_object('available',true,'provisional',provisional,'individual',rows,'teams',coalesce(groups,'[]'::jsonb));
end $$;

create function app.extended_command(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u uuid:=app.require_user(); id uuid; s uuid; p uuid; m uuid; t uuid; v uuid; e uuid; req uuid; rec record; x app.activities; j jsonb; f jsonb; item jsonb; st text; num int; cnt int; tm timestamptz; deadline timestamptz; nbytes bigint; fileids uuid[]; grade numeric;
begin
 case action
 when 'autoTeams' then
  id:=(args->>0)::uuid; num:=(args->>1)::int; select * into x from app.activities where activities.id=id; perform app.require_owner(x.subject_id);
  select count(*) into cnt from app.memberships where subject_id=x.subject_id and status='approved'; if num<1 or num>cnt then raise exception 'INVALID_TEAM_COUNT'; end if;
  with ordered as(select student_id,row_number() over(order by random()) n from app.memberships where subject_id=x.subject_id and status='approved'), grouped as(select ((n-1)%num)+1 g,jsonb_agg(student_id) students from ordered group by ((n-1)%num)+1)
  select jsonb_agg(jsonb_build_object('name','Equipo '||g,'studentIds',students) order by g) into j from grouped;
  return app.extended_command('configureTeams',jsonb_build_array(id,j));
 when 'createTask','createManualActivity' then
  j:=args->0; s:=(j->>'subjectId')::uuid; perform app.require_owner(s);
  insert into app.activities(subject_id,kind,title,instructions,opens_at,closes_at,occurs_on,timezone,max_grade,weight,counts_for_average,published_at) values(s,case when action='createTask' then 'task' else 'manual' end,j->>'title',coalesce(j->>'instructions',j->>'description',''),(j->>'opensAt')::timestamptz,(j->>'closesAt')::timestamptz,(j->>'occursAt')::date,'America/La_Paz',(j->>'maxGrade')::numeric,(j->>'weight')::numeric,(j->>'countsTowardAverage')::boolean,now()) returning activities.id into id;
  if action='createTask' then
   if (j->>'opensAt') is null or (j->>'closesAt') is null then raise exception 'TASK_DATES'; end if;
   insert into app.task_settings values(id,coalesce((j->>'allowLate')::boolean,false)); return app.task_json(id);
  end if; return j||jsonb_build_object('id',id);
 when 'submitTask' then
  id:=(args->>0)::uuid; req:=coalesce((args->>3)::uuid,gen_random_uuid()); select * into x from app.activities where activities.id=id for update; m:=app.require_student(x.subject_id); p:=app.ensure_participant(id,m);
  if x.kind<>'task' or x.published_at is null or now()<x.opens_at then raise exception 'TASK_UNAVAILABLE'; end if;
  select sv.id into v from app.submission_versions sv join app.submissions su on su.id=sv.submission_id where sv.request_key=req and su.participant_id=p;
  if v is not null then
   if (select note from app.submission_versions where submission_versions.id=v)<>coalesce(args->>2,'') or (select jsonb_agg(sf.file_id::text order by sf.position) from app.submission_files sf where sf.submission_version_id=v)<>(select jsonb_agg(z.value->>'id' order by z.ordinality) from jsonb_array_elements(args->1) with ordinality z) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return app.submission_json(v);
  end if;
  deadline:=app.deadline(id); select rw.id,rw.closes_at into rec from app.resubmission_windows rw where rw.participant_id=p and rw.revoked_at is null and now() between rw.opens_at and rw.closes_at order by opens_at desc limit 1;
  if exists(select 1 from app.evaluation_revisions where participant_id=p) and rec.id is null then raise exception 'RESUBMISSION_PERMISSION_REQUIRED'; end if;
  if rec.id is not null then deadline:=greatest(deadline,rec.closes_at); end if;
  if now()>deadline and not (select allow_late from app.task_settings where activity_id=id) then raise exception 'TASK_CLOSED'; end if;
  if jsonb_typeof(args->1)<>'array' or jsonb_array_length(args->1) not between 1 and 5 then raise exception 'FILE_COUNT'; end if;
  select array_agg((value->>'id')::uuid),count(distinct value->>'id') into fileids,cnt from jsonb_array_elements(args->1);
  if cnt<>array_length(fileids,1) then raise exception 'DUPLICATE_FILE'; end if;
  select count(*),sum(byte_size) into cnt,nbytes from app.file_objects where file_objects.id=any(fileids) and owner_id=u and state='ready' and byte_size<=10485760 and mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp');
  if cnt<>array_length(fileids,1) or nbytes>20971520 then raise exception 'INVALID_FILES: Completa la subida y validación de todos los archivos.'; end if;
  insert into app.submissions(participant_id) values(p) on conflict(participant_id) do update set participant_id=excluded.participant_id returning submissions.id into s;
  insert into app.submission_versions(submission_id,version_no,deadline_used,resubmission_window_id,late,request_key,note) select s,coalesce(max(version_no),0)+1,deadline,rec.id,now()>app.deadline(id),req,coalesce(args->>2,'') from app.submission_versions where submission_id=s returning submission_versions.id into v;
  insert into app.submission_files select v,z.file_id,z.ord::smallint from unnest(fileids) with ordinality z(file_id,ord);
  update app.activities set locked_at=coalesce(locked_at,now()) where activities.id=id;
  if rec.id is not null then update app.resubmission_windows set revoked_at=now() where resubmission_windows.id=rec.id; end if;
  return app.submission_json(v);
 when 'reviewTask' then
  v:=(args->>0)::uuid; select su.participant_id into p from app.submission_versions sv join app.submissions su on su.id=sv.submission_id where sv.id=v;
  e:=app.prepare_evaluation(p,'submission',null,v,(args->>1)::numeric,coalesce(args->>2,''),args->>3); return app.submission_json(v,true);
 when 'publishTaskGrade' then
  v:=(args->>0)::uuid; select er.id into e from app.evaluation_revisions er where submission_version_id=v order by revision_no desc limit 1; if e is null then raise exception 'REVIEW_PENDING'; end if; perform app.publish_evaluation(e); return app.submission_json(v,true);
 when 'allowResubmission' then
  id:=(args->>0)::uuid; s:=(args->>1)::uuid; select * into x from app.activities where activities.id=id; perform app.require_owner(x.subject_id); tm:=(args->>2)::timestamptz;
  select pa.id into p from app.participants pa join app.memberships mm on mm.id=pa.membership_id where pa.activity_id=id and mm.student_id=s;
  if x.kind<>'task' or p is null or tm<=now() then raise exception 'INVALID_WINDOW'; end if;
  update app.resubmission_windows set revoked_at=now() where participant_id=p and revoked_at is null;
  insert into app.resubmission_windows(participant_id,opens_at,closes_at,actor_id,reason) values(p,now(),tm,u,args->>3) returning resubmission_windows.id into v; return jsonb_build_object('id',v);
 when 'gradeManual','recordNonparticipation' then
  id:=(args->>0)::uuid; s:=(args->>1)::uuid; select * into x from app.activities where activities.id=id; perform app.require_owner(x.subject_id);
  select memberships.id into m from app.memberships where subject_id=x.subject_id and student_id=s;
  p:=app.ensure_participant(id,m); e:=app.prepare_evaluation(p,case action when 'gradeManual' then 'manual' else 'nonparticipation' end,null,null,(args->>2)::numeric,args->>3,args->>4);
  if coalesce((args->>5)::boolean,false) then perform app.publish_evaluation(e); end if; return app.evaluation_json(e);
 when 'publishEvaluation' then e:=(args->>0)::uuid; perform app.publish_evaluation(e); return app.evaluation_json(e);
 when 'configureTeams' then
  id:=(args->>0)::uuid; select * into x from app.activities where activities.id=id for update; perform app.require_owner(x.subject_id);
  if x.locked_at is not null or not (select teams_enabled from app.quiz_settings where activity_id=id) then raise exception 'TEAMS_LOCKED'; end if;
  if jsonb_typeof(args->1)<>'array' or jsonb_array_length(args->1)<1 then raise exception 'TEAMS_REQUIRED'; end if;
  delete from app.teams where activity_id=id;
  for j in select value from jsonb_array_elements(args->1) loop
   if jsonb_array_length(j->'studentIds')<1 then raise exception 'EMPTY_TEAM'; end if;
   insert into app.teams(activity_id,name) values(id,j->>'name') returning teams.id into t;
   for st in select value from jsonb_array_elements_text(j->'studentIds') loop
    select mm.id into m from app.memberships mm where mm.subject_id=x.subject_id and mm.student_id=st::uuid and mm.status='approved'; if m is null then raise exception 'INVALID_TEAM_MEMBER'; end if;
    p:=app.ensure_participant(id,m); insert into app.team_members values(p,t);
   end loop;
  end loop; return app.ranking(id);
 when 'reportVisibility' then
  t:=(args->>0)::uuid; select at.*,mm.student_id,mm.subject_id,qs.visibility_tracking into rec from app.attempts at join app.participants pa on pa.id=at.participant_id join app.memberships mm on mm.id=pa.membership_id join app.quiz_settings qs on qs.activity_id=pa.activity_id where at.id=t for update of at;
  if rec.student_id<>u then raise exception 'FORBIDDEN'; end if; perform app.require_student(rec.subject_id);
  if not rec.visibility_tracking or rec.closed_at is not null then return 'false'; end if;
  if (select count(*) from app.integrity_events where attempt_id=t and received_at>now()-interval '1 minute')>=6 then return 'false'; end if;
  tm:=(args->>2)::timestamptz; deadline:=(args->>3)::timestamptz;
  if tm<rec.started_at-interval '5 minutes' or tm>now()+interval '5 minutes' or deadline<tm then raise exception 'INVALID_SIGNAL'; end if;
  insert into app.integrity_events(attempt_id,client_event_key,hidden_at,visible_at) values(t,(args->>1)::uuid,tm,deadline) on conflict(attempt_id,client_event_key) do nothing;
  insert into app.incident_reviews(attempt_id,status) values(t,'pending') on conflict do nothing; return 'true';
 when 'reviewIncident' then
  t:=(args->>0)::uuid; select a.subject_id into s from app.attempts at join app.participants pa on pa.id=at.participant_id join app.activities a on a.id=pa.activity_id where at.id=t; perform app.require_owner(s);
  if args->>1 not in('reviewed_no_action','reviewed_observation') then raise exception 'INVALID_INCIDENT_STATUS'; end if;
  insert into app.incident_reviews values(t,args->>1,u,args->>2,now()) on conflict(attempt_id) do update set status=excluded.status,actor_id=u,comment=excluded.comment,reviewed_at=now(); return 'true';
 when 'ranking' then return app.ranking((args->>0)::uuid);
 when 'readActivity' then
  id:=(args->>0)::uuid; select * into x from app.activities where activities.id=id;
  if app.owns_subject(x.subject_id,false) then return app.activity_json(id); else return app.student_activity(id); end if;
 when 'readAttempt' then
  t:=(args->>0)::uuid; select a.subject_id,mm.student_id from app.attempts at join app.participants pa on pa.id=at.participant_id join app.activities a on a.id=pa.activity_id join app.memberships mm on mm.id=pa.membership_id where at.id=t into rec;
  if app.owns_subject(rec.subject_id,false) then return app.attempt_json(t,true); end if;
  perform app.require_student(rec.subject_id); if rec.student_id<>u then raise exception 'FORBIDDEN'; end if; return app.attempt_json(t);
 else raise exception 'UNKNOWN_COMMAND: Operación no disponible.';
 end case;
end $$;

create function app.snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=app.require_user(); teacher boolean; st jsonb; profiles jsonb; subjects jsonb; members jsonb; resources jsonb; versions jsonb; activities jsonb; attempts jsonb; powers jsonb; evaluations jsonb; tasks jsonb; submissions jsonb; manuals jsonb; help jsonb; studentviews jsonb:='{}'; results jsonb:='{}'; extra jsonb; rec record;
begin
 select role='teacher' into teacher from app.profiles where id=u;
 -- Materializar vencimientos propios o de las materias docentes; no modifica otros ámbitos.
 for rec in select at.id from app.attempts at join app.participants p on p.id=at.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where at.closed_at is null and (app.owns_subject(a.subject_id) or m.student_id=u and app.can_subject(a.subject_id)) and app.deadline(a.id,p.id,at.started_at)<=now() loop perform app.close_attempt(rec.id,'deadline'); end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.display_name,'role',pr.role,'email',case when pr.id=u then au.email else '' end)),'[]') into profiles from app.profiles pr join auth.users au on au.id=pr.id where pr.id=u or teacher and exists(select 1 from app.memberships m join app.subjects s on s.id=m.subject_id where m.student_id=pr.id and s.owner_id=u) or teacher and exists(select 1 from app.join_requests jr join app.invitation_codes c on c.id=jr.invitation_id join app.subjects s on s.id=c.subject_id where jr.student_id=pr.id and s.owner_id=u);
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s.id,'ownerId',s.owner_id,'name',s.name,'course',s.course_label,'year',s.school_year,'description',s.description,'status',case when s.archived_at is null then 'active' else 'archived' end,'archivedAt',s.archived_at))||jsonb_build_object('code',case when s.owner_id=u then (select code from app.invitation_codes where subject_id=s.id and revoked_at is null) else null end)),'[]') into subjects from app.subjects s where app.can_subject(s.id) or exists(select 1 from app.join_requests jr join app.invitation_codes c on c.id=jr.invitation_id where c.subject_id=s.id and jr.student_id=u and jr.status in ('pending','rejected'));
 select coalesce(jsonb_agg(j),'[]') into members from (
  select jsonb_build_object('id',m.id,'subjectId',m.subject_id,'studentId',m.student_id,'status',case m.status when 'withdrawn' then 'removed' else m.status end,'requestedAt',m.created_at,'decidedAt',m.updated_at) j from app.memberships m where app.owns_subject(m.subject_id,false) or m.student_id=u and app.can_subject(m.subject_id)
  union all select jsonb_build_object('id',jr.id,'subjectId',c.subject_id,'studentId',jr.student_id,'status',jr.status,'requestedAt',jr.requested_at,'decidedAt',jr.decided_at) from app.join_requests jr join app.invitation_codes c on c.id=jr.invitation_id where jr.status in ('pending','rejected') and (app.owns_subject(c.subject_id,false) or jr.student_id=u) and not exists(select 1 from app.memberships m where m.subject_id=c.subject_id and m.student_id=jr.student_id and m.status='approved')
 ) allmembers;
 select coalesce(jsonb_agg(d.document||jsonb_build_object('id',r.id,'ownerId',r.owner_id,'title',r.title,'kind',case r.kind when 'standalone_quiz' then 'quiz' else 'resource' end,'revision',d.revision,'updatedAt',d.updated_at)),'[]') into resources from app.resources r join app.resource_drafts d on d.resource_id=r.id where r.owner_id=u;
 select coalesce(jsonb_agg(app.version_json(v.id,true)),'[]') into versions from app.resource_versions v join app.resources r on r.id=v.resource_id where r.owner_id=u;
 select coalesce(jsonb_agg(app.activity_json(a.id)),'[]') into activities from app.activities a where a.kind='quiz' and (app.owns_subject(a.subject_id,false) or app.can_subject(a.subject_id) and a.published_at is not null);
 select coalesce(jsonb_agg(app.attempt_json(at.id,app.owns_subject(a.subject_id,false))),'[]') into attempts from app.attempts at join app.participants p on p.id=at.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where app.owns_subject(a.subject_id,false) or m.student_id=u and app.can_subject(a.subject_id);
 select coalesce(jsonb_agg(jsonb_build_object('activityId',p.activity_id,'studentId',m.student_id,'kind',pu.kind,'questionId',aq.question_key,'attemptId',aq.attempt_id,'at',pu.consumed_at)),'[]') into powers from app.powerup_uses pu join app.participants p on p.id=pu.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id join app.attempt_questions aq on aq.id=pu.attempt_question_id where app.owns_subject(a.subject_id,false) or m.student_id=u and app.can_subject(a.subject_id);
 select coalesce(jsonb_agg(app.evaluation_json(e.id)),'[]') into evaluations from app.evaluation_revisions e join app.participants p on p.id=e.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where e.published_at is not null and (app.owns_subject(a.subject_id,false) or m.student_id=u and app.can_subject(a.subject_id));
 select coalesce(jsonb_agg(app.task_json(a.id)),'[]') into tasks from app.activities a where a.kind='task' and (app.owns_subject(a.subject_id,false) or app.can_subject(a.subject_id) and a.published_at is not null);
 select coalesce(jsonb_agg(app.submission_json(v.id,app.owns_subject(a.subject_id,false))),'[]') into submissions from app.submission_versions v join app.submissions s on s.id=v.submission_id join app.participants p on p.id=s.participant_id join app.activities a on a.id=p.activity_id join app.memberships m on m.id=p.membership_id where app.owns_subject(a.subject_id,false) or m.student_id=u and app.can_subject(a.subject_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'subjectId',a.subject_id,'title',a.title,'description',coalesce(a.instructions,''),'occursAt',a.occurs_on,'maxGrade',a.max_grade,'weight',a.weight,'countsTowardAverage',a.counts_for_average)),'[]') into manuals from app.activities a where a.kind='manual' and (app.owns_subject(a.subject_id,false) or app.can_subject(a.subject_id) and a.published_at is not null);
 select coalesce(jsonb_agg(jsonb_build_object('userId',h.profile_id,'version',h.guide_version,'status',h.state)),'[]') into help from app.help_progress h where h.profile_id=u and h.guide_key='initial';
 if not teacher then
  for rec in select a.id from app.activities a where a.kind='quiz' and a.published_at is not null and app.can_subject(a.subject_id) loop studentviews:=studentviews||jsonb_build_object(rec.id,app.student_activity(rec.id)); end loop;
  for rec in select s.id from app.subjects s where app.can_subject(s.id) loop results:=results||jsonb_build_object(rec.id,app.student_results(rec.id)); end loop;
 end if;
 st:=jsonb_build_object('schemaVersion',1,'revision',floor(extract(epoch from clock_timestamp())*1000),'users',profiles,'subjects',subjects,'memberships',members,'resources',resources,'versions',versions,'activities',activities,'attempts',attempts,'powerups',powers,'evaluations',evaluations,'tasks',tasks,'submissions',submissions,'manualActivities',manuals,'helpPreferences',help);
 select jsonb_build_object('incidents',coalesce((select jsonb_agg(to_jsonb(ir)||jsonb_build_object('signalCount',(select count(*) from app.integrity_events where attempt_id=ir.attempt_id))) from app.incident_reviews ir join app.attempts at on at.id=ir.attempt_id join app.participants p on p.id=at.participant_id join app.activities a on a.id=p.activity_id where app.owns_subject(a.subject_id,false)),'[]'::jsonb),'teams',coalesce((select jsonb_agg(jsonb_build_object('id',te.id,'activityId',te.activity_id,'name',te.name,'studentIds',(select jsonb_agg(m.student_id) from app.team_members tm join app.participants p on p.id=tm.participant_id join app.memberships m on m.id=p.membership_id where tm.team_id=te.id))) from app.teams te join app.activities a on a.id=te.activity_id where app.owns_subject(a.subject_id,false)),'[]'::jsonb),'readings',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'subjectId',a.subject_id,'title',a.title,'content',app.version_json(a.version_id,false))) from app.activities a where a.kind='reading' and a.published_at is not null and app.can_subject(a.subject_id)),'[]'::jsonb),'draftEvaluations',coalesce((select jsonb_agg(app.evaluation_json(e.id)) from app.evaluation_revisions e join app.participants p on p.id=e.participant_id join app.activities a on a.id=p.activity_id where app.owns_subject(a.subject_id,false) and e.published_at is null),'[]'::jsonb)) into extra;
 return jsonb_build_object('state',st,'userId',u,'studentActivities',studentviews,'studentResults',results,'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'activityId',p.activity_id,'studentId',m.student_id,'alias','Participante '||lpad(p.alias_no::text,2,'0'))) from app.participants p join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where app.owns_subject(a.subject_id,false)),'[]'::jsonb))||extra;
end $$;

-- Storage privado: referencias de biblioteca o pertenencia vigente, nunca solo URL opaca.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('aulify-files','aulify-files',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create function app.can_file(fid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.file_objects f where f.id=fid and f.state='ready' and (
  exists(select 1 from app.draft_files df join app.resources r on r.id=df.resource_id where df.file_id=fid and r.owner_id=auth.uid()) or
  exists(select 1 from app.content_blocks cb join app.resource_versions rv on rv.id=cb.version_id join app.resources r on r.id=rv.resource_id where cb.file_id=fid and (r.owner_id=auth.uid() or exists(select 1 from app.activities a where a.version_id=rv.id and a.published_at is not null and app.can_subject(a.subject_id)))) or
  exists(select 1 from app.submission_files sf join app.submission_versions sv on sv.id=sf.submission_version_id join app.submissions su on su.id=sv.submission_id join app.participants p on p.id=su.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where sf.file_id=fid and (app.owns_subject(a.subject_id,false) or m.student_id=auth.uid() and app.can_subject(a.subject_id))) or
  f.owner_id=auth.uid() and f.created_at>now()-interval '1 hour' and not exists(select 1 from app.submission_files where file_id=fid)));
$$;
create policy aulify_file_read on storage.objects for select to authenticated using(bucket_id='aulify-files' and exists(select 1 from app.file_objects f where f.bucket=bucket_id and f.object_path=name and app.can_file(f.id)));
-- Subida exclusivamente mediante endpoint servidor que valida bytes. No hay escritura cliente genérica.
create function app.register_file(p_owner uuid,p_id uuid,p_name text,p_mime text,p_size bigint,p_sha256 text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_name ~ '[/\\]' or length(p_name)>255 or p_size<=0 or p_size>10485760 or p_mime not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp') or p_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_FILE'; end if;
 if not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null) or not exists(select 1 from storage.objects where bucket_id='aulify-files' and name=p_owner::text||'/'||p_id::text) then raise exception 'UPLOAD_NOT_FOUND'; end if;
 insert into app.file_objects(id,owner_id,bucket,object_path,original_name,mime_type,byte_size,sha256,state,validated_at) values(p_id,p_owner,'aulify-files',p_owner::text||'/'||p_id::text,p_name,p_mime,p_size,p_sha256,'ready',now()); return jsonb_build_object('id',p_id,'name',p_name,'size',p_size,'mimeType',p_mime);
end $$;
create function app.file(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app.require_user(); if not app.can_file(p_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return (select jsonb_build_object('id',id,'bucket',bucket,'path',object_path,'name',original_name,'mimeType',mime_type,'size',byte_size) from app.file_objects where id=p_id);
end $$;
create function public.aulify_command(p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app.command(p_action,p_payload); $$;
create function public.aulify_snapshot() returns jsonb language sql security invoker set search_path='' as $$ select app.snapshot(); $$;

-- RLS como defensa adicional; ninguna tabla app se concede para DML a clientes.
create policy profile_self on app.profiles for select to authenticated using(id=(select auth.uid()));
create policy subject_visibility on app.subjects for select to authenticated using(app.can_subject(id));
create policy membership_visibility on app.memberships for select to authenticated using(app.owns_subject(subject_id,false) or student_id=(select auth.uid()) and app.can_subject(subject_id));
create policy resource_owner on app.resources for select to authenticated using(owner_id=(select auth.uid()));
create policy draft_owner on app.resource_drafts for select to authenticated using(exists(select 1 from app.resources r where r.id=resource_id and r.owner_id=(select auth.uid())));
create policy file_visibility on app.file_objects for select to authenticated using(app.can_file(id));
revoke all on all functions in schema app from public,anon,authenticated;
grant execute on function app.command(text,jsonb),app.snapshot(),app.can_file(uuid) to authenticated;
-- Storage usa exclusivamente un helper de lectura; no se concede app.file_objects directamente.
drop policy aulify_file_read on storage.objects;
create function app.can_storage_object(b text,n text) returns boolean language sql stable security definer set search_path='' as $$ select b='aulify-files' and exists(select 1 from app.file_objects f where f.bucket=b and f.object_path=n and app.can_file(f.id)); $$;
revoke all on function app.can_storage_object(text,text) from public,anon,authenticated;
grant execute on function app.can_storage_object(text,text) to authenticated;
create policy aulify_file_read on storage.objects for select to authenticated using(app.can_storage_object(bucket_id,name));
revoke all on function public.aulify_command(text,jsonb),public.aulify_snapshot(),app.file(uuid),app.register_file(uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.aulify_command(text,jsonb),public.aulify_snapshot(),app.file(uuid) to authenticated;
grant execute on function app.register_file(uuid,uuid,text,text,bigint,text) to service_role;
