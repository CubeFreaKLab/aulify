-- Huella autorizada para comprobar cambios sin transferir el aula completa.
-- No entrega respuestas, soluciones, notas, identidades ni contenido privado.
create function app.activity_sync(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=app.require_user(); a app.activities; is_teacher boolean;
 metadata jsonb; progress jsonb; private_progress jsonb; next_deadline timestamptz;
begin
 select * into a from app.activities where id=p_activity_id;
 if a.id is null then raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501'; end if;
 is_teacher:=app.owns_subject(a.subject_id,false);
 if not is_teacher and (a.published_at is null or not app.can_subject(a.subject_id)) then
  raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';
 end if;
 select jsonb_build_array(a.title,a.version_id,a.locked_at,a.published_at,a.opens_at,
  app.deadline(a.id),now()>=app.deadline(a.id),s.archived_at,to_jsonb(q),to_jsonb(g),
  (select jsonb_agg(jsonb_build_array(position,opened_at,closed_at) order by position)
   from app.session_questions where activity_id=a.id)) into metadata
 from app.subjects s left join app.quiz_settings q on q.activity_id=a.id
 left join app.guided_sessions g on g.activity_id=a.id where s.id=a.subject_id;

 with visible_participants as materialized (
  select p.* from app.participants p join app.memberships m on m.id=p.membership_id
  where p.activity_id=a.id and (is_teacher or m.student_id=u)
 ), visible_attempts as materialized (
  select t.* from app.attempts t join visible_participants p on p.id=t.participant_id
 ), response_stats as (
  select count(*) n,max(r.received_at) latest from app.responses r
  join app.attempt_questions q on q.id=r.attempt_question_id
  join visible_attempts t on t.id=q.attempt_id
 ), evaluation_stats as (
  select count(*) n,max(e.created_at) latest,max(e.published_at) publication
  from app.evaluation_revisions e join visible_participants p on p.id=e.participant_id
  where is_teacher or e.published_at is not null
 )
 select jsonb_build_array(
  (select jsonb_build_array(count(*),max(room_joined_at)) from visible_participants),
  (select jsonb_agg(jsonb_build_array(t.id,t.closed_at,t.close_reason,
    now()>=app.deadline(a.id,t.participant_id,t.started_at)) order by t.id) from visible_attempts t),
  (select to_jsonb(r) from response_stats r),(select to_jsonb(e) from evaluation_stats e),
  (select jsonb_build_array(count(*),max(r.decided_at)) from app.attempt_resolutions r join visible_attempts t on t.id=r.attempt_id),
  (select jsonb_build_array(count(*),max(d.created_at)) from app.deadline_extensions d
   where d.activity_id=a.id and (is_teacher or d.participant_id is null or d.participant_id in(select id from visible_participants))),
  (select jsonb_build_array(count(*),max(pu.consumed_at)) from app.powerup_uses pu join visible_participants p on p.id=pu.participant_id)
 ), least(app.deadline(a.id),(select min(app.deadline(a.id,t.participant_id,t.started_at)) from visible_attempts t where t.closed_at is null))
 into progress,next_deadline;

 if is_teacher then
  select jsonb_build_array(
   (select jsonb_build_array(count(*),max(qg.created_at)) from app.question_grades qg
    join app.attempt_questions aq on aq.id=qg.attempt_question_id
    join app.attempts t on t.id=aq.attempt_id join app.participants p on p.id=t.participant_id where p.activity_id=a.id),
   (select jsonb_build_array(count(*),max(i.received_at)) from app.integrity_events i
    join app.attempts t on t.id=i.attempt_id join app.participants p on p.id=t.participant_id where p.activity_id=a.id),
   (select jsonb_build_array(count(*),max(i.reviewed_at)) from app.incident_reviews i
    join app.attempts t on t.id=i.attempt_id join app.participants p on p.id=t.participant_id where p.activity_id=a.id),
   (select jsonb_agg(jsonb_build_array(te.id,te.name,tm.participant_id) order by te.id,tm.participant_id)
    from app.teams te left join app.team_members tm on tm.team_id=te.id where te.activity_id=a.id)
  ) into private_progress;
 end if;
 return jsonb_build_object('revision',md5(jsonb_build_array(u,a.id,metadata,progress,private_progress)::text),
  'serverTime',clock_timestamp(),'nextDeadline',next_deadline);
end $$;

create function public.aulify_sync(p_activity_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select app.activity_sync(p_activity_id);
$$;
revoke all on function app.activity_sync(uuid),public.aulify_sync(uuid) from public,anon,authenticated;
grant execute on function app.activity_sync(uuid),public.aulify_sync(uuid) to authenticated;
