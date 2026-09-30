-- Agrupar las lecturas puntuales del sondeo sin cambiar su autorización ni huella.
-- Los metadatos opcionales conservan la semántica de ausencia mediante LEFT JOIN.
create or replace function app.activity_sync(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=app.require_user(); c record; owner boolean; p uuid;
 student_rev bigint; teacher_participants jsonb;
 common_deadline timestamptz; next_deadline timestamptz;
begin
 select a.id,a.kind,a.published_at,a.opens_at,a.closes_at,
  s.id subject_id,s.owner_id,s.archived_at,s.purge_started_at,
  v.public_revision,v.teacher_revision,q.duration_seconds
 into c
 from app.activities a
 left join app.subjects s on s.id=a.subject_id
 left join app.activity_sync_versions v on v.activity_id=a.id
 left join app.quiz_settings q on q.activity_id=a.id
 where a.id=p_activity_id;
 owner:=c.owner_id=u;
 if c.id is null or c.kind<>'quiz' or not coalesce(owner,false) and
  (c.published_at is null or c.archived_at is not null or c.purge_started_at is not null or
   not exists(select 1 from app.memberships where subject_id=c.subject_id and student_id=u and status='approved')) then
  raise exception 'ACTIVITY_UNAVAILABLE' using errcode='42501';
 end if;
 if owner then
  -- Mantener identidad y orden estable; no reducir este agregado a una suma.
  select coalesce(jsonb_agg(jsonb_build_array(pa.id,coalesce(v.teacher_revision,0)) order by pa.id),'[]'::jsonb)
   into teacher_participants from app.participants pa
   left join app.participant_sync_versions v on v.participant_id=pa.id where pa.activity_id=c.id;
 else
  select pa.id,v.student_revision into p,student_rev
   from app.participants pa join app.memberships m on m.id=pa.membership_id
   left join app.participant_sync_versions v on v.participant_id=pa.id
   where pa.activity_id=c.id and m.student_id=u;
 end if;
 select greatest(c.closes_at,max(new_deadline)) into common_deadline
  from app.deadline_extensions where activity_id=c.id and participant_id is null;
 next_deadline:=common_deadline;
 if c.duration_seconds is not null then
  select least(common_deadline,min(greatest(at.started_at+make_interval(secs=>c.duration_seconds),e.personal_deadline))) into next_deadline
  from app.attempts at join app.participants pa on pa.id=at.participant_id
  left join lateral(select max(new_deadline) personal_deadline from app.deadline_extensions where participant_id=pa.id) e on true
  where pa.activity_id=c.id and at.closed_at is null and (owner or pa.id=p);
 end if;
 if c.opens_at>now() then next_deadline:=least(next_deadline,c.opens_at); end if;
 return jsonb_build_object('revision',md5((jsonb_build_array(u,c.id,coalesce(c.public_revision,0),
  case when owner then coalesce(c.teacher_revision,0) else coalesce(student_rev,0) end,
  now()>=c.opens_at,next_deadline,now()>=next_deadline)
  ||case when owner then jsonb_build_array(teacher_participants) else '[]'::jsonb end)::text),
  'serverTime',clock_timestamp(),'nextDeadline',next_deadline);
end $$;

-- CREATE OR REPLACE mantiene las ACL existentes; no se amplía el acceso.
