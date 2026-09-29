-- Evitar que respuestas de participantes distintos escriban un contador compartido.
-- Las revisiones son metadatos derivados; no sustituyen autorización ni bloqueos de dominio.
alter table app.participant_sync_versions
 add column teacher_revision bigint not null default 0 check(teacher_revision>=0);

create or replace function app.bump_sync_revision(a uuid,p uuid,pub boolean,student_change boolean)
returns void language plpgsql security definer set search_path='' as $$
declare participant_present boolean;
begin
 if a is null or not exists(select 1 from app.activities where id=a) then return; end if;
 participant_present:=p is not null and exists(select 1 from app.participants where id=p and activity_id=a);
 -- Cambios comunes, públicos o de un participante ya eliminado conservan la marca común.
 -- Cuando ambas filas se necesitan, mantener el orden común -> participante.
 if pub or not participant_present then
  insert into app.activity_sync_versions(activity_id,public_revision,teacher_revision)
  values(a,case when pub then 1 else 0 end,1)
  on conflict(activity_id) do update set
   public_revision=activity_sync_versions.public_revision+case when pub then 1 else 0 end,
   teacher_revision=activity_sync_versions.teacher_revision+1;
 end if;
 if participant_present then
  insert into app.participant_sync_versions(participant_id,student_revision,teacher_revision)
  values(p,case when student_change then 1 else 0 end,1)
  on conflict(participant_id) do update set
   student_revision=participant_sync_versions.student_revision+case when student_change then 1 else 0 end,
   teacher_revision=participant_sync_versions.teacher_revision+1;
 end if;
end $$;

create or replace function app.activity_sync(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=app.require_user(); a app.activities; s app.subjects; owner boolean; p uuid;
 public_rev bigint; teacher_rev bigint; student_rev bigint; duration int; teacher_participants jsonb;
 common_deadline timestamptz; next_deadline timestamptz;
begin
 select * into a from app.activities where id=p_activity_id;
 select * into s from app.subjects where id=a.subject_id;
 owner:=s.owner_id=u;
 if a.id is null or a.kind<>'quiz' or not coalesce(owner,false) and
  (a.published_at is null or s.archived_at is not null or s.purge_started_at is not null or
   not exists(select 1 from app.memberships where subject_id=s.id and student_id=u and status='approved')) then
  raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';
 end if;
 select pa.id into p from app.participants pa join app.memberships m on m.id=pa.membership_id where pa.activity_id=a.id and m.student_id=u;
 select v.public_revision,v.teacher_revision into public_rev,teacher_rev from app.activity_sync_versions v where v.activity_id=a.id;
 select v.student_revision into student_rev from app.participant_sync_versions v where v.participant_id=p;
 if owner then
  -- Identidad y orden estable: agregar solo sumas permitiría colisiones al reemplazar participantes.
  select coalesce(jsonb_agg(jsonb_build_array(pa.id,coalesce(v.teacher_revision,0)) order by pa.id),'[]'::jsonb)
   into teacher_participants from app.participants pa
   left join app.participant_sync_versions v on v.participant_id=pa.id where pa.activity_id=a.id;
 end if;
 select duration_seconds into duration from app.quiz_settings where activity_id=a.id;
 select greatest(a.closes_at,max(new_deadline)) into common_deadline from app.deadline_extensions where activity_id=a.id and participant_id is null;
 next_deadline:=common_deadline;
 if duration is not null then
  select least(common_deadline,min(greatest(at.started_at+make_interval(secs=>duration),e.personal_deadline))) into next_deadline
  from app.attempts at join app.participants pa on pa.id=at.participant_id
  left join lateral(select max(new_deadline) personal_deadline from app.deadline_extensions where participant_id=pa.id) e on true
  where pa.activity_id=a.id and at.closed_at is null and (owner or pa.id=p);
 end if;
 if a.opens_at>now() then next_deadline:=least(next_deadline,a.opens_at); end if;
 return jsonb_build_object('revision',md5((jsonb_build_array(u,a.id,coalesce(public_rev,0),
  case when owner then coalesce(teacher_rev,0) else coalesce(student_rev,0) end,
  now()>=a.opens_at,next_deadline,now()>=next_deadline)
  ||case when owner then jsonb_build_array(teacher_participants) else '[]'::jsonb end)::text),
  'serverTime',clock_timestamp(),'nextDeadline',next_deadline);
end $$;

-- CREATE OR REPLACE conserva ACL; declarar expresamente el límite del helper privado.
revoke all on function app.bump_sync_revision(uuid,uuid,boolean,boolean) from public,anon,authenticated;
