-- Evitar que la primera participación ajena cambie la huella estudiantil.
create or replace function app.track_sync_revision() returns trigger
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
 when 'activities' then
  a:=(j->>'id')::uuid;
  -- El bloqueo de reglas por la primera participación solo interesa al docente.
  pub:=not (tg_op='UPDATE' and (to_jsonb(new)-'locked_at')=(to_jsonb(old)-'locked_at'));
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

-- Los estudiantes no necesitan identidades de compañeros ni fecha de bloqueo docente.
create or replace function app.activity_json(a uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',x.id,'subjectId',x.subject_id,'versionId',x.version_id,'title',x.title,'createdAt',x.created_at,'settings',jsonb_build_object('purpose',q.purpose,'pace',case q.pacing when 'guided' then 'guided' else 'individual' end,'maxGrade',x.max_grade,'weight',x.weight,'countsTowardAverage',x.counts_for_average,'maxAttempts',q.attempt_limit,'opensAt',x.opens_at,'closesAt',app.deadline(a),'timeLimitMinutes',q.duration_seconds/60.0,'timeZone',x.timezone,'feedback',replace(q.feedback_policy,'_','-'),'manualCorrection',q.manual_closed_questions,'shuffleQuestions',q.shuffle_groups,'shuffleOptions',q.shuffle_options,'streaks',q.streaks_enabled,'sound',q.sound_allowed,'ranking',q.ranking_enabled,'teams',q.teams_enabled,'allowHint',q.hint_enabled,'allowDouble',q.double_enabled,'bonusAffectsGrade',q.bonus_affects_grade,'reportVisibility',q.visibility_tracking)) || case when su.owner_id=(select auth.uid()) then jsonb_build_object('lockedAt',x.locked_at) else '{}'::jsonb end || case when q.pacing='guided' then jsonb_build_object('guided',jsonb_build_object('status',case when s.closed_at is not null then 'closed' when s.started_at is not null then 'running' else 'waiting' end,'questionIndex',coalesce((select max(position)-1 from app.session_questions where activity_id=a and opened_at is not null),0),'questionOpen',exists(select 1 from app.session_questions where activity_id=a and opened_at is not null and closed_at is null),'studentIds',coalesce((select jsonb_agg(m.student_id) from app.participants p join app.memberships m on m.id=p.membership_id where p.activity_id=a and p.room_joined_at is not null and (su.owner_id=(select auth.uid()) or m.student_id=(select auth.uid()))),'[]'::jsonb))) else '{}'::jsonb end from app.activities x join app.subjects su on su.id=x.subject_id join app.quiz_settings q on q.activity_id=x.id left join app.guided_sessions s on s.activity_id=x.id where x.id=a;
$$;
