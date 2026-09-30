-- Fixture único creado por retention-scheduled-prepare.mjs. No ejecutar de nuevo.
-- Fechas sintéticas sólo para elegibilidad; el plazo posterior se observa con reloj real.
do $fixture$ begin
 if not exists(select 1 from app.subjects where id='c7f3610f-30bc-4905-82a4-96da26660077' and name='AP31-cron-fc7947c2' and archived_at>now()-interval '10 minutes') then raise exception 'FIXTURE_IDENTITY_MISMATCH'; end if;
 if not exists(select 1 from app.file_objects f join storage.objects o on o.bucket_id=f.bucket and o.name=f.object_path where f.id='23b15f77-2a60-4087-a2b9-60fe305d0f0b' and f.state='ready') then raise exception 'FIXTURE_OBJECT_MISSING'; end if;
 update app.subjects set archived_at=now()-interval '30 days' where id='c7f3610f-30bc-4905-82a4-96da26660077';
 update app.purge_jobs set due_at=now() where subject_id='c7f3610f-30bc-4905-82a4-96da26660077' and status='scheduled';
end $fixture$;
select clock_timestamp() checked_at,j.id job_id,j.status,j.due_at eligible_at,j.due_at+interval '24 hours' target_by,
s.id subject_id,s.archived_at synthetic_archived_at,
f.id file_id,f.state file_state,exists(select 1 from storage.objects o where o.bucket_id=f.bucket and o.name=f.object_path) object_present
from app.purge_jobs j join app.subjects s on s.id=j.subject_id cross join app.file_objects f where s.id='c7f3610f-30bc-4905-82a4-96da26660077' and f.id='23b15f77-2a60-4087-a2b9-60fe305d0f0b';
