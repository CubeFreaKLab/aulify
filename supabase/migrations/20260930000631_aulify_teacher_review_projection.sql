-- Consultar revisiones sólo para respuestas presentes en la actividad autorizada.
-- Conserva todas las revisiones, orden, permisos y forma de la proyección.
create or replace function app.activity_attempts_json(a uuid,teacher boolean,u uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with base as materialized (
 select at.*,p.activity_id,m.student_id,ac.version_id,r.decision,qs.duration_seconds,
  greatest(ac.closes_at,(select max(new_deadline) from app.deadline_extensions where activity_id=a and participant_id is null)) common_deadline
 from app.attempts at join app.participants p on p.id=at.participant_id
 join app.memberships m on m.id=p.membership_id join app.activities ac on ac.id=p.activity_id
 join app.quiz_settings qs on qs.activity_id=ac.id
 left join app.attempt_resolutions r on r.attempt_id=at.id
 where p.activity_id=a and (teacher or m.student_id=u)
), assigned as materialized (
 select aq.*,r.request_key,r.payload,r.received_at
 from app.attempt_questions aq join base b on b.id=aq.attempt_id
 left join app.responses r on r.attempt_question_id=aq.id
), reviews as materialized (
 select q.id as attempt_question_id, review_rows.entries
 from assigned q
 cross join lateral (
  select jsonb_agg(jsonb_build_object(
   'revision',g.revision_no,'points',jsonb_build_object('numerator',g.points_num,'denominator',g.points_den),
   'actorId',coalesce(g.actor_id::text,'automatic'),'at',g.created_at,'comment',coalesce(g.comment,''),'reason',g.reason
  ) order by g.revision_no) entries
  from app.question_grades g where g.attempt_question_id=q.id
 ) review_rows
 where teacher and q.request_key is not null
), answers as materialized (
 select aq.attempt_id,jsonb_agg(jsonb_build_object('questionId',aq.question_key,'value',aq.payload,
  'idempotencyKey',aq.request_key,'submittedAt',aq.received_at,'usedDouble',pu.attempt_question_id is not null,
  'reviews',coalesce(g.entries,'[]'::jsonb)) order by aq.position) entries
 from assigned aq left join reviews g on g.attempt_question_id=aq.id
 left join app.powerup_uses pu on pu.attempt_question_id=aq.id and pu.kind='double'
 where aq.request_key is not null group by aq.attempt_id
), orders as materialized (
 select attempt_id,jsonb_agg(question_key order by position) question_order,
  jsonb_object_agg(question_key,item_order->'items') option_orders from assigned group by attempt_id
), extensions as materialized (
 select e.participant_id,max(e.new_deadline) personal_deadline from app.deadline_extensions e
 where exists(select 1 from base b where b.participant_id=e.participant_id) group by e.participant_id
)
select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
 'id',x.id,'activityId',x.activity_id,'studentId',x.student_id,'versionId',x.version_id,
 'number',x.attempt_no,'startedAt',x.started_at,
 'deadline',least(x.common_deadline,case when x.started_at is null or x.duration_seconds is null then 'infinity'::timestamptz
  else greatest(x.started_at+make_interval(secs=>x.duration_seconds),e.personal_deadline) end),
 'status',case when x.closed_at is null then 'in-progress' else 'closed' end,
 'closedAt',x.closed_at,'closeReason',case x.close_reason when 'deadline' then 'expired' when 'guided_completed' then 'guided-complete'
  when 'withdrawal' then 'removed' when 'archive' then 'archived' when 'teacher_early' then 'teacher-ended' else x.close_reason end,
 'resolution',x.decision,'answers',coalesce(ans.entries,'[]'::jsonb),
 'questionOrder',o.question_order,'optionOrders',o.option_orders
))),'[]'::jsonb)
from base x left join answers ans on ans.attempt_id=x.id left join orders o on o.attempt_id=x.id
left join extensions e on e.participant_id=x.participant_id;
$$;
revoke all on function app.activity_attempts_json(uuid,boolean,uuid) from public,anon,authenticated;

