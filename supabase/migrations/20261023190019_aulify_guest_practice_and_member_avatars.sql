-- Practice by capability URL. These records never reference participants or evaluations.
create table app.guest_quizzes (
 id uuid primary key default gen_random_uuid(),
 token text not null unique default gen_random_uuid()::text,
 owner_id uuid references app.profiles(id) on delete cascade,
 activity_id uuid references app.activities(id) on delete cascade,
 title text not null check (length(title) between 1 and 120),
 questions jsonb not null check (jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 1 and 50 and octet_length(questions::text)<262144),
 opens_at timestamptz not null, closes_at timestamptz not null,
 duration_seconds integer not null check(duration_seconds between 60 and 7200),
 revoked_at timestamptz, created_at timestamptz not null default now(),
 check(closes_at>opens_at),
 check((owner_id is not null and activity_id is not null) or (owner_id is null and activity_id is null and token='ecosistema-demo'))
);
create index guest_quizzes_owner on app.guest_quizzes(owner_id,created_at);
create index guest_quizzes_activity on app.guest_quizzes(activity_id);
create unique index guest_quizzes_active on app.guest_quizzes(activity_id) where revoked_at is null;
create table app.guest_runs (
 id uuid primary key default gen_random_uuid(),
 quiz_id uuid not null references app.guest_quizzes(id) on delete cascade,
 secret_hash text not null check(secret_hash ~ '^[a-f0-9]{64}$'),
 display_name text not null check(length(display_name) between 2 and 60),
 avatar_id text not null check(avatar_id ~ '^[hm](0[1-9]|1[0-5])$'),
 started_at timestamptz not null default now(), deadline timestamptz not null,
 answers jsonb not null default '[]' check(jsonb_typeof(answers)='array' and jsonb_array_length(answers)<=50),
 unique(quiz_id,secret_hash)
);
create index guest_runs_expiry on app.guest_runs(deadline);
alter table app.guest_quizzes enable row level security;
alter table app.guest_runs enable row level security;
revoke all on app.guest_quizzes,app.guest_runs from public,anon,authenticated;

create function public.aulify_guest_manage(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=app.require_user(); a app.activities; link app.guest_quizzes; qs jsonb; starts timestamptz; ends timestamptz; seconds integer;
begin
 select a0.* into a from app.activities a0 join app.subjects s on s.id=a0.subject_id
 where a0.id=(p_payload->>'activityId')::uuid and s.owner_id=u and s.archived_at is null and s.purge_started_at is null and a0.kind='quiz';
 if a.id is null then raise exception 'NOT_ALLOWED'; end if;
 select * into link from app.guest_quizzes where activity_id=a.id and revoked_at is null;
 if p_action='create' and link.id is null then
   starts:=(p_payload->>'opensAt')::timestamptz; ends:=(p_payload->>'closesAt')::timestamptz;
   seconds:=(p_payload->>'durationSeconds')::integer;
   if starts is null or ends is null or ends<=greatest(starts,now()) or ends>now()+interval '90 days' or seconds not between 60 and 7200 then raise exception 'INVALID_SCHEDULE'; end if;
   if (select count(*) from app.guest_quizzes where owner_id=u and created_at>now()-interval '1 day')>=20 then raise exception 'GUEST_LIMIT'; end if;
   select jsonb_agg(app.question_json(q.version_id,q.question_key,true) order by g.position,q.position) into qs
   from app.questions q join app.question_groups g using(version_id,group_key) where q.version_id=a.version_id;
   if qs is null or jsonb_array_length(qs)>50 or exists(select 1 from jsonb_array_elements(qs) q where coalesce((q->>'manual')::boolean,false) or q->>'type' in ('open','fill-text')) then raise exception 'GUEST_CLOSED_QUESTIONS'; end if;
   insert into app.guest_quizzes(owner_id,activity_id,title,questions,opens_at,closes_at,duration_seconds)
   values(u,a.id,a.title,qs,starts,ends,seconds) returning * into link;
 elsif p_action='revoke' then
   update app.guest_quizzes set revoked_at=now() where activity_id=a.id and revoked_at is null;
   return 'null'::jsonb;
 elsif p_action not in ('read','create') then raise exception 'INVALID_ACTION';
 end if;
 if link.id is null then return 'null'::jsonb; end if;
 return jsonb_build_object('token',link.token,'title',link.title,'opensAt',link.opens_at,'closesAt',link.closes_at,'durationSeconds',link.duration_seconds,'count',jsonb_array_length(link.questions));
end $$;
revoke all on function public.aulify_guest_manage(text,jsonb) from public,anon;
grant execute on function public.aulify_guest_manage(text,jsonb) to authenticated;

-- Only server code can execute this RPC. It returns correction data to that server,
-- which validates answers and sends an explicit, stripped projection to the browser.
create function public.aulify_guest(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link app.guest_quizzes; run app.guest_runs; requested_token text:=p_payload->>'token'; position integer;
begin
 if requested_token='ecosistema-demo' and p_payload ? 'demoQuestions' then
   insert into app.guest_quizzes(token,title,questions,opens_at,closes_at,duration_seconds)
   values(requested_token,'Reto del ecosistema',p_payload->'demoQuestions','2020-01-01','2099-12-31',240)
   on conflict(token) do nothing;
 end if;
 select * into link from app.guest_quizzes where guest_quizzes.token=requested_token for update;
 if link.id is null or link.revoked_at is not null then raise exception 'GUEST_NOT_FOUND'; end if;
 if link.activity_id is not null and not exists(select 1 from app.activities a join app.subjects s on s.id=a.subject_id where a.id=link.activity_id and s.archived_at is null and s.purge_started_at is null) then raise exception 'GUEST_NOT_FOUND'; end if;
 select * into run from app.guest_runs where quiz_id=link.id and secret_hash=p_payload->>'secretHash' for update;
 if p_action='join' and run.id is null then
   if now()<link.opens_at then raise exception 'GUEST_NOT_OPEN'; end if;
   if now()>=link.closes_at then raise exception 'GUEST_CLOSED'; end if;
   -- Bounded retention and room size; independent of academic enrollment.
   delete from app.guest_runs where deadline<now()-interval '30 days';
   if (select count(*) from app.guest_runs where quiz_id=link.id)>=300 then raise exception 'GUEST_LIMIT'; end if;
   insert into app.guest_runs(quiz_id,secret_hash,display_name,avatar_id,deadline)
   values(link.id,p_payload->>'secretHash',trim(p_payload->>'name'),p_payload->>'avatarId',least(link.closes_at,now()+make_interval(secs=>link.duration_seconds))) returning * into run;
 elsif p_action='answer' then
   if run.id is null then raise exception 'GUEST_SESSION'; end if;
   if now()<link.opens_at or now()>=least(run.deadline,link.closes_at) then raise exception 'GUEST_CLOSED'; end if;
   position:=(p_payload->>'index')::integer;
   if position<jsonb_array_length(run.answers) and run.answers->position->>'requestId'=p_payload->'result'->>'requestId' then
     null; -- Idempotent acknowledgement of the same submission.
   elsif position<>jsonb_array_length(run.answers) or position>=jsonb_array_length(link.questions) then raise exception 'GUEST_STALE';
   else
     if octet_length((p_payload->'result')::text)>16384 then raise exception 'INVALID_PAYLOAD'; end if;
     update app.guest_runs set answers=answers||jsonb_build_array(p_payload->'result') where id=run.id returning * into run;
   end if;
 elsif p_action not in ('read','join','answer') then raise exception 'INVALID_ACTION'; end if;
 return jsonb_build_object('quiz',to_jsonb(link),'run',case when run.id is null then null else to_jsonb(run) end,'serverNow',now());
end $$;
revoke all on function public.aulify_guest(text,jsonb) from public,anon,authenticated;
grant execute on function public.aulify_guest(text,jsonb) to service_role;

-- Cosmetic choices of self and students in one's own subjects only.
create function public.aulify_member_avatars() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(p.id,au.raw_user_meta_data->>'avatar_id'),'{}'::jsonb)
 from app.profiles p join auth.users au on au.id=p.id
 where au.raw_user_meta_data->>'avatar_id' ~ '^[hm](0[1-9]|1[0-5])$'
 and (p.id=auth.uid() or exists(select 1 from app.memberships m join app.subjects s on s.id=m.subject_id where m.student_id=p.id and s.owner_id=auth.uid())
 or exists(select 1 from app.join_requests j join app.invitation_codes c on c.id=j.invitation_id join app.subjects s on s.id=c.subject_id where j.student_id=p.id and s.owner_id=auth.uid()));
$$;
revoke all on function public.aulify_member_avatars() from public,anon;
grant execute on function public.aulify_member_avatars() to authenticated;
