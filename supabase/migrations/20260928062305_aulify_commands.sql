-- Contratos explícitos: los clientes no modifican tablas, puntajes ni identidades.
alter table app.subjects add column description text not null default '';
alter table app.resource_versions add column editor_document jsonb;
alter table app.submission_versions add column note text not null default '';
alter table app.profiles add constraint profile_role check(role in ('teacher','student'));
alter table app.profiles add constraint profile_name check(length(trim(display_name)) between 1 and 120);
alter table app.subjects add constraint subject_year check(school_year between 2000 and 2200);
alter table app.subjects add constraint subject_name check(length(trim(name))>0 and length(trim(course_label))>0);
alter table app.memberships add constraint membership_status check(status in ('approved','withdrawn'));
alter table app.join_requests add constraint request_status check(status in ('pending','approved','rejected'));
alter table app.join_requests add constraint request_decision check((status='pending')=(decided_at is null and decided_by is null));
alter table app.resources add constraint resource_kind check(kind in ('resource','standalone_quiz'));
alter table app.resource_drafts add constraint positive_revision check(revision>0 and schema_version=1 and octet_length(document::text)<=5242880);
alter table app.questions add constraint question_kind check(kind in ('single','multiple','boolean','match','order','gap_choice','gap_text','open'));
alter table app.questions add constraint question_points check(max_points>0);
alter table app.questions add constraint question_mode check(correction_mode in ('automatic','manual') and (kind not in ('gap_text','open') or correction_mode='manual'));
alter table app.item_solutions add constraint one_solution_form check(num_nonnulls(is_correct,target_item_key,expected_position)=1);
alter table app.activities add constraint activity_kind check(kind in ('reading','quiz','task','manual'));
alter table app.activities add constraint activity_shape check((kind in ('reading','quiz'))=(version_id is not null) and (kind='reading' and max_grade is null and weight is null and not counts_for_average or kind<>'reading' and max_grade>0 and weight>0));
alter table app.activities add constraint activity_dates check(closes_at is null or opens_at<closes_at);
alter table app.activities add constraint activity_title check(length(trim(title))>0);
alter table app.quiz_settings add constraint quiz_rules check(purpose in ('practice','exam') and pacing in ('self_paced','guided') and feedback_policy in ('immediate','after_close','hidden') and attempt_limit>0 and (duration_seconds is null or duration_seconds>0) and (pacing<>'guided' or attempt_limit=1 and not shuffle_groups) and (feedback_policy<>'hidden' or not ranking_enabled and not streaks_enabled));
alter table app.attempts add constraint attempt_close check((closed_at is null)=(close_reason is null));
alter table app.question_grades add constraint grade_fraction check(points_num>=0 and points_den>0 and points_num=trunc(points_num) and points_den=trunc(points_den));
alter table app.powerup_uses add constraint powerup_kind check(kind in ('hint','double'));
alter table app.attempt_resolutions add constraint resolution_kind check(decision in ('evaluate','exclude') and length(trim(reason))>0);
alter table app.evaluation_revisions add constraint evaluation_source check((source_kind='quiz' and attempt_id is not null and submission_version_id is null) or (source_kind='submission' and attempt_id is null and submission_version_id is not null) or (source_kind in ('manual','nonparticipation') and attempt_id is null and submission_version_id is null));
alter table app.evaluation_revisions add constraint evaluation_grade check(grade>=0 and revision_no>0);
alter table app.file_objects add constraint valid_file_size check(byte_size>0 and byte_size<=10485760);
alter table app.file_objects add constraint file_state check(state in ('pending','ready','delete_pending'));
alter table app.submission_files add constraint file_position check(position between 1 and 5);
create unique index one_live_code on app.invitation_codes(subject_id) where revoked_at is null;
create unique index one_open_attempt on app.attempts(participant_id) where closed_at is null;
create unique index one_open_guided_question on app.session_questions(activity_id) where opened_at is not null and closed_at is null;
create unique index one_active_purge on app.purge_jobs(subject_id) where status in ('scheduled','running','failed');
create index subjects_filters on app.subjects(owner_id,school_year,course_label);
create index memberships_student on app.memberships(student_id,status);
create index requests_rate on app.join_requests(student_id,requested_at);
create index resources_library on app.resources(owner_id,updated_at desc);
create index published_evaluations on app.evaluation_revisions(participant_id,revision_no desc) where published_at is not null;

create function app.require_user() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise exception 'AUTH_REQUIRED: Confirma tu correo e inicia sesión.' using errcode='42501'; end if;
 if not exists(select 1 from app.profiles where id=u) then raise exception 'PROFILE_REQUIRED: Completa el perfil.' using errcode='42501'; end if;
 return u;
end $$;
create function app.bootstrap_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into app.profiles(id,display_name,role) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Usuario'),120),case when new.raw_user_meta_data->>'role'='teacher' then 'teacher' else 'student' end);
 return new;
end $$;
create trigger aulify_profile after insert on auth.users for each row execute function app.bootstrap_profile();
insert into app.profiles(id,display_name,role)
select id,left(coalesce(nullif(trim(raw_user_meta_data->>'name'),''),'Usuario'),120),case when raw_user_meta_data->>'role'='teacher' then 'teacher' else 'student' end from auth.users on conflict(id) do nothing;
create function app.owns_subject(s uuid, active boolean default true) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.subjects where id=s and owner_id=auth.uid() and (not active or archived_at is null and purge_started_at is null));
$$;
create function app.can_subject(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select app.owns_subject(s,false) or exists(select 1 from app.memberships m join app.subjects x on x.id=m.subject_id where x.id=s and m.student_id=auth.uid() and m.status='approved' and x.archived_at is null and x.purge_started_at is null);
$$;
create function app.require_owner(s uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform 1 from app.subjects where id=s for share;
 if not app.owns_subject(s) then raise exception 'FORBIDDEN: La materia no está disponible para esta operación.' using errcode='42501'; end if;
end $$;
create function app.require_student(s uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare m uuid; begin
 perform 1 from app.subjects where id=s for share;
 perform 1 from app.memberships where subject_id=s and student_id=auth.uid() for share;
 select x.id into m from app.memberships x join app.subjects y on y.id=x.subject_id where y.id=s and x.student_id=auth.uid() and x.status='approved' and y.archived_at is null and y.purge_started_at is null;
 if m is null then raise exception 'MEMBERSHIP_REQUIRED: Necesitas aprobación vigente en esta materia.' using errcode='42501'; end if; return m;
end $$;
create function app.new_code() returns text language plpgsql volatile set search_path='' as $$
declare s text:=''; chars text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; bytes bytea:=uuid_send(gen_random_uuid()); begin
 for i in 0..7 loop s:=s||substr(chars,1+(get_byte(bytes,i)%length(chars)),1); end loop; return s;
end $$;
create function app.deadline(a uuid,p uuid default null,started timestamptz default null) returns timestamptz language sql stable security definer set search_path='' as $$
 select least(greatest(x.closes_at,(select max(new_deadline) from app.deadline_extensions where activity_id=a and participant_id is null)),
 case when started is null or q.duration_seconds is null then 'infinity'::timestamptz else greatest(started+make_interval(secs=>q.duration_seconds),(select max(new_deadline) from app.deadline_extensions where participant_id=p)) end)
 from app.activities x left join app.quiz_settings q on q.activity_id=x.id where x.id=a;
$$;
create function app.ensure_participant(a uuid,m uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare p uuid; begin
 perform 1 from app.activities where id=a for update;
 if not exists(select 1 from app.activities x join app.memberships y on y.subject_id=x.subject_id where x.id=a and y.id=m) then raise exception 'INVALID_MEMBERSHIP'; end if;
 select id into p from app.participants where activity_id=a and membership_id=m;
 if p is null then insert into app.participants(activity_id,membership_id,alias_no) select a,m,coalesce(max(alias_no),0)+1 from app.participants where activity_id=a returning id into p; end if; return p;
end $$;

-- Publicación normalizada: borrador JSON de edición, preguntas y soluciones separadas.
create function app.publish_resource(rid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r app.resources; d jsonb; v uuid:=gen_random_uuid(); b jsonb; q jsonb; it jsonb; bl jsonb; gid uuid; qid uuid; bid uuid; iid uuid; pid uuid; pos int:=0; gp int:=0; qp int; ip int; num int; solution text; typ text; maxi numeric;
begin
 select * into r from app.resources where id=rid and owner_id=auth.uid() for update;
 if r.id is null then raise exception 'FORBIDDEN: Recurso ajeno.' using errcode='42501'; end if;
 select document into d from app.resource_drafts where resource_id=rid;
 if length(trim(r.title))=0 or jsonb_typeof(d->'blocks')<>'array' or jsonb_array_length(d->'blocks') not between 1 and 200 then raise exception 'INVALID_BLOCKS'; end if;
 if (select count(*) from jsonb_array_elements(d->'blocks') z where z->>'type'='quiz')>1 then raise exception 'ONE_QUIZ'; end if;
 insert into app.resource_versions(id,resource_id,version_no,title,content_schema_version,editor_document) select v,rid,coalesce(max(version_no),0)+1,r.title,1,d->'editorDocument' from app.resource_versions where resource_id=rid;
 for b in select value from jsonb_array_elements(d->'blocks') loop
  pos:=pos+1; bid:=(b->>'id')::uuid; typ:=b->>'type';
  if typ not in ('heading','text','list','image','video','quiz') then raise exception 'INVALID_BLOCK'; end if;
  if typ='image' and (length(trim(coalesce(b->>'alt','')))=0 or b->>'fileId' is null) then raise exception 'INVALID_IMAGE: Usa una imagen privada validada con texto alternativo.'; end if;
  if typ='video' and coalesce(b->>'url','') !~ '^https://' then raise exception 'INVALID_VIDEO'; end if;
  if typ='image' and not exists(select 1 from app.file_objects where id=(b->>'fileId')::uuid and owner_id=auth.uid() and state='ready' and byte_size<=5242880 and mime_type in ('image/png','image/jpeg','image/webp')) then raise exception 'INVALID_IMAGE'; end if;
  insert into app.content_blocks(version_id,block_key,position,kind,body,file_id,alt_text,external_url) values(v,bid,pos,case typ when 'video' then 'video_link' else typ end,b-'questions'-'url'-'fileId',case when typ='image' then (b->>'fileId')::uuid end,b->>'alt',case when typ='video' then b->>'url' end);
  if typ<>'quiz' then continue; end if;
  if jsonb_typeof(b->'questions')<>'array' or jsonb_array_length(b->'questions') not between 1 and 100 then raise exception 'INVALID_QUIZ'; end if;
  for q in select value from jsonb_array_elements(b->'questions') loop
   qid:=(q->>'id')::uuid; gid:=coalesce((q->>'groupId')::uuid,qid); gp:=gp+1;
   insert into app.question_groups values(v,gid,gp) on conflict(version_id,group_key) do nothing;
   select coalesce(max(position),0)+1 into qp from app.questions where version_id=v and group_key=gid;
   typ:=q->>'type'; maxi:=(q->>'points')::numeric;
   if length(trim(coalesce(q->>'prompt','')))=0 or maxi<=0 or round(maxi,2)<>maxi then raise exception 'INVALID_QUESTION'; end if;
   insert into app.questions values(v,qid,gid,qp,case typ when 'true-false' then 'boolean' when 'matching' then 'match' when 'ordering' then 'order' when 'fill-options' then 'gap_choice' when 'fill-text' then 'gap_text' else typ end,jsonb_build_object('text',q->>'prompt','template',q->>'template'),maxi,case when typ in ('open','fill-text') or coalesce((q->>'manual')::boolean,false) then 'manual' else 'automatic' end);
   if typ in ('open','fill-text') and length(trim(coalesce(q->>'manualGuide','')))=0 then raise exception 'MANUAL_GUIDE_REQUIRED'; end if;
   insert into app.question_secrets values(v,qid,q->>'manualGuide',q->>'explanation',q->>'hint');
   ip:=0;
   if typ in ('single','multiple') then
    if jsonb_array_length(q->'options') not between 2 and 8 then raise exception 'INVALID_OPTIONS'; end if;
    for it in select value from jsonb_array_elements(q->'options') loop
     ip:=ip+1; iid:=(it->>'id')::uuid; if length(trim(coalesce(it->>'text','')))=0 then raise exception 'INVALID_OPTION_LABEL'; end if;
     insert into app.question_items values(v,qid,iid,null,'choice',ip,it->>'text');
     insert into app.item_solutions values(v,qid,iid,case when typ='single' then iid::text=q->>'correctOptionId' else (q->'correctOptionIds') ? iid::text end,null,null);
    end loop;
    if (select count(*) from app.item_solutions where version_id=v and question_key=qid and is_correct) <1 then raise exception 'INVALID_SOLUTION'; end if;
   elsif typ='true-false' then
    if jsonb_typeof(q->'correct')<>'boolean' then raise exception 'INVALID_SOLUTION'; end if;
    for num in 1..2 loop iid:=gen_random_uuid(); insert into app.question_items values(v,qid,iid,null,'choice',num,case num when 1 then 'true' else 'false' end); insert into app.item_solutions values(v,qid,iid,(num=1)=(q->>'correct')::boolean,null,null); end loop;
   elsif typ='matching' then
    if jsonb_array_length(q->'left') not between 2 and 12 or jsonb_array_length(q->'left')<>jsonb_array_length(q->'right') then raise exception 'INVALID_MATCH'; end if;
    for it in select value from jsonb_array_elements(q->'right') loop ip:=ip+1; insert into app.question_items values(v,qid,(it->>'id')::uuid,null,'right',ip,it->>'text'); end loop;
    for it in select value from jsonb_array_elements(q->'left') loop ip:=ip+1; iid:=(it->>'id')::uuid; insert into app.question_items values(v,qid,iid,null,'left',ip,it->>'text'); solution:=q->'pairs'->>iid::text; if not exists(select 1 from app.question_items where version_id=v and question_key=qid and item_key=solution::uuid and kind='right') then raise exception 'INVALID_MATCH'; end if; insert into app.item_solutions values(v,qid,iid,null,solution::uuid,null); end loop;
    if (select count(distinct target_item_key) from app.item_solutions where version_id=v and question_key=qid)<>jsonb_array_length(q->'left') then raise exception 'INVALID_MATCH'; end if;
   elsif typ='ordering' then
    if jsonb_array_length(q->'items') not between 2 and 12 or jsonb_array_length(q->'correctOrder')<>jsonb_array_length(q->'items') then raise exception 'INVALID_ORDER'; end if;
    for it in select value from jsonb_array_elements(q->'items') loop ip:=ip+1; iid:=(it->>'id')::uuid; insert into app.question_items values(v,qid,iid,null,'sequence',ip,it->>'text'); select ordinality::int into num from jsonb_array_elements_text(q->'correctOrder') with ordinality where value=iid::text; if num is null then raise exception 'INVALID_ORDER'; end if; insert into app.item_solutions values(v,qid,iid,null,null,num); end loop;
   elsif typ in ('fill-options','fill-text') then
    if jsonb_array_length(q->'blanks') not between 1 and 10 then raise exception 'INVALID_BLANKS'; end if;
    for bl in select value from jsonb_array_elements(q->'blanks') loop
     ip:=ip+1; pid:=(bl->>'id')::uuid; if position('{'||pid::text||'}' in coalesce(q->>'template',''))=0 then raise exception 'INVALID_TEMPLATE'; end if;
     insert into app.question_items values(v,qid,pid,null,'gap',ip,coalesce(bl->>'label','Espacio'));
     if typ='fill-options' then
      if jsonb_array_length(bl->'options') not between 2 and 8 then raise exception 'INVALID_OPTIONS'; end if;
      for it in select value from jsonb_array_elements(bl->'options') loop ip:=ip+1; insert into app.question_items values(v,qid,(it->>'id')::uuid,pid,'choice',ip,it->>'text'); end loop;
      if not exists(select 1 from app.question_items where version_id=v and question_key=qid and parent_item_key=pid and item_key=(bl->>'correctOptionId')::uuid) then raise exception 'INVALID_SOLUTION'; end if;
      insert into app.item_solutions values(v,qid,pid,null,(bl->>'correctOptionId')::uuid,null);
     end if;
    end loop;
   end if;
  end loop;
 end loop;
 if r.kind='standalone_quiz' and not exists(select 1 from app.questions where version_id=v) then raise exception 'INVALID_QUIZ'; end if;
 return v;
end $$;

create function app.question_json(v uuid,k uuid,secret boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q app.questions; s app.question_secrets; j jsonb; t text; opts jsonb; x jsonb;
begin
 select * into q from app.questions where version_id=v and question_key=k; select * into s from app.question_secrets where version_id=v and question_key=k;
 t:=case q.kind when 'boolean' then 'true-false' when 'match' then 'matching' when 'order' then 'ordering' when 'gap_choice' then 'fill-options' when 'gap_text' then 'fill-text' else q.kind end;
 j:=jsonb_build_object('id',k,'type',t,'prompt',q.prompt->>'text','points',q.max_points,'manual',q.correction_mode='manual','groupId',q.group_key);
 if secret then j:=j||jsonb_build_object('manualGuide',s.manual_guide,'explanation',s.feedback,'hint',s.hint); end if;
 if q.kind in ('single','multiple') then
  select jsonb_agg(jsonb_build_object('id',item_key,'text',label) order by position) into opts from app.question_items where version_id=v and question_key=k;
  j:=j||jsonb_build_object('options',opts);
  if secret then if q.kind='single' then select jsonb_build_object('correctOptionId',item_key) into x from app.item_solutions where version_id=v and question_key=k and is_correct; else select jsonb_build_object('correctOptionIds',jsonb_agg(item_key)) into x from app.item_solutions where version_id=v and question_key=k and is_correct; end if; j:=j||x; end if;
 elsif q.kind='boolean' and secret then select jsonb_build_object('correct',i.label='true') into x from app.item_solutions z join app.question_items i using(version_id,question_key,item_key) where z.version_id=v and z.question_key=k and z.is_correct; j:=j||x;
 elsif q.kind='match' then
  select jsonb_build_object('left',jsonb_agg(jsonb_build_object('id',item_key,'text',label) order by position) filter(where kind='left'),'right',jsonb_agg(jsonb_build_object('id',item_key,'text',label) order by position) filter(where kind='right')) into x from app.question_items where version_id=v and question_key=k; j:=j||x;
  if secret then select jsonb_build_object('pairs',jsonb_object_agg(item_key,target_item_key)) into x from app.item_solutions where version_id=v and question_key=k; j:=j||x; end if;
 elsif q.kind='order' then
  select jsonb_build_object('items',jsonb_agg(jsonb_build_object('id',item_key,'text',label) order by position)) into x from app.question_items where version_id=v and question_key=k; j:=j||x;
  if secret then select jsonb_build_object('correctOrder',jsonb_agg(item_key order by expected_position)) into x from app.item_solutions where version_id=v and question_key=k; j:=j||x; end if;
 elsif q.kind in ('gap_choice','gap_text') then
  select jsonb_agg(jsonb_build_object('id',i.item_key,'label',i.label)||case when q.kind='gap_choice' then jsonb_build_object('options',(select jsonb_agg(jsonb_build_object('id',c.item_key,'text',c.label) order by c.position) from app.question_items c where c.version_id=v and c.question_key=k and c.parent_item_key=i.item_key))||case when secret then jsonb_build_object('correctOptionId',(select target_item_key from app.item_solutions where version_id=v and question_key=k and item_key=i.item_key)) else '{}'::jsonb end else '{}'::jsonb end order by i.position) into x from app.question_items i where i.version_id=v and i.question_key=k and i.kind='gap';
  j:=j||jsonb_build_object('template',q.prompt->>'template','blanks',x);
 end if; return jsonb_strip_nulls(j);
end $$;
create function app.version_json(v uuid,secret boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',x.id,'resourceId',x.resource_id,'ownerId',r.owner_id,'number',x.version_no,'title',x.title,'publishedAt',x.published_at,'editorDocument',x.editor_document,'blocks',coalesce((select jsonb_agg(b.body||jsonb_build_object('id',b.block_key,'type',case b.kind when 'video_link' then 'video' else b.kind end)||case when b.kind='quiz' then jsonb_build_object('questions',(select jsonb_agg(app.question_json(v,q.question_key,secret) order by g.position,q.position) from app.questions q join app.question_groups g using(version_id,group_key) where q.version_id=v)) when b.kind='video_link' then jsonb_build_object('url',b.external_url) when b.kind='image' then jsonb_build_object('fileId',b.file_id,'url','/api/files/'||b.file_id::text,'alt',b.alt_text) else '{}'::jsonb end order by b.position) from app.content_blocks b where b.version_id=v),'[]'::jsonb)) from app.resource_versions x join app.resources r on r.id=x.resource_id where x.id=v;
$$;

create function app.activity_json(a uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',x.id,'subjectId',x.subject_id,'versionId',x.version_id,'title',x.title,'createdAt',x.created_at,'lockedAt',x.locked_at,'settings',jsonb_build_object('purpose',q.purpose,'pace',case q.pacing when 'guided' then 'guided' else 'individual' end,'maxGrade',x.max_grade,'weight',x.weight,'countsTowardAverage',x.counts_for_average,'maxAttempts',q.attempt_limit,'opensAt',x.opens_at,'closesAt',app.deadline(a),'timeLimitMinutes',q.duration_seconds/60.0,'timeZone',x.timezone,'feedback',replace(q.feedback_policy,'_','-'),'manualCorrection',q.manual_closed_questions,'shuffleQuestions',q.shuffle_groups,'shuffleOptions',q.shuffle_options,'streaks',q.streaks_enabled,'sound',q.sound_allowed,'ranking',q.ranking_enabled,'teams',q.teams_enabled,'allowHint',q.hint_enabled,'allowDouble',q.double_enabled,'bonusAffectsGrade',q.bonus_affects_grade,'reportVisibility',q.visibility_tracking)) || case when q.pacing='guided' then jsonb_build_object('guided',jsonb_build_object('status',case when s.closed_at is not null then 'closed' when s.started_at is not null then 'running' else 'waiting' end,'questionIndex',coalesce((select max(position)-1 from app.session_questions where activity_id=a and opened_at is not null),0),'questionOpen',exists(select 1 from app.session_questions where activity_id=a and opened_at is not null and closed_at is null),'studentIds',coalesce((select jsonb_agg(m.student_id) from app.participants p join app.memberships m on m.id=p.membership_id where p.activity_id=a and p.room_joined_at is not null),'[]'::jsonb))) else '{}'::jsonb end from app.activities x join app.quiz_settings q on q.activity_id=x.id left join app.guided_sessions s on s.activity_id=x.id where x.id=a;
$$;
create function app.write_quiz_settings(a uuid,s jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from pg_timezone_names where name=s->>'timeZone') then raise exception 'INVALID_TIME_ZONE'; end if;
 if (s->>'opensAt') is null or (s->>'closesAt') is null or round((s->>'maxGrade')::numeric,2)<>(s->>'maxGrade')::numeric or round((s->>'weight')::numeric,2)<>(s->>'weight')::numeric then raise exception 'INVALID_SETTINGS'; end if;
 update app.activities set opens_at=(s->>'opensAt')::timestamptz,closes_at=(s->>'closesAt')::timestamptz,timezone=s->>'timeZone',max_grade=(s->>'maxGrade')::numeric,weight=(s->>'weight')::numeric,counts_for_average=(s->>'countsTowardAverage')::boolean where id=a;
 insert into app.quiz_settings values(a,s->>'purpose',case s->>'pace' when 'guided' then 'guided' when 'individual' then 'self_paced' else s->>'pace' end,(s->>'maxAttempts')::int,((s->>'timeLimitMinutes')::numeric*60)::int,coalesce((s->>'manualCorrection')::boolean,false),replace(s->>'feedback','-','_'),coalesce((s->>'shuffleQuestions')::boolean,false),coalesce((s->>'shuffleOptions')::boolean,false),coalesce((s->>'teams')::boolean,false),coalesce((s->>'ranking')::boolean,false),coalesce((s->>'streaks')::boolean,false),coalesce((s->>'sound')::boolean,false),coalesce((s->>'allowHint')::boolean,false),coalesce((s->>'allowDouble')::boolean,false),coalesce((s->>'bonusAffectsGrade')::boolean,false),coalesce((s->>'reportVisibility')::boolean,false))
 on conflict(activity_id) do update set purpose=excluded.purpose,pacing=excluded.pacing,attempt_limit=excluded.attempt_limit,duration_seconds=excluded.duration_seconds,manual_closed_questions=excluded.manual_closed_questions,feedback_policy=excluded.feedback_policy,shuffle_groups=excluded.shuffle_groups,shuffle_options=excluded.shuffle_options,teams_enabled=excluded.teams_enabled,ranking_enabled=excluded.ranking_enabled,streaks_enabled=excluded.streaks_enabled,sound_allowed=excluded.sound_allowed,hint_enabled=excluded.hint_enabled,double_enabled=excluded.double_enabled,bonus_affects_grade=excluded.bonus_affects_grade,visibility_tracking=excluded.visibility_tracking;
 delete from app.guided_sessions where activity_id=a;
 if s->>'pace'='guided' then
  insert into app.guided_sessions(activity_id,revision) values(a,1);
  insert into app.session_questions(activity_id,position,version_id,question_key) select a,row_number() over(order by g.position,q.position),q.version_id,q.question_key from app.questions q join app.question_groups g using(version_id,group_key) where q.version_id=(select version_id from app.activities where id=a);
 end if;
end $$;
create function app.close_attempt(t uuid,cause text) returns void language plpgsql security definer set search_path='' as $$
begin
 update app.attempts set closed_at=now(),close_reason=cause where id=t and closed_at is null;
 if cause not in ('withdrawal','archive','teacher_early') then
  insert into app.question_grades(attempt_question_id,revision_no,points_num,points_den,method,engine_version)
  select aq.id,1,0,1,'omission','1.0' from app.attempt_questions aq where aq.attempt_id=t and not exists(select 1 from app.responses where attempt_question_id=aq.id) and not exists(select 1 from app.question_grades where attempt_question_id=aq.id);
 end if;
end $$;
create function app.begin_attempt(a uuid,p uuid,req uuid default gen_random_uuid()) returns uuid language plpgsql security definer set search_path='' as $$
declare x app.activities; q app.quiz_settings; t uuid; total int; v uuid;
begin
 select * into x from app.activities where id=a for update; select * into q from app.quiz_settings where activity_id=a;
 perform 1 from app.participants where id=p and activity_id=a for update;
 if not found then raise exception 'INVALID_PARTICIPANT'; end if;
 select id into t from app.attempts where participant_id=p and closed_at is null;
 if t is not null then if app.deadline(a,p,(select started_at from app.attempts where id=t))>now() then return t; else perform app.close_attempt(t,'deadline'); end if; end if;
 if x.published_at is null or now()<x.opens_at or now()>=app.deadline(a) then raise exception 'ACTIVITY_CLOSED'; end if;
 select count(*) into total from app.attempts where participant_id=p;
 if total>=q.attempt_limit then raise exception 'ATTEMPTS_EXHAUSTED'; end if;
 if q.teams_enabled and (not exists(select 1 from app.team_members where participant_id=p) or exists(select 1 from app.teams where activity_id=a and id not in(select team_id from app.team_members))) then raise exception 'TEAMS_REQUIRED'; end if;
 update app.activities set locked_at=coalesce(locked_at,now()) where id=a;
 insert into app.attempts(participant_id,attempt_no,request_key) values(p,total+1,req) returning id into t;
 insert into app.attempt_questions(attempt_id,version_id,question_key,position,item_order)
 select t,qu.version_id,qu.question_key,row_number() over(order by gp.sort,qu.position),jsonb_build_object('items',coalesce((select jsonb_agg(i.item_key order by case when q.shuffle_options or qu.kind='order' then random() else i.position::float end) from app.question_items i where i.version_id=qu.version_id and i.question_key=qu.question_key),'[]'::jsonb))
 from app.questions qu join (select g.*,case when q.shuffle_groups then random() else g.position::float end sort from app.question_groups g where version_id=x.version_id) gp using(version_id,group_key) where qu.version_id=x.version_id;
 return t;
end $$;

-- Las fracciones se almacenan como enteros; no se redondea hasta la nota final.
create function app.score_answer(aq uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q app.questions; v uuid; k uuid; n int:=0; c int:=0; total int:=1; got jsonb; expected jsonb; valid boolean:=true; force_manual boolean;
begin
 select x.version_id,x.question_key into v,k from app.attempt_questions x where x.id=aq;
 select * into q from app.questions where version_id=v and question_key=k;
 if payload->>'type'<>app.question_json(v,k)->>'type' then raise exception 'ANSWER_TYPE'; end if;
 if octet_length(payload::text)>60000 then raise exception 'ANSWER_LIMIT'; end if;
 if q.kind='single' then
  valid:=exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=(payload->>'optionId')::uuid);
  select count(*) into c from app.item_solutions where version_id=v and question_key=k and is_correct and item_key=(payload->>'optionId')::uuid;
 elsif q.kind='multiple' then
  select count(*),count(distinct value) into n,c from jsonb_array_elements_text(payload->'optionIds');
  valid:=n>0 and n=c and n=(select count(*) from app.question_items where version_id=v and question_key=k and item_key::text in(select jsonb_array_elements_text(payload->'optionIds')));
  select jsonb_agg(value order by value) into got from jsonb_array_elements_text(payload->'optionIds');
  select jsonb_agg(item_key::text order by item_key::text) into expected from app.item_solutions where version_id=v and question_key=k and is_correct; c:=case when got=expected then 1 else 0 end;
 elsif q.kind='boolean' then
  valid:=jsonb_typeof(payload->'value')='boolean'; select count(*) into c from app.item_solutions s join app.question_items i using(version_id,question_key,item_key) where s.version_id=v and s.question_key=k and s.is_correct and i.label=payload->>'value';
 elsif q.kind='match' then
  select count(*) into total from app.question_items where version_id=v and question_key=k and kind='left';
  select count(*),count(distinct value) into n,c from jsonb_each_text(payload->'pairs'); valid:=n=total and c=total;
  valid:=valid and not exists(select 1 from jsonb_each_text(payload->'pairs') p where not exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=p.key::uuid and kind='left') or not exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=p.value::uuid and kind='right'));
  select count(*) into c from app.item_solutions where version_id=v and question_key=k and target_item_key::text=payload->'pairs'->>item_key::text;
 elsif q.kind='order' then
  select count(*) into total from app.question_items where version_id=v and question_key=k;
  select count(*),count(distinct value) into n,c from jsonb_array_elements_text(payload->'itemIds'); valid:=n=total and c=total and n=(select count(*) from app.question_items where version_id=v and question_key=k and item_key::text in(select jsonb_array_elements_text(payload->'itemIds')));
  select count(*) into c from app.item_solutions where version_id=v and question_key=k and item_key::text=payload->'itemIds'->>(expected_position-1);
 elsif q.kind in ('gap_choice','gap_text') then
  got:=case q.kind when 'gap_choice' then payload->'choices' else payload->'texts' end;
  select count(*) into total from app.question_items where version_id=v and question_key=k and kind='gap'; select count(*) into n from jsonb_each_text(got); valid:=n=total;
  valid:=valid and not exists(select 1 from jsonb_each_text(got) p where not exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=p.key::uuid and kind='gap') or case when q.kind='gap_choice' then not exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=p.value::uuid and parent_item_key=p.key::uuid) else length(trim(p.value)) not between 1 and 5000 end);
  if q.kind='gap_choice' then select count(*) into c from app.item_solutions where version_id=v and question_key=k and target_item_key::text=got->>item_key::text; end if;
 elsif q.kind='open' then valid:=jsonb_typeof(payload->'text')='string' and length(trim(payload->>'text')) between 1 and 5000;
 end if;
 if valid is not true then raise exception 'INVALID_ANSWER'; end if;
 select z.manual_closed_questions into force_manual from app.attempt_questions w join app.attempts t on t.id=w.attempt_id join app.participants p on p.id=t.participant_id join app.quiz_settings z on z.activity_id=p.activity_id where w.id=aq;
 if q.correction_mode='manual' or force_manual then return null; end if;
 return jsonb_build_object('numerator',q.max_points*100*c,'denominator',100*total);
end $$;
create function app.attempt_score(t uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare x record; b numeric:=0; d numeric:=0; q numeric:=0; pending int:=0; complete boolean; note numeric;
begin
 for x in select aq.id,qu.max_points,g.points_num,g.points_den,exists(select 1 from app.powerup_uses where attempt_question_id=aq.id and kind='double') doubled from app.attempt_questions aq join app.questions qu using(version_id,question_key) left join lateral(select * from app.question_grades where attempt_question_id=aq.id order by revision_no desc limit 1) g on true where aq.attempt_id=t loop
  q:=q+x.max_points; if x.points_num is null then pending:=pending+1; else b:=b+x.points_num/x.points_den; if x.doubled then d:=d+x.points_num/x.points_den; end if; end if;
 end loop;
 select a.*,qs.bonus_affects_grade,at.closed_at,at.close_reason,r.decision into x from app.attempts at join app.participants p on p.id=at.participant_id join app.activities a on a.id=p.activity_id join app.quiz_settings qs on qs.activity_id=a.id left join app.attempt_resolutions r on r.attempt_id=at.id where at.id=t;
 complete:=pending=0 and x.closed_at is not null and coalesce(x.decision,'')<>'exclude' and (x.close_reason not in('withdrawal','archive','teacher_early') or x.decision='evaluate');
 if complete and q>0 then note:=least(x.max_grade,round(x.max_grade*(b+case when x.bonus_affects_grade then d else 0 end)/q,2)); end if;
 return jsonb_build_object('basePoints',b,'bonusPoints',d,'gamePoints',b+d,'maximumPoints',q,'pending',pending,'complete',coalesce(complete,false),'grade',note);
end $$;

create function app.attempt_json(t uuid,teacher boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare x record; answer_rows jsonb; j jsonb;
begin
 select at.*,p.activity_id,m.student_id,a.version_id,r.decision into x from app.attempts at join app.participants p on p.id=at.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id left join app.attempt_resolutions r on r.attempt_id=at.id where at.id=t;
 select coalesce(jsonb_agg(jsonb_build_object('questionId',aq.question_key,'value',r.payload,'idempotencyKey',r.request_key,'submittedAt',r.received_at,'usedDouble',exists(select 1 from app.powerup_uses where attempt_question_id=aq.id and kind='double'))||case when teacher then jsonb_build_object('reviews',coalesce((select jsonb_agg(jsonb_build_object('revision',g.revision_no,'points',jsonb_build_object('numerator',g.points_num,'denominator',g.points_den),'actorId',coalesce(g.actor_id::text,'automatic'),'at',g.created_at,'comment',coalesce(g.comment,''),'reason',g.reason) order by g.revision_no) from app.question_grades g where g.attempt_question_id=aq.id),'[]'::jsonb)) else jsonb_build_object('reviews','[]'::jsonb) end order by aq.position),'[]'::jsonb) into answer_rows from app.attempt_questions aq join app.responses r on r.attempt_question_id=aq.id where aq.attempt_id=t;
 j:=jsonb_build_object('id',t,'activityId',x.activity_id,'studentId',x.student_id,'versionId',x.version_id,'number',x.attempt_no,'startedAt',x.started_at,'deadline',app.deadline(x.activity_id,x.participant_id,x.started_at),'status',case when x.closed_at is null then 'in-progress' else 'closed' end,'closedAt',x.closed_at,'closeReason',case x.close_reason when 'deadline' then 'expired' when 'guided_completed' then 'guided-complete' when 'withdrawal' then 'removed' when 'archive' then 'archived' when 'teacher_early' then 'teacher-ended' else x.close_reason end,'resolution',x.decision,'answers',answer_rows,'questionOrder',(select jsonb_agg(question_key order by position) from app.attempt_questions where attempt_id=t),'optionOrders',(select jsonb_object_agg(question_key,item_order->'items') from app.attempt_questions where attempt_id=t));
 return jsonb_strip_nulls(j);
end $$;

create function app.submit_answer(t uuid,k uuid,value jsonb,req uuid,doubled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare x record; aq app.attempt_questions; old app.responses; scoring jsonb; h text; nextq uuid; feedback jsonb; saved boolean;
begin
 select at.*,p.activity_id,m.subject_id,m.student_id,qs.* into x from app.attempts at join app.participants p on p.id=at.participant_id join app.memberships m on m.id=p.membership_id join app.quiz_settings qs on qs.activity_id=p.activity_id where at.id=t;
 if x.student_id is distinct from auth.uid() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform app.require_student(x.subject_id); perform 1 from app.attempts where id=t for update;
 select * into aq from app.attempt_questions where attempt_id=t and question_key=k;
 if aq.id is null then raise exception 'INVALID_QUESTION'; end if;
 h:=encode(sha256(convert_to(jsonb_build_object('answer',value,'double',doubled)::text,'UTF8')),'hex');
 select * into old from app.responses where request_key=req;
 if old.attempt_question_id is not null then
  if old.attempt_question_id<>aq.id or old.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  saved:=true;
 else
  if exists(select 1 from app.attempts where id=t and closed_at is not null) then raise exception 'ATTEMPT_CLOSED'; end if;
  if app.deadline(x.activity_id,x.participant_id,x.started_at)<=now() then raise exception 'ATTEMPT_EXPIRED'; end if;
  if exists(select 1 from app.responses where attempt_question_id=aq.id) then raise exception 'ANSWER_FINAL'; end if;
  if x.pacing='guided' then
   if not exists(select 1 from app.session_questions where activity_id=x.activity_id and question_key=k and opened_at is not null and closed_at is null) then raise exception 'QUESTION_CLOSED'; end if;
  else
   select question_key into nextq from app.attempt_questions z where z.attempt_id=t and not exists(select 1 from app.responses where attempt_question_id=z.id) order by position limit 1;
   if k<>nextq then raise exception 'QUESTION_ORDER'; end if;
  end if;
  scoring:=app.score_answer(aq.id,value);
  if doubled then
   if not x.double_enabled then raise exception 'POWERUP_DISABLED'; end if;
   if exists(select 1 from app.powerup_uses where participant_id=x.participant_id and kind='double') then raise exception 'POWERUP_USED: Ya utilizaste el doble en esta actividad.'; end if;
   insert into app.powerup_uses(participant_id,kind,attempt_question_id,request_key) values(x.participant_id,'double',aq.id,req);
  end if;
  insert into app.responses values(aq.id,req,h,value,now());
  if scoring is not null then insert into app.question_grades(attempt_question_id,revision_no,points_num,points_den,method,engine_version) values(aq.id,1,(scoring->>'numerator')::numeric,(scoring->>'denominator')::numeric,'automatic','1.0'); end if;
  if x.pacing='self_paced' and not exists(select 1 from app.attempt_questions z where z.attempt_id=t and not exists(select 1 from app.responses where attempt_question_id=z.id)) then perform app.close_attempt(t,'submitted'); end if;
 end if;
 if x.feedback_policy='immediate' then
  select jsonb_build_object('points',jsonb_build_object('numerator',g.points_num,'denominator',g.points_den),'explanation',s.feedback,'maximum',q.max_points,'correct',g.points_num=g.points_den*q.max_points) into feedback from app.question_grades g join app.questions q on q.version_id=aq.version_id and q.question_key=aq.question_key left join app.question_secrets s using(version_id,question_key) where g.attempt_question_id=aq.id order by revision_no limit 1;
 end if;
 return jsonb_build_object('attempt',app.attempt_json(t),'feedback',feedback);
end $$;

create function app.prepare_evaluation(p uuid,source text,t uuid,sv uuid,grade numeric,feedback text,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare x app.activities; n int; e uuid; sc jsonb;
begin
 select a.* into x from app.activities a join app.participants z on z.activity_id=a.id where z.id=p for update of a;
 perform app.require_owner(x.subject_id); perform 1 from app.participants where id=p for update;
 select coalesce(max(revision_no),0)+1 into n from app.evaluation_revisions where participant_id=p;
 if n>1 and length(trim(coalesce(reason,'')))=0 then raise exception 'REVISION_REASON_REQUIRED'; end if;
 if source='quiz' then
  if not exists(select 1 from app.attempts where id=t and participant_id=p) then raise exception 'INVALID_SOURCE'; end if;
  sc:=app.attempt_score(t); if not(sc->>'complete')::boolean then raise exception 'REVIEW_PENDING'; end if; grade:=(sc->>'grade')::numeric;
 elsif source='submission' then
  if not exists(select 1 from app.submission_versions v join app.submissions s on s.id=v.submission_id where v.id=sv and s.participant_id=p) then raise exception 'INVALID_SOURCE'; end if;
 elsif source='nonparticipation' then
  if grade<>0 or length(trim(coalesce(reason,'')))=0 or exists(select 1 from app.attempts where participant_id=p) or exists(select 1 from app.submissions where participant_id=p) then raise exception 'INVALID_NONPARTICIPATION'; end if;
 elsif source<>'manual' or x.kind<>'manual' then raise exception 'INVALID_SOURCE'; end if;
 if grade is null or grade<0 or grade>x.max_grade then raise exception 'GRADE_RANGE'; end if;
 update app.activities set locked_at=coalesce(locked_at,now()) where id=x.id;
 insert into app.evaluation_revisions(participant_id,revision_no,source_kind,attempt_id,submission_version_id,grade,feedback,reason,actor_id) values(p,n,source,t,sv,round(grade,2),feedback,reason,auth.uid()) returning id into e;
 if source='quiz' then
  insert into app.evaluation_question_grades select e,g.id from app.attempt_questions q cross join lateral(select id from app.question_grades where attempt_question_id=q.id order by revision_no desc limit 1) g where q.attempt_id=t;
 end if; return e;
end $$;
create function app.publish_evaluation(e uuid) returns void language plpgsql security definer set search_path='' as $$
declare x record; begin
 select er.*,a.subject_id into x from app.evaluation_revisions er join app.participants p on p.id=er.participant_id join app.activities a on a.id=p.activity_id where er.id=e;
 perform app.require_owner(x.subject_id); perform 1 from app.participants where id=x.participant_id for update;
 if x.published_at is not null then return; end if;
 if exists(select 1 from app.evaluation_revisions where participant_id=x.participant_id and revision_no>x.revision_no) then raise exception 'STALE_EVALUATION'; end if;
 if x.source_kind='quiz' and exists(select 1 from app.evaluation_question_grades eq join app.question_grades g on g.id=eq.question_grade_id where eq.evaluation_id=e and exists(select 1 from app.question_grades where attempt_question_id=g.attempt_question_id and revision_no>g.revision_no)) then raise exception 'STALE_EVALUATION'; end if;
 update app.evaluation_revisions set published_at=now() where id=e;
end $$;
create function app.evaluation_json(e uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('id',x.id,'activityId',a.id,'subjectId',a.subject_id,'studentId',m.student_id,'source',case x.source_kind when 'submission' then 'task' when 'nonparticipation' then a.kind else x.source_kind end,'attemptId',x.attempt_id,'submissionId',x.submission_version_id,'revision',x.revision_no,'grade',x.grade,'maxGrade',a.max_grade,'weight',a.weight,'countsTowardAverage',a.counts_for_average,'comment',coalesce(x.feedback,''),'reason',x.reason,'actorId',x.actor_id,'createdAt',x.created_at,'publishedAt',x.published_at,'answerRevisions',(select jsonb_object_agg(q.question_key,g.revision_no) from app.evaluation_question_grades eq join app.question_grades g on g.id=eq.question_grade_id join app.attempt_questions q on q.id=g.attempt_question_id where eq.evaluation_id=x.id))) from app.evaluation_revisions x join app.participants p on p.id=x.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where x.id=e;
$$;

create function app.command(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u uuid:=app.require_user(); args jsonb:=payload->'args'; id uuid; s uuid; p uuid; m uuid; v uuid; t uuid; e uuid; rid uuid; rec record; r app.resources; x app.activities; st jsonb; j jsonb; z jsonb; b jsonb; q jsonb; num int; cnt int; grade numeric; tm timestamptz; note text; req uuid;
begin
 if jsonb_typeof(args)<>'array' or octet_length(payload::text)>5500000 then raise exception 'INVALID_PAYLOAD'; end if;
 case action
 when 'createSubject' then
  if (select role from app.profiles where profiles.id=u)<>'teacher' then raise exception 'TEACHER_REQUIRED' using errcode='42501'; end if;
  j:=args->0;
  insert into app.subjects(owner_id,name,course_label,school_year,description) values(u,trim(j->>'name'),trim(j->>'course'),(j->>'year')::int,coalesce(j->>'description','')) returning subjects.id into id;
  insert into app.invitation_codes(subject_id,code) values(id,app.new_code());
  return jsonb_build_object('id',id);
 when 'updateSubject' then
  id:=(args->>0)::uuid; perform app.require_owner(id); j:=args->1;
  update app.subjects set name=trim(j->>'name'),course_label=trim(j->>'course'),school_year=(j->>'year')::int,description=coalesce(j->>'description','') where subjects.id=id; return jsonb_build_object('id',id);
 when 'renewCode' then
  id:=(args->>0)::uuid; perform app.require_owner(id); perform 1 from app.subjects where subjects.id=id for update;
  update app.invitation_codes set revoked_at=now() where subject_id=id and revoked_at is null;
  if coalesce((args->>1)::boolean,true) then insert into app.invitation_codes(subject_id,code) values(id,app.new_code()) returning to_jsonb(invitation_codes.*) into j; end if; return j;
 when 'requestMembership' then
  if (select role from app.profiles where profiles.id=u)<>'student' then raise exception 'STUDENT_REQUIRED'; end if;
  -- El bloqueo por cuenta evita que peticiones concurrentes eludan el límite.
  perform 1 from app.profiles where profiles.id=u for update;
  select c.id,c.subject_id into rec from app.invitation_codes c join app.subjects su on su.id=c.subject_id where c.code=upper(trim(args->>0)) and c.revoked_at is null and su.archived_at is null;
  select jr.id into id from app.join_requests jr join app.invitation_codes ic on ic.id=jr.invitation_id where ic.subject_id=rec.subject_id and jr.student_id=u and jr.status='pending';
  if id is not null then return jsonb_build_object('id',id,'status','pending'); end if;
  if not app.consume_join_check(u) then return jsonb_build_object('error',jsonb_build_object('code','RATE_LIMIT','message','Espera diez minutos antes de enviar otra solicitud.')); end if;
  if rec.id is null then return jsonb_build_object('error',jsonb_build_object('code','CODE_INVALID','message','El código no está disponible.')); end if;
  if exists(select 1 from app.memberships where subject_id=rec.subject_id and student_id=u and status='approved') then raise exception 'ALREADY_MEMBER'; end if;
  insert into app.join_requests(invitation_id,student_id,status) values(rec.id,u,'pending') returning join_requests.id into id; return jsonb_build_object('id',id,'status','pending');
 when 'decideMembership' then
  id:=(args->>0)::uuid; note:=args->>1;
  select jr.*,ic.subject_id into rec from app.join_requests jr join app.invitation_codes ic on ic.id=jr.invitation_id where jr.id=id for update of jr;
  perform app.require_owner(rec.subject_id);
  if note not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
  if rec.status<>'pending' then return jsonb_build_object('id',id,'status',rec.status); end if;
  update app.join_requests set status=note,decided_at=now(),decided_by=u where join_requests.id=id;
  if note='approved' then
   insert into app.memberships(subject_id,student_id,status) values(rec.subject_id,rec.student_id,'approved') on conflict(subject_id,student_id) do update set status='approved',updated_at=now() returning memberships.id into m;
   insert into app.membership_events(membership_id,request_id,actor_id,event_type) values(m,id,u,'approved');
  end if; return jsonb_build_object('id',coalesce(m,id),'status',note);
 when 'withdrawMembership' then
  id:=(args->>0)::uuid; select * into rec from app.memberships where memberships.id=id for update; perform app.require_owner(rec.subject_id);
  update app.memberships set status='withdrawn',updated_at=now() where memberships.id=id;
  insert into app.membership_events(membership_id,actor_id,event_type,reason) values(id,u,'withdrawn',args->>1);
  for rec in select at.id from app.attempts at join app.participants pa on pa.id=at.participant_id where pa.membership_id=id and at.closed_at is null loop perform app.close_attempt(rec.id,'withdrawal'); end loop; return 'true';
 when 'archiveSubject' then
  id:=(args->>0)::uuid; perform app.require_owner(id); perform 1 from app.subjects where subjects.id=id for update;
  update app.subjects set archived_at=now() where subjects.id=id;
  insert into app.subject_events(subject_id,actor_id,event_type) values(id,u,'archived');
  insert into app.purge_jobs(subject_id,due_at,status,phase,retry_count) values(id,now()+interval '30 days','scheduled','references',0);
  for rec in select at.id from app.attempts at join app.participants pa on pa.id=at.participant_id join app.activities ac on ac.id=pa.activity_id where ac.subject_id=id and at.closed_at is null loop perform app.close_attempt(rec.id,'archive'); end loop; return 'true';
 when 'restoreSubject' then
  id:=(args->>0)::uuid; select * into rec from app.subjects where subjects.id=id for update;
  if rec.owner_id<>u or rec.archived_at is null or rec.archived_at+interval '30 days'<=now() or rec.purge_started_at is not null then raise exception 'RESTORE_UNAVAILABLE'; end if;
  update app.subjects set archived_at=null where subjects.id=id; update app.purge_jobs set status='cancelled' where subject_id=id and status='scheduled'; insert into app.subject_events(subject_id,actor_id,event_type) values(id,u,'restored'); return 'true';
 when 'saveDraft' then
  if (select role from app.profiles where profiles.id=u)<>'teacher' then raise exception 'TEACHER_REQUIRED'; end if;
  j:=args->0; id:=(j->>'id')::uuid; num:=(args->>1)::int;
  if length(trim(coalesce(j->>'title','')))>120 or jsonb_typeof(j->'blocks')<>'array' or jsonb_array_length(j->'blocks')>200 then raise exception 'INVALID_DRAFT'; end if;
  select * into r from app.resources where resources.id=id for update;
  if r.id is null then
   if num not in (0,1) then raise exception 'REVISION_CONFLICT'; end if;
   insert into app.resources(id,owner_id,kind,title) values(id,u,case j->>'kind' when 'quiz' then 'standalone_quiz' else 'resource' end,j->>'title');
   insert into app.resource_drafts values(id,1,1,j-'ownerId'-'revision'-'updatedAt',now());
  else
   if r.owner_id<>u then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   update app.resource_drafts set revision=revision+1,document=j-'ownerId'-'revision'-'updatedAt',updated_at=now() where resource_id=id and revision=num;
   if not found then raise exception 'REVISION_CONFLICT: Hay una versión más reciente del borrador.'; end if;
   update app.resources set title=j->>'title',updated_at=now() where resources.id=id;
  end if;
  select d.document||jsonb_build_object('id',id,'ownerId',u,'revision',d.revision,'updatedAt',d.updated_at) into j from app.resource_drafts d where d.resource_id=id; return j;
 when 'publishResource' then v:=app.publish_resource((args->>0)::uuid); return app.version_json(v,true);
 when 'createActivity' then
  v:=(args->>0)::uuid; s:=(args->>1)::uuid; st:=args->2; perform app.require_owner(s);
  if not exists(select 1 from app.resource_versions rv join app.resources rr on rr.id=rv.resource_id where rv.id=v and rr.owner_id=u) then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from app.questions where version_id=v) then raise exception 'QUIZ_REQUIRED'; end if;
  insert into app.activities(subject_id,kind,version_id,title,timezone,max_grade,weight,counts_for_average,published_at) values(s,'quiz',v,coalesce(nullif(args->>3,''),(select title from app.resource_versions where resource_versions.id=v)),'UTC',100,1,false,now()) returning activities.id into id;
  perform app.write_quiz_settings(id,st); return app.activity_json(id);
 when 'updateActivity' then
  id:=(args->>0)::uuid; select * into x from app.activities where activities.id=id for update; perform app.require_owner(x.subject_id);
  if x.locked_at is not null then raise exception 'ACTIVITY_LOCKED'; end if; perform app.write_quiz_settings(id,args->1); return app.activity_json(id);
 when 'publishReading' then
  v:=(args->>0)::uuid; s:=(args->>1)::uuid; perform app.require_owner(s);
  if not exists(select 1 from app.resource_versions rv join app.resources rr on rr.id=rv.resource_id where rv.id=v and rr.owner_id=u) then raise exception 'FORBIDDEN'; end if;
  insert into app.activities(subject_id,kind,version_id,title,timezone,counts_for_average,opens_at,published_at) values(s,'reading',v,(select title from app.resource_versions where resource_versions.id=v),'UTC',false,now(),now()) returning activities.id into id; return jsonb_build_object('id',id);
 when 'joinGuidedRoom' then
  id:=(args->>0)::uuid; select * into x from app.activities where activities.id=id for update; m:=app.require_student(x.subject_id);
  select * into rec from app.guided_sessions where activity_id=id;
  if rec.activity_id is null or rec.started_at is not null or rec.closed_at is not null or now()>=app.deadline(id) then raise exception 'ROOM_CLOSED'; end if;
  p:=app.ensure_participant(id,m); update app.participants set room_joined_at=coalesce(room_joined_at,now()) where participants.id=p; return app.activity_json(id);
 when 'startAttempt' then
  id:=(args->>0)::uuid; select * into x from app.activities where activities.id=id; m:=app.require_student(x.subject_id); p:=app.ensure_participant(id,m);
  if (select pacing from app.quiz_settings where activity_id=id)='guided' then
   select at.id into t from app.attempts at where at.participant_id=p order by attempt_no desc limit 1;
   if t is null then raise exception 'WAIT_FOR_TEACHER'; end if;
  else t:=app.begin_attempt(id,p); end if; return app.attempt_json(t);
 when 'startGuidedSession' then
  id:=(args->>0)::uuid; select * into x from app.activities where activities.id=id for update; perform app.require_owner(x.subject_id);
  select * into rec from app.guided_sessions where activity_id=id for update;
  if rec.started_at is not null then return app.activity_json(id); end if;
  if rec.activity_id is null then raise exception 'GUIDED_REQUIRED'; end if;
  for rec in select pa.id from app.participants pa join app.memberships mm on mm.id=pa.membership_id where pa.activity_id=id and pa.room_joined_at is not null and mm.status='approved' loop perform app.begin_attempt(id,rec.id); end loop;
  if not found then raise exception 'ROOM_EMPTY'; end if;
  update app.guided_sessions set started_at=now(),revision=revision+1 where activity_id=id;
  update app.session_questions set opened_at=now() where activity_id=id and position=1;
  update app.activities set locked_at=coalesce(locked_at,now()) where activities.id=id; return app.activity_json(id);
 when 'closeGuidedQuestion' then
  id:=(args->>0)::uuid; select * into x from app.activities where activities.id=id for update; perform app.require_owner(x.subject_id);
  select * into rec from app.session_questions where activity_id=id and opened_at is not null and closed_at is null for update;
  if rec.question_key is null then return app.activity_json(id); end if;
  select count(*) into cnt from app.attempt_questions aq join app.attempts at on at.id=aq.attempt_id join app.participants pa on pa.id=at.participant_id where pa.activity_id=id and aq.question_key=rec.question_key and at.closed_at is null and not exists(select 1 from app.responses where attempt_question_id=aq.id);
  if cnt>0 and coalesce((args->>1)::boolean,false)=false then raise exception 'CONFIRM_PENDING: % respuestas pendientes.',cnt; end if;
  update app.session_questions set closed_at=now() where activity_id=id and question_key=rec.question_key;
  insert into app.question_grades(attempt_question_id,revision_no,points_num,points_den,method,engine_version) select aq.id,1,0,1,'omission','1.0' from app.attempt_questions aq join app.attempts at on at.id=aq.attempt_id join app.participants pa on pa.id=at.participant_id where pa.activity_id=id and aq.question_key=rec.question_key and at.closed_at is null and not exists(select 1 from app.responses where attempt_question_id=aq.id) and not exists(select 1 from app.question_grades where attempt_question_id=aq.id);
  if not exists(select 1 from app.session_questions where activity_id=id and opened_at is null) then
   update app.guided_sessions set closed_at=now(),close_reason='completed',revision=revision+1 where activity_id=id;
   for rec in select at.id from app.attempts at join app.participants pa on pa.id=at.participant_id where pa.activity_id=id and at.closed_at is null loop perform app.close_attempt(rec.id,'guided_completed'); end loop;
  end if; return app.activity_json(id);
 when 'openNextGuidedQuestion' then
  id:=(args->>0)::uuid; select * into x from app.activities where activities.id=id for update; perform app.require_owner(x.subject_id);
  if exists(select 1 from app.session_questions where activity_id=id and opened_at is not null and closed_at is null) or not exists(select 1 from app.guided_sessions where activity_id=id and started_at is not null and closed_at is null) then raise exception 'GUIDED_STATE'; end if;
  update app.session_questions set opened_at=now() where activity_id=id and position=(select min(position) from app.session_questions where activity_id=id and opened_at is null); return app.activity_json(id);
 when 'endGuidedSession' then
  id:=(args->>0)::uuid; select * into x from app.activities where activities.id=id for update; perform app.require_owner(x.subject_id);
  if length(trim(coalesce(args->>1,'')))=0 or not coalesce((args->>2)::boolean,false) then raise exception 'CONFIRM_REASON_REQUIRED'; end if;
  update app.guided_sessions set closed_at=now(),close_reason='teacher_early',revision=revision+1 where activity_id=id and closed_at is null;
  update app.session_questions set closed_at=now() where activity_id=id and opened_at is not null and closed_at is null;
  for rec in select at.id from app.attempts at join app.participants pa on pa.id=at.participant_id where pa.activity_id=id and at.closed_at is null loop perform app.close_attempt(rec.id,'teacher_early'); end loop;
  insert into app.activity_events(activity_id,actor_id,event_type,details) values(id,u,'early_close',jsonb_build_object('reason',args->>1)); return app.activity_json(id);
 when 'submitAnswer' then return app.submit_answer((args->>0)::uuid,(args->>1)::uuid,args->2,(args->>3)::uuid,coalesce((args->>4)::boolean,false));
 when 'useHint' then
  t:=(args->>0)::uuid; id:=(args->>1)::uuid;
  select at.*,pa.activity_id,mm.student_id,mm.subject_id into rec from app.attempts at join app.participants pa on pa.id=at.participant_id join app.memberships mm on mm.id=pa.membership_id where at.id=t;
  if rec.student_id<>u then raise exception 'FORBIDDEN'; end if; perform app.require_student(rec.subject_id); perform 1 from app.attempts where attempts.id=t for update;
  select aq.id,sec.hint,aq.position into rec from app.attempt_questions aq join app.question_secrets sec using(version_id,question_key) where aq.attempt_id=t and aq.question_key=id;
  select at.participant_id into p from app.attempts at where at.id=t;
  select pa.activity_id into s from app.participants pa where pa.id=p;
  select pu.attempt_question_id into v from app.powerup_uses pu where pu.participant_id=p and kind='hint';
  if v is not null then if v<>rec.id then raise exception 'HINT_USED'; end if; return to_jsonb(rec.hint); end if;
  if length(trim(coalesce(rec.hint,'')))=0 or not (select hint_enabled from app.quiz_settings where activity_id=s) then raise exception 'HINT_UNAVAILABLE'; end if;
  if exists(select 1 from app.attempts where attempts.id=t and closed_at is not null) or app.deadline(s,p,(select started_at from app.attempts where attempts.id=t))<=now() or exists(select 1 from app.responses where attempt_question_id=rec.id) then raise exception 'QUESTION_CLOSED'; end if;
  if (select pacing from app.quiz_settings where activity_id=s)='guided' then
   if not exists(select 1 from app.session_questions where activity_id=s and question_key=id and opened_at is not null and closed_at is null) then raise exception 'QUESTION_CLOSED'; end if;
  elsif rec.position<>(select min(aq.position) from app.attempt_questions aq where aq.attempt_id=t and not exists(select 1 from app.responses where attempt_question_id=aq.id)) then raise exception 'QUESTION_ORDER'; end if;
  insert into app.powerup_uses(participant_id,kind,attempt_question_id,request_key) values(p,'hint',rec.id,gen_random_uuid()); return to_jsonb(rec.hint);
 when 'reviewAnswer' then
  t:=(args->>0)::uuid; id:=(args->>1)::uuid; grade:=(args->>2)::numeric;
  select aq.id,qu.max_points,a.subject_id,at.closed_at into rec from app.attempt_questions aq join app.questions qu using(version_id,question_key) join app.attempts at on at.id=aq.attempt_id join app.participants pa on pa.id=at.participant_id join app.activities a on a.id=pa.activity_id where aq.attempt_id=t and aq.question_key=id for update of at;
  perform app.require_owner(rec.subject_id); if rec.closed_at is null then raise exception 'ATTEMPT_OPEN'; end if;
  if grade is null or grade<0 or grade>rec.max_points or round(grade,2)<>grade then raise exception 'GRADE_RANGE'; end if;
  select coalesce(max(revision_no),0)+1 into num from app.question_grades where attempt_question_id=rec.id;
  if num>1 and length(trim(coalesce(args->>4,'')))=0 then raise exception 'REVISION_REASON_REQUIRED'; end if;
  insert into app.question_grades(attempt_question_id,revision_no,points_num,points_den,method,actor_id,comment,reason,engine_version) values(rec.id,num,grade*100,100,'manual',u,coalesce(args->>3,''),args->>4,'1.0'); return app.attempt_json(t,true);
 when 'resolveAttempt' then
  t:=(args->>0)::uuid;
  select at.*,a.subject_id from app.attempts at join app.participants pa on pa.id=at.participant_id join app.activities a on a.id=pa.activity_id where at.id=t into rec; perform app.require_owner(rec.subject_id);
  if rec.close_reason not in ('withdrawal','archive','teacher_early') then raise exception 'ADMINISTRATIVE_CLOSE_REQUIRED'; end if;
  insert into app.attempt_resolutions values(t,args->>1,u,args->>2,now());
  if args->>1='evaluate' then perform app.close_attempt(t,'submitted'); end if; return app.attempt_json(t,true);
 when 'publishGrade' then
  id:=(args->>0)::uuid; s:=(args->>1)::uuid; select * into x from app.activities where activities.id=id; perform app.require_owner(x.subject_id);
  select pa.id into p from app.participants pa join app.memberships mm on mm.id=pa.membership_id where pa.activity_id=id and mm.student_id=s;
  select at.id into t from app.attempts at where at.participant_id=p and (app.attempt_score(at.id)->>'complete')::boolean order by (app.attempt_score(at.id)->>'grade')::numeric desc,closed_at,at.id limit 1;
  if t is null then raise exception 'REVIEW_PENDING'; end if;
  e:=app.prepare_evaluation(p,'quiz',t,null,null,coalesce(args->>2,''),args->>3); perform app.publish_evaluation(e); return app.evaluation_json(e);
 when 'extendDeadline' then
  id:=(args->>0)::uuid; tm:=(args->>1)::timestamptz; p:=(args->>3)::uuid; select * into x from app.activities where activities.id=id for update; perform app.require_owner(x.subject_id);
  if length(trim(coalesce(args->>2,'')))=0 or tm<=now() or now()>=app.deadline(id) then raise exception 'INVALID_EXTENSION'; end if;
  if p is null then if tm<=app.deadline(id) then raise exception 'INVALID_EXTENSION'; end if;
  else
   if not exists(select 1 from app.participants where participants.id=p and activity_id=id) or tm>app.deadline(id) or not exists(select 1 from app.attempts where participant_id=p and closed_at is null and app.deadline(id,p,started_at)<tm) then raise exception 'INVALID_EXTENSION'; end if;
  end if;
  insert into app.deadline_extensions(activity_id,participant_id,new_deadline,actor_id,reason) values(id,p,tm,u,args->>2); return 'true';
 when 'setHelpPreference' then
  insert into app.help_progress values(u,'initial',coalesce((args->>1)::int,1),args->>0,now()) on conflict(profile_id,guide_key,guide_version) do update set state=excluded.state,updated_at=now(); return 'true';
 else return app.extended_command(action,args);
 end case;
end $$;
