-- En revisión diferida, conservar los puntos conocidos al publicar cada
-- participante. Una corrección privada no cambia ni oculta su clasificación.
create or replace function app.ranking(a uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare x record; teacher boolean; rows jsonb; groups jsonb; provisional boolean; historical jsonb;
begin
 select ac.*,qs.ranking_enabled,qs.feedback_policy,qs.teams_enabled into x
 from app.activities ac join app.quiz_settings qs on qs.activity_id=ac.id where ac.id=a;
 teacher:=app.owns_subject(x.subject_id,false);
 if not teacher then perform app.require_student(x.subject_id); end if;
 if not teacher and (not x.ranking_enabled or x.feedback_policy='hidden') then
  return jsonb_build_object('available',false,'reason','La clasificación está desactivada.');
 end if;
 if not teacher and x.feedback_policy='after_close' and (not app.activity_closed(a) or exists(
  select 1 from app.participants p where p.activity_id=a
  and exists(select 1 from app.attempts at where at.participant_id=p.id
   and not exists(select 1 from app.attempt_resolutions where attempt_id=at.id and decision='exclude'))
  and not exists(select 1 from app.evaluation_revisions e where e.participant_id=p.id and e.published_at is not null)
 )) then
  return jsonb_build_object('available',false,'reason','La clasificación se publicará al cerrar y revisar la actividad.');
 end if;
 if not teacher and x.feedback_policy='after_close' then
  with publications as (
   select p.id,p.alias_no,tm.team_id,t.name team,e.id evaluation_id,e.attempt_id,e.published_at
   from app.participants p
   left join app.team_members tm on tm.participant_id=p.id
   left join app.teams t on t.id=tm.team_id
   left join lateral (
    select er.id,er.attempt_id,er.published_at from app.evaluation_revisions er
    where er.participant_id=p.id and er.published_at is not null
    order by er.revision_no desc limit 1
   ) e on true where p.activity_id=a
  ), attempt_totals as (
   select p.id participant_id,at.id,
    coalesce(sum(g.points_num/g.points_den * case when pu.kind='double' then 2 else 1 end),0) points,
    bool_and(g.id is not null) and at.closed_at<=p.published_at
     and (at.close_reason not in ('withdrawal','archive','teacher_early') or ar.decision='evaluate') complete
   from publications p
   join app.attempts at on at.participant_id=p.id and at.started_at<=p.published_at
   left join app.attempt_resolutions ar on ar.attempt_id=at.id and ar.decided_at<=p.published_at
   join app.attempt_questions aq on aq.attempt_id=at.id
   left join app.powerup_uses pu on pu.attempt_question_id=aq.id and pu.kind='double' and pu.consumed_at<=p.published_at
   left join lateral (
    select qg.id,qg.points_num,qg.points_den from app.question_grades qg
    where qg.attempt_question_id=aq.id and (
     -- El intento publicado tiene referencias exactas, incluso si varias
     -- operaciones comparten la misma hora de transacción.
     at.id=p.attempt_id and exists(select 1 from app.evaluation_question_grades eq
      where eq.evaluation_id=p.evaluation_id and eq.question_grade_id=qg.id)
     or at.id is distinct from p.attempt_id and qg.created_at<=p.published_at
    ) order by qg.revision_no desc limit 1
   ) g on true
   where coalesce(ar.decision,'')<>'exclude'
   group by p.id,p.published_at,at.id,ar.decision
  ), totals as (
   select p.id,p.alias_no,p.team_id,p.team,coalesce(max(at.points),0) points,
    coalesce(bool_or(at.id is not null and coalesce(at.complete,false)=false),false) provisional
   from publications p left join attempt_totals at on at.participant_id=p.id
   group by p.id,p.alias_no,p.team_id,p.team
  ) select coalesce(jsonb_agg(to_jsonb(totals)),'[]'::jsonb),coalesce(bool_or(totals.provisional),false)
    into historical,provisional from totals;
  with scores as (
   select * from jsonb_to_recordset(historical) as s(alias_no int,team text,points numeric)
  ), ranked as (select *,rank() over(order by points desc) rank from scores)
  select coalesce(jsonb_agg(jsonb_build_object('alias','Participante '||lpad(alias_no::text,2,'0'),
   'team',team,'points',points,'rank',rank) order by rank,alias_no),'[]'::jsonb) into rows from ranked;
  if x.teams_enabled then
   with scores as (
    select * from jsonb_to_recordset(historical) as s(team_id uuid,team text,points numeric)
   ), totals as (
    select team name,avg(points) points from scores where team_id is not null group by team_id,team
   ), ranked as (select *,rank() over(order by points desc) rank from totals)
   select coalesce(jsonb_agg(to_jsonb(ranked) order by rank,name),'[]'::jsonb) into groups from ranked;
  end if;
  return jsonb_build_object('available',true,'provisional',provisional,'individual',rows,'teams',coalesce(groups,'[]'::jsonb));
 end if;

 -- Docente y política inmediata siguen usando las correcciones actuales.
 provisional:=not app.activity_closed(a) or exists(
  select 1 from app.attempts at join app.participants p on p.id=at.participant_id
  where p.activity_id=a and not (app.attempt_score(at.id)->>'complete')::boolean
  and not exists(select 1 from app.attempt_resolutions where attempt_id=at.id and decision='exclude')
 );
 with scores as(
  select p.id,p.alias_no,m.student_id,t.name team,coalesce((
   select max((app.attempt_score(at.id)->>'gamePoints')::numeric) from app.attempts at
   where at.participant_id=p.id
   and not exists(select 1 from app.attempt_resolutions where attempt_id=at.id and decision='exclude')
   and (provisional or (app.attempt_score(at.id)->>'complete')::boolean)
  ),0) points
  from app.participants p join app.memberships m on m.id=p.membership_id
  left join app.team_members tm on tm.participant_id=p.id
  left join app.teams t on t.id=tm.team_id where p.activity_id=a
 ), ranked as(select *,rank() over(order by points desc) rank from scores)
 select coalesce(jsonb_agg(jsonb_build_object('alias','Participante '||lpad(alias_no::text,2,'0'),
  'team',team,'points',points,'rank',rank)||case when teacher then jsonb_build_object('studentId',student_id)
  else '{}'::jsonb end order by rank,alias_no),'[]'::jsonb) into rows from ranked;
 if x.teams_enabled then
  with scores as(
   select tm.team_id,coalesce((
    select max((app.attempt_score(at.id)->>'gamePoints')::numeric) from app.attempts at
    where at.participant_id=tm.participant_id
    and not exists(select 1 from app.attempt_resolutions where attempt_id=at.id and decision='exclude')
    and (provisional or (app.attempt_score(at.id)->>'complete')::boolean)
   ),0) points from app.team_members tm join app.teams te on te.id=tm.team_id where te.activity_id=a
  ), totals as(
   select t.name,avg(s.points) points from app.teams t join scores s on s.team_id=t.id group by t.id,t.name
  ), ranked as(select *,rank() over(order by points desc) rank from totals)
  select coalesce(jsonb_agg(to_jsonb(ranked) order by rank,name),'[]'::jsonb) into groups from ranked;
 end if;
 return jsonb_build_object('available',true,'provisional',provisional,'individual',rows,'teams',coalesce(groups,'[]'::jsonb));
end $$;
