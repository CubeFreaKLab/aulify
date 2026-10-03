-- La respuesta confirmada ya contiene el intento persistido. Vincular esa
-- proyección con su revisión evita volver a descargarla por el mismo cambio.
create or replace function public.aulify_command(p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; revision text;
begin
 result:=app.command(p_action,p_payload);
 if p_action='submitAnswer' then
  -- Vaciar exclusivamente las marcas derivadas, sin adelantar otras
  -- restricciones de dominio. PostgREST confirma la transacción antes del ACK.
  set constraints app.aulify_sync_revision immediate;
  revision:=app.activity_sync((result->'attempt'->>'activityId')::uuid)->>'revision';
  set constraints app.aulify_sync_revision deferred;
  result:=result||jsonb_build_object('syncRevision',revision);
 end if;
 return result;
end $$;

revoke all on function public.aulify_command(text,jsonb) from public,anon;
grant execute on function public.aulify_command(text,jsonb) to authenticated;
