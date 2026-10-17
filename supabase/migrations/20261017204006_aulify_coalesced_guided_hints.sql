-- Una operación guiada puede modificar cincuenta intentos. El aviso común
-- confirma todos esos cambios al terminar la misma transacción; no requiere
-- además un mensaje privado por cada participante.
create or replace function app.hint_common_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare a app.activities; s app.subjects;
begin
 if tg_op='UPDATE' and new.public_revision=old.public_revision then return null; end if;
 select * into a from app.activities where id=new.activity_id;
 if a.id is null or a.kind<>'quiz' then return null; end if;
 select * into s from app.subjects where id=a.subject_id;
 perform app.emit_activity_hint(a.id,null,
  a.published_at is null or s.archived_at is not null or s.purge_started_at is not null);
 perform set_config('aulify.hint_common_'||replace(a.id::text,'-',''),'1',true);
 return null;
end $$;

create or replace function app.hint_participant_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare a uuid; student uuid;
begin
 if tg_op='UPDATE' and new.student_revision=old.student_revision then return null; end if;
 select p.activity_id,m.student_id into a,student from app.participants p
 join app.memberships m on m.id=p.membership_id
 join app.activities ac on ac.id=p.activity_id and ac.kind='quiz'
 where p.id=new.participant_id;
 if current_setting('aulify.hint_common_'||replace(a::text,'-',''),true)='1' then return null; end if;
 if student is not null then perform app.emit_activity_hint(a,student,false); end if;
 return null;
end $$;
drop trigger aulify_hint_participant on app.participant_sync_versions;
create constraint trigger aulify_hint_participant after insert or update on app.participant_sync_versions
deferrable initially deferred for each row execute function app.hint_participant_activity();
