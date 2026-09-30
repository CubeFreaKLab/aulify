-- Lectura sin mutaciones: efectos elegibles del tick global en este instante.
-- Un inventario vacío no autoriza por sí solo una llamada posterior; puede cambiar.
with counts as (
  select
    (select count(*) from app.attempts at
      join app.participants p on p.id=at.participant_id
      where at.closed_at is null
        and app.deadline(p.activity_id,p.id,at.started_at)<=now()) as expired_open_attempts,
    (select count(*) from app.integrity_events ev
      join app.attempts at on ev.attempt_id=at.id
      join app.participants p on at.participant_id=p.id
      where least(app.deadline(p.activity_id),(select gs.closed_at from app.guided_sessions gs where gs.activity_id=p.activity_id))+interval '30 days'<=now()) as due_integrity_events,
    (select count(*) from app.purge_jobs pj
      join app.subjects s on s.id=pj.subject_id
      where pj.status in ('scheduled','failed') and pj.due_at<=now()
        and (pj.next_retry_at is null or pj.next_retry_at<=now())
        and s.archived_at+interval '30 days'<=now()) as due_subjects,
    (select count(*) from app.file_objects f
      where f.created_at<now()-interval '1 day' and f.state in ('pending','ready')
        and not exists(select 1 from app.draft_files where file_id=f.id)
        and not exists(select 1 from app.content_blocks where file_id=f.id)
        and not exists(select 1 from app.submission_files where file_id=f.id)) as orphan_files_to_mark,
    (select count(*) from app.file_objects where state='delete_pending') as pending_file_objects,
    (select count(*) from app.purge_jobs pj
      where pj.status='running' and pj.subject_id is null
        and not exists(select 1 from app.file_objects where purge_job_id=pj.id)) as running_jobs_to_complete
)
select clock_timestamp() as checked_at, to_jsonb(counts) as effects_without_new_fixture from counts;
