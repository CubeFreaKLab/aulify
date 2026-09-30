-- Verificación AP-28 en PostgreSQL remoto con fixtures existentes de carga.
-- Todas las escrituras, incluido tick global, se revierten en una subtransacción.
-- No llama a Storage HTTP ni acredita mantenimiento periódico ni purga de objetos.
set local statement_timeout = '15s';
set local lock_timeout = '1s';
do $verify$
declare
 source app.activities; teacher_id uuid; student_id uuid;
 activity jsonb; attempt jsonb; settings jsonb; reported boolean;
 checks jsonb := '[]'; result jsonb; fixture_id uuid;
 before_count bigint; after_count bigint; events_count int;
begin
 select ac.* into source from app.activities ac
 where ac.title='Carga individual · measurement · 24930805' order by ac.id limit 1;
 if source.id is null then raise exception 'No existe el fixture de carga esperado'; end if;
 select owner_id into teacher_id from app.subjects where id=source.subject_id;
 select m.student_id into student_id from app.memberships m
 where m.subject_id=source.subject_id and m.status='approved' order by m.id limit 1;
 select count(*) into before_count from app.activities;
 begin
  perform set_config('request.jwt.claim.sub',teacher_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher_id,'role','authenticated')::text,true);
  settings := (app.activity_json(source.id)->'settings') || jsonb_build_object(
   'pace','guided','reportVisibility',true,'opensAt',now()-interval '1 minute',
   'closesAt',now()+interval '1 hour','teams',false,'ranking',false);
  set local role authenticated;
  activity := public.aulify_command('createActivity',jsonb_build_object('args',jsonb_build_array(
   source.version_id,source.subject_id,settings,'AP-28 · transacción reversible')));
  fixture_id := (activity->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',student_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',student_id,'role','authenticated')::text,true);
  perform public.aulify_command('joinGuidedRoom',jsonb_build_object('args',jsonb_build_array(fixture_id)));
  perform set_config('request.jwt.claim.sub',teacher_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher_id,'role','authenticated')::text,true);
  perform public.aulify_command('startGuidedSession',jsonb_build_object('args',jsonb_build_array(fixture_id)));
  perform set_config('request.jwt.claim.sub',student_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',student_id,'role','authenticated')::text,true);
  attempt := public.aulify_command('startAttempt',jsonb_build_object('args',jsonb_build_array(fixture_id)));
  reported := public.aulify_command('reportVisibility',jsonb_build_object('args',jsonb_build_array(
   attempt->>'id',gen_random_uuid(),now(),null))) = 'true'::jsonb;
  if not reported then raise exception 'No se registró la señal de prueba'; end if;
  checks := checks || jsonb_build_array('Señal registrada mediante comando autenticado');
  perform set_config('request.jwt.claim.sub',teacher_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher_id,'role','authenticated')::text,true);
  perform public.aulify_command('reviewIncident',jsonb_build_object('args',jsonb_build_array(
   attempt->>'id','reviewed_no_action','Observación ficticia sin sanción')));
  perform public.aulify_command('endGuidedSession',jsonb_build_object('args',jsonb_build_array(
   fixture_id,'Cierre de prueba',true)));
  reset role;
  update app.guided_sessions set started_at=now()-interval '31 days',
   closed_at=now()-interval '30 days'+interval '1 microsecond' where activity_id=fixture_id;
  set local role service_role;
  perform public.aulify_maintenance('tick');
  reset role;
  select count(*) into events_count from app.integrity_events where attempt_id=(attempt->>'id')::uuid;
  if events_count<>1 then raise exception 'La señal desaparece antes del plazo'; end if;
  checks := checks || jsonb_build_array('Un microsegundo antes de treinta días conserva el detalle');
  update app.guided_sessions set closed_at=now()-interval '30 days' where activity_id=fixture_id;
  set local role service_role;
  perform public.aulify_maintenance('tick');
  reset role;
  select count(*) into events_count from app.integrity_events where attempt_id=(attempt->>'id')::uuid;
  if events_count<>0 then raise exception 'La señal permanece al vencer los treinta días'; end if;
  checks := checks || jsonb_build_array('En la frontera exacta elimina el detalle');
  if not exists(select 1 from app.incident_reviews where attempt_id=(attempt->>'id')::uuid
   and status='reviewed_no_action' and comment='Observación ficticia sin sanción') then
   raise exception 'No conserva la resolución docente';
  end if;
  checks := checks || jsonb_build_array('Conserva la resolución docente sin sanción automática');
  result := jsonb_build_object('status','passed','checks',checks,'tickCalls',2);
  raise exception using errcode='P0002',message='AP28_ROLLBACK';
 exception when no_data_found then
  if sqlerrm<>'AP28_ROLLBACK' then raise; end if;
 when others then
  result := jsonb_build_object('status','failed','checks',checks,'error',sqlerrm,'code',sqlstate);
 end;
 select count(*) into after_count from app.activities;
 result := result || jsonb_build_object('checkedAt',clock_timestamp(),'rolledBack',true,
  'fixtureAbsent',not exists(select 1 from app.activities where id=fixture_id),
  'activityCountBefore',before_count,'activityCountAfter',after_count,
  'migration',(select max(version) from supabase_migrations.schema_migrations));
 perform set_config('aulify.ap28_remote_result',result::text,true);
end $verify$;
select current_setting('aulify.ap28_remote_result')::jsonb as verification;
