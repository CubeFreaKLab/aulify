-- Serializar envío/cierre de una pregunta guiada antes de adjudicar respuesta u omisión.
create or replace function app.submit_answer(t uuid,k uuid,value jsonb,req uuid,doubled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare x record; aq app.attempt_questions; old app.responses; scoring jsonb; h text; nextq uuid; feedback jsonb; saved boolean;
begin
 select at.*,p.activity_id,m.subject_id,m.student_id,qs.* into x from app.attempts at join app.participants p on p.id=at.participant_id join app.memberships m on m.id=p.membership_id join app.quiz_settings qs on qs.activity_id=p.activity_id where at.id=t;
 if x.student_id is distinct from auth.uid() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform app.require_student(x.subject_id);
 -- El cierre docente bloquea pregunta y después intento. Mantener el mismo orden.
 -- Los reintentos idempotentes pueden consultar también una pregunta ya cerrada.
 if x.pacing='guided' then
  perform 1 from app.session_questions where activity_id=x.activity_id and question_key=k for share;
 end if;
 perform 1 from app.attempts where id=t for update;
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
