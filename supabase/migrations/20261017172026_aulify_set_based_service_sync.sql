CREATE OR REPLACE FUNCTION app.legacy_service_sync_batch(p_requests jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item jsonb; response jsonb; result jsonb:='[]';
 original_claims text:=current_setting('request.jwt.claims',true);
 original_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 if jsonb_typeof(p_requests) is distinct from 'array' or
  jsonb_array_length(p_requests)<1 or jsonb_array_length(p_requests)>64 then
  raise exception 'INVALID_SYNC_BATCH' using errcode='22023';
 end if;
 for item in select value from jsonb_array_elements(p_requests) loop
  begin
   perform set_config('request.jwt.claim.sub',(item->>'userId')::uuid::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',(item->>'userId')::uuid,'role','authenticated')::text,true);
   response:=app.activity_sync((item->>'activityId')::uuid);
   result:=result||jsonb_build_array(jsonb_build_object('key',item->>'key','value',response));
  exception when others then
   -- Solo el código cerrado; no devolver SQL, identidades ni detalles del error.
   result:=result||jsonb_build_array(jsonb_build_object('key',item->>'key','error',jsonb_build_object('code',sqlstate)));
  end;
  perform set_config('request.jwt.claims',coalesce(original_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(original_sub,''),true);
 end loop;
 return result;
end $function$;
revoke all on function app.legacy_service_sync_batch(jsonb) from public,anon,authenticated;

-- Resolver el lote como conjunto evita repetir contexto, permisos y agregados
-- de la misma actividad por cada sesión. No guarda resultados ni permisos.
-- El contrato de huella sigue siendo el de app.activity_sync; la identidad
-- procede exclusivamente del servidor que ya verificó la sesión.
create or replace function public.aulify_service_sync_batch(p_requests jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if jsonb_typeof(p_requests) is distinct from 'array' or
  jsonb_array_length(p_requests)<1 or jsonb_array_length(p_requests)>64 then
  raise exception 'INVALID_SYNC_BATCH' using errcode='22023';
 end if;
 -- Conservar la semántica de conversión UUID del contrato original, incluso
 -- para entradas mal formadas: se informa el error solo en ese elemento.
 if exists(select 1 from jsonb_array_elements(p_requests) r
  where r->>'userId' is not null and r->>'userId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or r->>'activityId' is not null and r->>'activityId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
  return app.legacy_service_sync_batch(p_requests);
 end if;
 with requests as materialized (
  select r->>'key' key,(r->>'userId')::uuid user_id,(r->>'activityId')::uuid activity_id,ord
  from jsonb_array_elements(p_requests) with ordinality e(r,ord)
 ), contexts as materialized (
  select a.id,a.kind,a.published_at,a.opens_at,a.closes_at,s.id subject_id,
   s.owner_id,s.archived_at,s.purge_started_at,v.public_revision,v.teacher_revision,
   q.duration_seconds,greatest(a.closes_at,(select max(new_deadline)
    from app.deadline_extensions e where e.activity_id=a.id and e.participant_id is null)) common_deadline
  from app.activities a
  left join app.subjects s on s.id=a.subject_id
  left join app.activity_sync_versions v on v.activity_id=a.id
  left join app.quiz_settings q on q.activity_id=a.id
  where a.id in(select activity_id from requests)
 ), actors as materialized (
  select r.*,c.*,r.user_id=c.owner_id owner,pa.id participant_id,pv.student_revision,
   case when au.id is null or au.email_confirmed_at is null or pr.id is null then '42501'
    when c.id is null or c.kind<>'quiz' or not coalesce(r.user_id=c.owner_id,false) and
     (c.published_at is null or c.archived_at is not null or c.purge_started_at is not null or m.id is null or m.status<>'approved') then '42501'
   end error
  from requests r left join contexts c on c.id=r.activity_id
  left join auth.users au on au.id=r.user_id
  left join app.profiles pr on pr.id=r.user_id
  left join app.memberships m on m.subject_id=c.subject_id and m.student_id=r.user_id
  left join app.participants pa on pa.activity_id=c.id and pa.membership_id=m.id
  left join app.participant_sync_versions pv on pv.participant_id=pa.id
 ), teacher_revisions as materialized (
  select pa.activity_id,jsonb_agg(jsonb_build_array(pa.id,coalesce(v.teacher_revision,0)) order by pa.id) revisions
  from app.participants pa left join app.participant_sync_versions v on v.participant_id=pa.id
  where pa.activity_id in(select id from actors where owner and error is null)
  group by pa.activity_id
 ), deadlines as (
  select a.*,case when a.duration_seconds is null then a.common_deadline else
   least(a.common_deadline,(select min(greatest(at.started_at+make_interval(secs=>a.duration_seconds),
    (select max(new_deadline) from app.deadline_extensions e where e.participant_id=pa.id)))
    from app.attempts at join app.participants pa on pa.id=at.participant_id
    where pa.activity_id=a.id and at.closed_at is null and (a.owner or pa.id=a.participant_id))) end attempt_deadline
  from actors a
 ), projected as (
  select d.*,case when opens_at>now() then least(attempt_deadline,opens_at) else attempt_deadline end next_deadline
  from deadlines d
 )
 select jsonb_agg(case when p.error is not null then
  jsonb_build_object('key',p.key,'error',jsonb_build_object('code',p.error))
 else jsonb_build_object('key',p.key,'value',jsonb_build_object(
  'revision',md5((jsonb_build_array(p.user_id,p.id,coalesce(p.public_revision,0),
   case when p.owner then coalesce(p.teacher_revision,0) else coalesce(p.student_revision,0) end,
   now()>=p.opens_at,p.next_deadline,now()>=p.next_deadline)
   ||case when p.owner then jsonb_build_array(coalesce(t.revisions,'[]'::jsonb)) else '[]'::jsonb end)::text),
  'serverTime',clock_timestamp(),'nextDeadline',p.next_deadline)) end order by p.ord)
 into result from projected p left join teacher_revisions t on t.activity_id=p.id;
 return result;
end $$;

-- El llamador público conserva exactamente sus permisos de solo servidor.
revoke all on function public.aulify_service_sync_batch(jsonb) from public,anon,authenticated;
grant execute on function public.aulify_service_sync_batch(jsonb) to service_role;
