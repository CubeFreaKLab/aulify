-- Avisos mínimos para un relé de servidor. Realtime no concede SELECT ni INSERT
-- a los clientes: sólo el servicio recibe estos canales privados.
create function app.emit_activity_hint(a uuid,student uuid default null,revoked boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if a is null then return; end if;
 -- La respuesta propia ya se devuelve después de persistir. No generar un
 -- segundo recorrido de lectura ni mensajes por cada acierto del participante.
 if not revoked and student is not null and student=auth.uid() then return; end if;
 -- La copia SQL aislada no necesita el servicio Realtime para conservar datos.
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return; end if;
 perform realtime.send(jsonb_strip_nulls(jsonb_build_object(
  'activityId',a,'studentId',student,'revoked',revoked)),
  'changed','aulify:activity:'||a::text,true);
exception when others then
 -- El aviso es auxiliar: una indisponibilidad no revierte una respuesta válida.
 raise warning 'AULIFY_ACTIVITY_HINT_UNAVAILABLE';
end $$;
revoke all on function app.emit_activity_hint(uuid,uuid,boolean) from public,anon,authenticated;

create function app.hint_common_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare a app.activities; s app.subjects;
begin
 if tg_op='UPDATE' and new.public_revision=old.public_revision then return null; end if;
 select * into a from app.activities where id=new.activity_id;
 if a.id is null or a.kind<>'quiz' then return null; end if;
 select * into s from app.subjects where id=a.subject_id;
 perform app.emit_activity_hint(a.id,null,
  a.published_at is null or s.archived_at is not null or s.purge_started_at is not null);
 return null;
end $$;
revoke all on function app.hint_common_activity() from public,anon,authenticated;
create trigger aulify_hint_common after insert or update on app.activity_sync_versions
for each row execute function app.hint_common_activity();

create function app.hint_participant_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare a uuid; student uuid;
begin
 if tg_op='UPDATE' and new.student_revision=old.student_revision then return null; end if;
 select p.activity_id,m.student_id into a,student from app.participants p
 join app.memberships m on m.id=p.membership_id
 join app.activities ac on ac.id=p.activity_id and ac.kind='quiz'
 where p.id=new.participant_id;
 if student is not null then perform app.emit_activity_hint(a,student,false); end if;
 return null;
end $$;
revoke all on function app.hint_participant_activity() from public,anon,authenticated;
create trigger aulify_hint_participant after insert or update on app.participant_sync_versions
for each row execute function app.hint_participant_activity();

create function app.hint_membership_access() returns trigger
language plpgsql security definer set search_path='' as $$
declare m app.memberships; a uuid;
begin
 if tg_op='DELETE' then m:=old;
 else
  m:=new;
  if new.status=old.status then return null; end if;
 end if;
 for a in select ac.id from app.activities ac join app.participants p on p.activity_id=ac.id
  where p.membership_id=m.id and ac.kind='quiz'
 loop
  perform app.emit_activity_hint(a,m.student_id,tg_op='DELETE' or m.status<>'approved');
 end loop;
 return case when tg_op='DELETE' then old else null end;
end $$;
revoke all on function app.hint_membership_access() from public,anon,authenticated;
create trigger aulify_hint_membership_update after update of status on app.memberships
for each row execute function app.hint_membership_access();
create trigger aulify_hint_membership_delete before delete on app.memberships
for each row execute function app.hint_membership_access();
