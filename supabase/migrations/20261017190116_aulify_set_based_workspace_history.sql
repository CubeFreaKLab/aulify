-- Proyectar el historial autorizado por conjuntos, sin reconstruir cada intento
-- y cada evaluación con consultas independientes. Se conserva el contrato JSON.
create function app.workspace_attempts_json(u uuid,owned_subjects uuid[],visible_subjects uuid[])
returns jsonb language sql stable security definer set search_path='' as $$
with base as materialized (
 select at.*,p.activity_id,m.student_id,a.version_id,r.decision,q.duration_seconds,
  a.closes_at,(a.subject_id=any(owned_subjects)) teacher
 from app.attempts at join app.participants p on p.id=at.participant_id
 join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id
 left join app.quiz_settings q on q.activity_id=a.id
 left join app.attempt_resolutions r on r.attempt_id=at.id
 where a.subject_id=any(owned_subjects) or m.student_id=u and a.subject_id=any(visible_subjects)
), assigned as materialized (
 select aq.*,b.teacher,r.request_key,r.payload,r.received_at
 from app.attempt_questions aq join base b on b.id=aq.attempt_id
 left join app.responses r on r.attempt_question_id=aq.id
), reviews as materialized (
 select g.attempt_question_id,jsonb_agg(jsonb_build_object(
  'revision',g.revision_no,'points',jsonb_build_object('numerator',g.points_num,'denominator',g.points_den),
  'actorId',coalesce(g.actor_id::text,'automatic'),'at',g.created_at,
  'comment',coalesce(g.comment,''),'reason',g.reason
 ) order by g.revision_no) entries
 from app.question_grades g join assigned q on q.id=g.attempt_question_id
 where q.teacher group by g.attempt_question_id
), doubled as materialized (
 select distinct pu.attempt_question_id from app.powerup_uses pu
 join assigned q on q.id=pu.attempt_question_id where pu.kind='double'
), answers as materialized (
 select aq.attempt_id,jsonb_agg(jsonb_build_object(
  'questionId',aq.question_key,'value',aq.payload,'idempotencyKey',aq.request_key,
  'submittedAt',aq.received_at,'usedDouble',d.attempt_question_id is not null,
  'reviews',coalesce(g.entries,'[]'::jsonb)) order by aq.position) entries
 from assigned aq left join reviews g on g.attempt_question_id=aq.id
 left join doubled d on d.attempt_question_id=aq.id
 where aq.request_key is not null group by aq.attempt_id
), orders as materialized (
 select attempt_id,jsonb_agg(question_key order by position) question_order,
  jsonb_object_agg(question_key,item_order->'items') option_orders
 from assigned group by attempt_id
), common_extensions as materialized (
 select e.activity_id,max(e.new_deadline) deadline from app.deadline_extensions e
 where e.participant_id is null and exists(select 1 from base b where b.activity_id=e.activity_id)
 group by e.activity_id
), personal_extensions as materialized (
 select e.participant_id,max(e.new_deadline) deadline from app.deadline_extensions e
 where exists(select 1 from base b where b.participant_id=e.participant_id)
 group by e.participant_id
)
select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
 'id',b.id,'activityId',b.activity_id,'studentId',b.student_id,'versionId',b.version_id,
 'number',b.attempt_no,'startedAt',b.started_at,
 'deadline',least(greatest(b.closes_at,ce.deadline),case when b.started_at is null or b.duration_seconds is null
  then 'infinity'::timestamptz else greatest(b.started_at+make_interval(secs=>b.duration_seconds),pe.deadline) end),
 'status',case when b.closed_at is null then 'in-progress' else 'closed' end,
 'closedAt',b.closed_at,'closeReason',case b.close_reason when 'deadline' then 'expired'
  when 'guided_completed' then 'guided-complete' when 'withdrawal' then 'removed'
  when 'archive' then 'archived' when 'teacher_early' then 'teacher-ended' else b.close_reason end,
 'resolution',b.decision,'answers',coalesce(ans.entries,'[]'::jsonb),
 'questionOrder',o.question_order,'optionOrders',o.option_orders
))),'[]'::jsonb)
from base b left join answers ans on ans.attempt_id=b.id left join orders o on o.attempt_id=b.id
left join common_extensions ce on ce.activity_id=b.activity_id
left join personal_extensions pe on pe.participant_id=b.participant_id;
$$;
revoke all on function app.workspace_attempts_json(uuid,uuid[],uuid[]) from public,anon,authenticated;

create function app.workspace_evaluations_json(u uuid,owned_subjects uuid[],visible_subjects uuid[],draft boolean)
returns jsonb language sql stable security definer set search_path='' as $$
with base as materialized (
 select e.*,a.id activity_id,a.subject_id,a.kind,a.max_grade,a.weight,a.counts_for_average,m.student_id
 from app.evaluation_revisions e join app.participants p on p.id=e.participant_id
 join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id
 where case when draft then e.published_at is null and a.subject_id=any(owned_subjects)
  else e.published_at is not null and
   (a.subject_id=any(owned_subjects) or m.student_id=u and a.subject_id=any(visible_subjects)) end
), revisions as materialized (
 select eq.evaluation_id,jsonb_object_agg(q.question_key,g.revision_no) entries
 from app.evaluation_question_grades eq join base b on b.id=eq.evaluation_id
 join app.question_grades g on g.id=eq.question_grade_id
 join app.attempt_questions q on q.id=g.attempt_question_id group by eq.evaluation_id
)
select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
 'id',b.id,'activityId',b.activity_id,'subjectId',b.subject_id,'studentId',b.student_id,
 'source',case b.source_kind when 'submission' then 'task' when 'nonparticipation' then b.kind else b.source_kind end,
 'attemptId',b.attempt_id,'submissionId',b.submission_version_id,'revision',b.revision_no,
 'grade',b.grade,'maxGrade',b.max_grade,'weight',b.weight,'countsTowardAverage',b.counts_for_average,
 'comment',coalesce(b.feedback,''),'reason',b.reason,'actorId',b.actor_id,'createdAt',b.created_at,
 'publishedAt',b.published_at,'answerRevisions',r.entries
))),'[]'::jsonb) from base b left join revisions r on r.evaluation_id=b.id;
$$;
revoke all on function app.workspace_evaluations_json(uuid,uuid[],uuid[],boolean) from public,anon,authenticated;

create or replace function app.student_results(s uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare m uuid:=app.require_student(s); result jsonb;
begin
 with activities as materialized (
  select a.*,p.id participant_id,q.feedback_policy
  from app.activities a left join app.participants p on p.activity_id=a.id and p.membership_id=m
  left join app.quiz_settings q on q.activity_id=a.id
  where a.subject_id=s and a.kind<>'reading' and a.published_at is not null
 ), evaluations as materialized (
  select e.* from app.evaluation_revisions e join activities a on a.participant_id=e.participant_id
 ), published as materialized (
  select distinct on(participant_id) * from evaluations where published_at is not null
  order by participant_id,revision_no desc
 ), attempts as materialized (
  select at.*,q.activity_id quiz_activity_id,r.decision
  from app.attempts at join activities a on a.participant_id=at.participant_id
  left join app.quiz_settings q on q.activity_id=a.id
  left join app.attempt_resolutions r on r.attempt_id=at.id
 ), ungraded as materialized (
  select distinct aq.attempt_id from app.attempt_questions aq join attempts at on at.id=aq.attempt_id
  where not exists(select 1 from app.question_grades g where g.attempt_question_id=aq.id)
 ), attempt_flags as materialized (
  select at.participant_id,bool_or(at.closed_at is null) has_open,
   bool_or(not coalesce(at.quiz_activity_id is not null and at.closed_at is not null
    and coalesce(at.decision,'')<>'exclude'
    and (at.close_reason not in ('withdrawal','archive','teacher_early') or at.decision='evaluate')
    and ug.attempt_id is null,false)) has_incomplete
  from attempts at left join ungraded ug on ug.attempt_id=at.id group by at.participant_id
 ), evaluation_flags as materialized (
  select participant_id from evaluations group by participant_id
 ), submissions as materialized (
  select distinct sub.participant_id from app.submissions sub
  join activities a on a.participant_id=sub.participant_id
 ), extensions as materialized (
  select de.activity_id,max(de.new_deadline) deadline from app.deadline_extensions de
  join activities a on a.id=de.activity_id where de.participant_id is null group by de.activity_id
 ), result_rows as materialized (
  select a.*,e.id evaluation_id,e.grade,e.published_at eval_published,
   coalesce(e.id is not null and (a.feedback_policy='immediate' or a.feedback_policy='after_close' and
    (now()>=coalesce(greatest(a.closes_at,de.deadline),'infinity'::timestamptz)
     or exists(select 1 from app.guided_sessions gs where gs.activity_id=a.id and gs.closed_at is not null))),false) visible,
   case when e.id is not null then 'published' when af.has_open then 'in-progress'
    when af.has_incomplete or sub.participant_id is not null and ef.participant_id is null then 'pending-review'
    when af.participant_id is not null or ef.participant_id is not null then 'unpublished'
    else 'not-started' end result_status
  from activities a left join published e on e.participant_id=a.participant_id
  left join attempt_flags af on af.participant_id=a.participant_id
  left join evaluation_flags ef on ef.participant_id=a.participant_id
  left join submissions sub on sub.participant_id=a.participant_id
  left join extensions de on de.activity_id=a.id
 ), answers as materialized (
  select eq.evaluation_id,jsonb_agg(jsonb_build_object('questionId',aq.question_key,
   'points',g.points_num/g.points_den,'maximum',qu.max_points,'explanation',sec.feedback,'comment',g.comment)
   order by aq.position) entries
  from app.evaluation_question_grades eq join result_rows r on r.evaluation_id=eq.evaluation_id and r.visible
  join app.question_grades g on g.id=eq.question_grade_id
  join app.attempt_questions aq on aq.id=g.attempt_question_id
  join app.questions qu on qu.version_id=aq.version_id and qu.question_key=aq.question_key
  join app.question_secrets sec on sec.version_id=aq.version_id and sec.question_key=aq.question_key
  group by eq.evaluation_id
 )
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'activityId',r.id,'title',r.title,'maxGrade',r.max_grade,'status',r.result_status,
  'publishedAt',r.eval_published,'reviewVisible',r.visible,'answers',ans.entries))||jsonb_build_object('grade',r.grade)
  order by coalesce(r.closes_at,r.occurs_on::timestamptz),r.id),'[]'::jsonb)
 into result from result_rows r left join answers ans on ans.evaluation_id=r.evaluation_id;
 return result;
end $$;

-- Cambiar únicamente las tres agregaciones del resumen. El guard evita aplicar
-- silenciosamente la migración sobre una definición que ya haya cambiado.
do $migration$
declare definition text:=pg_get_functiondef('app.snapshot_data(boolean)'::regprocedure);
 old_attempts text:=$line$select coalesce(jsonb_agg(app.attempt_json(at.id,(a.subject_id=any(owned_subjects)))),'[]') into attempts from app.attempts at join app.participants p on p.id=at.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where (a.subject_id=any(owned_subjects)) or m.student_id=u and (a.subject_id=any(visible_subjects));$line$;
 old_evaluations text:=$line$select coalesce(jsonb_agg(app.evaluation_json(e.id)),'[]') into evaluations from app.evaluation_revisions e join app.participants p on p.id=e.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where e.published_at is not null and ((a.subject_id=any(owned_subjects)) or m.student_id=u and (a.subject_id=any(visible_subjects)));$line$;
 old_drafts text:=$line$coalesce((select jsonb_agg(app.evaluation_json(e.id)) from app.evaluation_revisions e join app.participants p on p.id=e.participant_id join app.activities a on a.id=p.activity_id where (a.subject_id=any(owned_subjects)) and e.published_at is null),'[]'::jsonb)$line$;
begin
 if strpos(definition,old_attempts)=0 or strpos(definition,old_evaluations)=0 or strpos(definition,old_drafts)=0
 then raise exception 'WORKSPACE_PROJECTION_DEFINITION_CHANGED'; end if;
 definition:=replace(definition,old_attempts,'select app.workspace_attempts_json(u,owned_subjects,visible_subjects) into attempts;');
 definition:=replace(definition,old_evaluations,'select app.workspace_evaluations_json(u,owned_subjects,visible_subjects,false) into evaluations;');
 definition:=replace(definition,old_drafts,'app.workspace_evaluations_json(u,owned_subjects,visible_subjects,true)');
 execute definition;
end $migration$;
