-- Diagnóstico con fixture ficticio existente. Reversión incondicional de cada muestra.
-- Sin HTTP ni concurrencia; no demuestra por sí solo capacidad.
do $profile$
declare a uuid; m uuid; u uuid; p uuid; t uuid; before_at timestamptz; marks jsonb; samples jsonb:='[]'; i int;
begin
 select ac.id,mm.id,mm.student_id into a,m,u
 from app.activities ac join app.memberships mm on mm.subject_id=ac.subject_id
 where ac.title='Carga individual · measurement · 24930805' and mm.status='approved'
 and not exists(select 1 from app.participants pa where pa.activity_id=ac.id and pa.membership_id=mm.id)
 order by ac.id,mm.id limit 1;
 if a is null then raise exception 'Missing isolated fixture'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 for i in 1..12 loop
  marks:=jsonb_build_object('sample',i);
  begin
   before_at:=clock_timestamp();
   perform app.require_student((select subject_id from app.activities where id=a));
   marks:=marks||jsonb_build_object('membership_ms',extract(epoch from clock_timestamp()-before_at)*1000);
   before_at:=clock_timestamp();p:=app.ensure_participant(a,m);
   marks:=marks||jsonb_build_object('participant_ms',extract(epoch from clock_timestamp()-before_at)*1000);
   before_at:=clock_timestamp();t:=app.begin_attempt(a,p);
   marks:=marks||jsonb_build_object('attempt_ms',extract(epoch from clock_timestamp()-before_at)*1000);
   before_at:=clock_timestamp();perform app.attempt_json(t);
   marks:=marks||jsonb_build_object('serialization_ms',extract(epoch from clock_timestamp()-before_at)*1000);
   before_at:=clock_timestamp();set constraints all immediate;
   marks:=marks||jsonb_build_object('deferred_ms',extract(epoch from clock_timestamp()-before_at)*1000);
   raise exception using errcode='P0002',message='PROFILE_ROLLBACK';
  exception when no_data_found then
   if sqlerrm<>'PROFILE_ROLLBACK' then raise; end if;
   samples:=samples||jsonb_build_array(marks);
  end;
 end loop;
 perform set_config('aulify.profile_result',jsonb_build_object('activity',a,'samples',samples,'rollback',true)::text,true);
end $profile$;
select current_setting('aulify.profile_result')::jsonb as diagnostic;
