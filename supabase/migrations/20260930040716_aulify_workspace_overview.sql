-- Resolver las materias autorizadas una vez por snapshot; evita consultar permisos por cada fila ajena.
create or replace function app.snapshot_data(include_activity_content boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=app.require_user(); teacher boolean; st jsonb; profiles jsonb; subjects jsonb; members jsonb; resources jsonb; versions jsonb; activities jsonb; attempts jsonb; powers jsonb; evaluations jsonb; tasks jsonb; submissions jsonb; manuals jsonb; help jsonb; studentviews jsonb:='{}'; results jsonb:='{}'; extra jsonb; rec record; owned_subjects uuid[]; active_owned_subjects uuid[]; visible_subjects uuid[];
begin
 select role='teacher' into teacher from app.profiles where id=u;
 select coalesce(array_agg(id),'{}'::uuid[]),coalesce(array_agg(id) filter(where archived_at is null and purge_started_at is null),'{}'::uuid[])
 into owned_subjects,active_owned_subjects from app.subjects where owner_id=u;
 select owned_subjects||coalesce(array_agg(m.subject_id),'{}'::uuid[]) into visible_subjects
 from app.memberships m join app.subjects s on s.id=m.subject_id
 where m.student_id=u and m.status='approved' and s.archived_at is null and s.purge_started_at is null;
 -- Materializar vencimientos propios o de las materias docentes; no modifica otros ámbitos.
 for rec in select at.id from app.attempts at join app.participants p on p.id=at.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where at.closed_at is null and ((a.subject_id=any(active_owned_subjects)) or m.student_id=u and (a.subject_id=any(visible_subjects))) and app.deadline(a.id,p.id,at.started_at)<=now() loop perform app.close_attempt(rec.id,'deadline'); end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.display_name,'role',pr.role,'email',case when pr.id=u then au.email else '' end)),'[]') into profiles from app.profiles pr join auth.users au on au.id=pr.id where pr.id=u or teacher and exists(select 1 from app.memberships m join app.subjects s on s.id=m.subject_id where m.student_id=pr.id and s.owner_id=u) or teacher and exists(select 1 from app.join_requests jr join app.invitation_codes c on c.id=jr.invitation_id join app.subjects s on s.id=c.subject_id where jr.student_id=pr.id and s.owner_id=u);
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s.id,'ownerId',s.owner_id,'name',s.name,'course',s.course_label,'year',s.school_year,'description',s.description,'status',case when s.archived_at is null then 'active' else 'archived' end,'archivedAt',s.archived_at))||jsonb_build_object('code',case when s.owner_id=u then (select code from app.invitation_codes where subject_id=s.id and revoked_at is null) else null end)),'[]') into subjects from app.subjects s where (s.id=any(visible_subjects)) or exists(select 1 from app.join_requests jr join app.invitation_codes c on c.id=jr.invitation_id where c.subject_id=s.id and jr.student_id=u and jr.status in ('pending','rejected'));
 select coalesce(jsonb_agg(j),'[]') into members from (
  select jsonb_build_object('id',m.id,'subjectId',m.subject_id,'studentId',m.student_id,'status',case m.status when 'withdrawn' then 'removed' else m.status end,'requestedAt',m.created_at,'decidedAt',m.updated_at) j from app.memberships m where (m.subject_id=any(owned_subjects)) or m.student_id=u and (m.subject_id=any(visible_subjects))
  union all select jsonb_build_object('id',jr.id,'subjectId',c.subject_id,'studentId',jr.student_id,'status',jr.status,'requestedAt',jr.requested_at,'decidedAt',jr.decided_at) from app.join_requests jr join app.invitation_codes c on c.id=jr.invitation_id where jr.status in ('pending','rejected') and ((c.subject_id=any(owned_subjects)) or jr.student_id=u) and not exists(select 1 from app.memberships m where m.subject_id=c.subject_id and m.student_id=jr.student_id and m.status='approved')
 ) allmembers;
 select coalesce(jsonb_agg(d.document||jsonb_build_object('id',r.id,'ownerId',r.owner_id,'title',r.title,'kind',case r.kind when 'standalone_quiz' then 'quiz' else 'resource' end,'revision',d.revision,'updatedAt',d.updated_at)),'[]') into resources from app.resources r join app.resource_drafts d on d.resource_id=r.id where r.owner_id=u;
 select coalesce(jsonb_agg(app.version_json(v.id,true)),'[]') into versions from app.resource_versions v join app.resources r on r.id=v.resource_id where r.owner_id=u;
 select coalesce(jsonb_agg(app.activity_json(a.id)),'[]') into activities from app.activities a where a.kind='quiz' and ((a.subject_id=any(owned_subjects)) or (a.subject_id=any(visible_subjects)) and a.published_at is not null);
 select coalesce(jsonb_agg(app.attempt_json(at.id,(a.subject_id=any(owned_subjects)))),'[]') into attempts from app.attempts at join app.participants p on p.id=at.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where (a.subject_id=any(owned_subjects)) or m.student_id=u and (a.subject_id=any(visible_subjects));
 select coalesce(jsonb_agg(jsonb_build_object('activityId',p.activity_id,'studentId',m.student_id,'kind',pu.kind,'questionId',aq.question_key,'attemptId',aq.attempt_id,'at',pu.consumed_at)),'[]') into powers from app.powerup_uses pu join app.participants p on p.id=pu.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id join app.attempt_questions aq on aq.id=pu.attempt_question_id where (a.subject_id=any(owned_subjects)) or m.student_id=u and (a.subject_id=any(visible_subjects));
 select coalesce(jsonb_agg(app.evaluation_json(e.id)),'[]') into evaluations from app.evaluation_revisions e join app.participants p on p.id=e.participant_id join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where e.published_at is not null and ((a.subject_id=any(owned_subjects)) or m.student_id=u and (a.subject_id=any(visible_subjects)));
 select coalesce(jsonb_agg(app.task_json(a.id)),'[]') into tasks from app.activities a where a.kind='task' and ((a.subject_id=any(owned_subjects)) or (a.subject_id=any(visible_subjects)) and a.published_at is not null);
 select coalesce(jsonb_agg(app.submission_json(v.id,(a.subject_id=any(owned_subjects)))),'[]') into submissions from app.submission_versions v join app.submissions s on s.id=v.submission_id join app.participants p on p.id=s.participant_id join app.activities a on a.id=p.activity_id join app.memberships m on m.id=p.membership_id where (a.subject_id=any(owned_subjects)) or m.student_id=u and (a.subject_id=any(visible_subjects));
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'subjectId',a.subject_id,'title',a.title,'description',coalesce(a.instructions,''),'occursAt',a.occurs_on,'maxGrade',a.max_grade,'weight',a.weight,'countsTowardAverage',a.counts_for_average)),'[]') into manuals from app.activities a where a.kind='manual' and ((a.subject_id=any(owned_subjects)) or (a.subject_id=any(visible_subjects)) and a.published_at is not null);
 select coalesce(jsonb_agg(jsonb_build_object('userId',h.profile_id,'version',h.guide_version,'status',h.state)),'[]') into help from app.help_progress h where h.profile_id=u and h.guide_key='initial';
 if not teacher then
  for rec in select a.id from app.activities a where a.kind='quiz' and a.published_at is not null and (a.subject_id=any(visible_subjects)) and include_activity_content loop studentviews:=studentviews||jsonb_build_object(rec.id,app.student_activity(rec.id)); end loop;
  for rec in select s.id from app.subjects s where (s.id=any(visible_subjects)) loop results:=results||jsonb_build_object(rec.id,app.student_results(rec.id)); end loop;
 end if;
 st:=jsonb_build_object('schemaVersion',1,'revision',floor(extract(epoch from clock_timestamp())*1000),'users',profiles,'subjects',subjects,'memberships',members,'resources',resources,'versions',versions,'activities',activities,'attempts',attempts,'powerups',powers,'evaluations',evaluations,'tasks',tasks,'submissions',submissions,'manualActivities',manuals,'helpPreferences',help);
 select jsonb_build_object('incidents',coalesce((select jsonb_agg(to_jsonb(ir)||jsonb_build_object('signalCount',(select count(*) from app.integrity_events where attempt_id=ir.attempt_id))) from app.incident_reviews ir join app.attempts at on at.id=ir.attempt_id join app.participants p on p.id=at.participant_id join app.activities a on a.id=p.activity_id where (a.subject_id=any(owned_subjects))),'[]'::jsonb),'teams',coalesce((select jsonb_agg(jsonb_build_object('id',te.id,'activityId',te.activity_id,'name',te.name,'studentIds',(select jsonb_agg(m.student_id) from app.team_members tm join app.participants p on p.id=tm.participant_id join app.memberships m on m.id=p.membership_id where tm.team_id=te.id))) from app.teams te join app.activities a on a.id=te.activity_id where (a.subject_id=any(owned_subjects))),'[]'::jsonb),'readings',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'subjectId',a.subject_id,'title',a.title,'content',app.version_json(a.version_id,false))) from app.activities a where a.kind='reading' and a.published_at is not null and (a.subject_id=any(visible_subjects))),'[]'::jsonb),'draftEvaluations',coalesce((select jsonb_agg(app.evaluation_json(e.id)) from app.evaluation_revisions e join app.participants p on p.id=e.participant_id join app.activities a on a.id=p.activity_id where (a.subject_id=any(owned_subjects)) and e.published_at is null),'[]'::jsonb)) into extra;
 -- Sólo conteos autorizados: el contenido completo se obtiene al abrir una actividad.
 extra:=extra||jsonb_build_object('activityQuestionCounts',coalesce((
  select jsonb_object_agg(a.id,(select count(*) from app.questions q where q.version_id=a.version_id))
  from app.activities a where a.kind='quiz' and
   (a.subject_id=any(owned_subjects) or a.subject_id=any(visible_subjects) and a.published_at is not null)
 ),'{}'::jsonb));
 extra:=extra||jsonb_build_object('resubmissionWindows',coalesce((
  select jsonb_agg(jsonb_build_object('taskId',p.activity_id,'studentId',m.student_id,'closesAt',w.closes_at) order by w.closes_at,p.id)
  from app.resubmission_windows w
  join app.participants p on p.id=w.participant_id
  join app.memberships m on m.id=p.membership_id
  join app.activities a on a.id=p.activity_id
  where w.revoked_at is null and now() between w.opens_at and w.closes_at
    and ((a.subject_id=any(owned_subjects)) or m.student_id=u and (a.subject_id=any(visible_subjects)))
 ),'[]'::jsonb));
 return jsonb_build_object('state',st,'userId',u,'studentActivities',studentviews,'studentResults',results,'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'activityId',p.activity_id,'studentId',m.student_id,'alias','Participante '||lpad(p.alias_no::text,2,'0'))) from app.participants p join app.memberships m on m.id=p.membership_id join app.activities a on a.id=p.activity_id where (a.subject_id=any(owned_subjects))),'[]'::jsonb))||extra;
end $$;

-- Compatibilidad del contrato completo; la interfaz general usa el resumen.
create or replace function app.snapshot() returns jsonb language sql volatile security definer set search_path='' as $$
 select app.snapshot_data(true);
$$;
create function public.aulify_workspace_overview() returns jsonb language sql volatile security invoker set search_path='' as $$
 select app.snapshot_data(false);
$$;
revoke all on function app.snapshot_data(boolean),public.aulify_workspace_overview() from public,anon,authenticated;
grant execute on function app.snapshot_data(boolean),public.aulify_workspace_overview() to authenticated;

-- La lista sólo necesita saber si hay revisión pendiente; no requiere sumar puntos.
create function app.attempt_complete(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select
  at.closed_at is not null and coalesce(r.decision,'')<>'exclude'
  and (at.close_reason not in ('withdrawal','archive','teacher_early') or r.decision='evaluate')
  and not exists(
   select 1 from app.attempt_questions aq join app.questions qu using(version_id,question_key)
   left join lateral(select points_num from app.question_grades where attempt_question_id=aq.id order by revision_no desc limit 1) g on true
   where aq.attempt_id=t and g.points_num is null
  )
  from app.attempts at join app.participants p on p.id=at.participant_id
  join app.activities a on a.id=p.activity_id join app.quiz_settings qs on qs.activity_id=a.id
  left join app.attempt_resolutions r on r.attempt_id=at.id where at.id=t
 ),false);
$$;
revoke all on function app.attempt_complete(uuid) from public,anon,authenticated;

create or replace function app.student_results(s uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare m uuid:=app.require_student(s); x record; j jsonb:='[]'; visible boolean; answers jsonb; status text;
begin
 for x in select a.*,p.id participant_id,e.id evaluation_id,e.grade,e.published_at eval_published,e.attempt_id,e.submission_version_id,q.feedback_policy from app.activities a left join app.participants p on p.activity_id=a.id and p.membership_id=m left join lateral(select * from app.evaluation_revisions where participant_id=p.id and published_at is not null order by revision_no desc limit 1) e on true left join app.quiz_settings q on q.activity_id=a.id where a.subject_id=s and a.kind<>'reading' and a.published_at is not null order by coalesce(a.closes_at,a.occurs_on::timestamptz),a.id loop
  visible:=x.evaluation_id is not null and (x.feedback_policy='immediate' or x.feedback_policy='after_close' and app.activity_closed(x.id)); answers:=null;
  if x.evaluation_id is not null then status:='published';
  elsif exists(select 1 from app.attempts where participant_id=x.participant_id and closed_at is null) then status:='in-progress';
  elsif exists(select 1 from app.attempts where participant_id=x.participant_id and not app.attempt_complete(id)) or exists(select 1 from app.submissions where participant_id=x.participant_id) and not exists(select 1 from app.evaluation_revisions where participant_id=x.participant_id) then status:='pending-review';
  elsif exists(select 1 from app.attempts where participant_id=x.participant_id) or exists(select 1 from app.evaluation_revisions where participant_id=x.participant_id) then status:='unpublished'; else status:='not-started'; end if;
  if visible then select jsonb_agg(jsonb_build_object('questionId',aq.question_key,'points',g.points_num/g.points_den,'maximum',qu.max_points,'explanation',sec.feedback,'comment',g.comment) order by aq.position) into answers from app.evaluation_question_grades eq join app.question_grades g on g.id=eq.question_grade_id join app.attempt_questions aq on aq.id=g.attempt_question_id join app.questions qu using(version_id,question_key) join app.question_secrets sec using(version_id,question_key) where eq.evaluation_id=x.evaluation_id; end if;
  j:=j||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('activityId',x.id,'title',x.title,'maxGrade',x.max_grade,'status',status,'publishedAt',x.eval_published,'reviewVisible',coalesce(visible,false),'answers',answers))||jsonb_build_object('grade',x.grade));
 end loop; return j;
end $$;

