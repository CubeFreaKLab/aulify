-- points_num es NOT NULL: para detectar revisión pendiente basta la existencia
-- de una calificación. No reconstruir ni ordenar sus revisiones para cada pregunta.
-- Las claves foráneas garantizan la pregunta y la actividad referenciadas.
create or replace function app.attempt_complete(t uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select
  at.closed_at is not null and coalesce(r.decision,'')<>'exclude'
  and (at.close_reason not in ('withdrawal','archive','teacher_early') or r.decision='evaluate')
  and not exists (
   select 1 from app.attempt_questions aq
   where aq.attempt_id=t and not exists (
    select 1 from app.question_grades g where g.attempt_question_id=aq.id
   )
  )
  from app.attempts at
  join app.participants p on p.id=at.participant_id
  join app.quiz_settings qs on qs.activity_id=p.activity_id
  left join app.attempt_resolutions r on r.attempt_id=at.id
  where at.id=t
 ),false);
$$;
-- Helper interno: no se incorpora una nueva entrada pública.
revoke all on function app.attempt_complete(uuid) from public,anon,authenticated;
