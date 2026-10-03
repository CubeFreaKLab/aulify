-- Delegar los rechazos a la operación original antes de leer la huella.
-- Conserva los errores y permisos de retiro, archivo y propietario ajeno.
create or replace function app.submit_answer(t uuid,k uuid,value jsonb,req uuid,doubled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare x record; before_revision text; before_student bigint; before_public bigint;
 after_student bigint; after_public bigint; already_saved boolean; expected_delta integer; result jsonb;
begin
 select at.closed_at,p.id participant_id,p.activity_id,m.student_id,m.status membership_status,s.archived_at,s.purge_started_at into x
 from app.attempts at join app.participants p on p.id=at.participant_id
 join app.memberships m on m.id=p.membership_id join app.subjects s on s.id=m.subject_id where at.id=t;
 if x.student_id is distinct from auth.uid() or x.membership_status is distinct from 'approved' or x.archived_at is not null or x.purge_started_at is not null then
  return app.submit_answer_persisted(t,k,value,req,doubled);
 end if;
 before_revision:=app.activity_sync(x.activity_id)->>'revision';
 select coalesce(student_revision,0) into before_student from app.participant_sync_versions where participant_id=x.participant_id;
 select coalesce(public_revision,0) into before_public from app.activity_sync_versions where activity_id=x.activity_id;
 already_saved:=exists(select 1 from app.responses where request_key=req);
 result:=app.submit_answer_persisted(t,k,value,req,doubled);
 set constraints app.aulify_sync_revision immediate;
 select coalesce(student_revision,0) into after_student from app.participant_sync_versions where participant_id=x.participant_id;
 select coalesce(public_revision,0) into after_public from app.activity_sync_versions where activity_id=x.activity_id;
 -- Una respuesta nueva, el doble consumido y el cierre propio son las únicas
 -- modificaciones estudiantiles que aporta el intento devuelto por este comando.
 expected_delta:=case when already_saved then 0 else 1+case when doubled then 1 else 0 end end
  +case when x.closed_at is null and result->'attempt'->>'status'='closed' then 1 else 0 end;
 result:=result||jsonb_build_object(
  'syncBaseRevision',before_revision,
  'syncRevision',app.activity_sync(x.activity_id)->>'revision',
  'syncProjectionComplete',coalesce(after_public=before_public and after_student=before_student+expected_delta,false));
 set constraints app.aulify_sync_revision deferred;
 return result;
end $$;

