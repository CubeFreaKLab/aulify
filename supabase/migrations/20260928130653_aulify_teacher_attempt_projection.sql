-- Reunir los intentos docentes por conjuntos; conservar autorización y ruta estudiantil.
create function app.activity_attempts_json(a uuid,teacher boolean,u uuid)
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
 select g.attempt_question_id,jsonb_agg(jsonb_build_object(
  'revision',g.revision_no,'points',jsonb_build_object('numerator',g.points_num,'denominator',g.points_den),
  'actorId',coalesce(g.actor_id::text,'automatic'),'at',g.created_at,'comment',coalesce(g.comment,''),'reason',g.reason
 ) order by g.revision_no) entries
 from app.question_grades g join assigned q on q.id=g.attempt_question_id where teacher
 group by g.attempt_question_id
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

create or replace function app.activity_snapshot(p_activity_id uuid) returns jsonb
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
 if teacher then attempts:=app.activity_attempts_json(a.id,true,u);
 else select coalesce(jsonb_agg(app.attempt_json(at.id,teacher)),'[]') into attempts from app.attempts at join app.participants pa on pa.id=at.participant_id join app.memberships m on m.id=pa.membership_id where pa.activity_id=a.id and (teacher or m.student_id=u);
 end if;
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
