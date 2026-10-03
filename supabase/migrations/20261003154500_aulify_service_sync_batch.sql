-- Transporte interno: el servidor aporta identidades previamente verificadas.
-- Cada elemento conserva los controles y la huella de app.activity_sync.
create function public.aulify_service_sync_batch(p_requests jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.aulify_service_sync_batch(jsonb) from public,anon,authenticated;
grant execute on function public.aulify_service_sync_batch(jsonb) to service_role;
