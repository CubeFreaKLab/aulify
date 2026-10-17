-- Una revisión sólo describe la proyección cuando no cambió durante su lectura.
-- El cliente conserva este testigo para evitar descargar de nuevo el mismo estado.
-- No es una caché de autorización: el sondeo sigue comprobando acceso y plazos.
create or replace function public.aulify_activity_snapshot(p_activity_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
set plan_cache_mode='force_generic_plan' as $$
declare before_revision text; after_revision text; projection jsonb;
begin
 before_revision:=app.activity_sync(p_activity_id)->>'revision';
 projection:=app.activity_snapshot(p_activity_id);
 set constraints app.aulify_sync_revision immediate;
 after_revision:=app.activity_sync(p_activity_id)->>'revision';
 set constraints app.aulify_sync_revision deferred;
 if before_revision=after_revision then
  projection:=projection||jsonb_build_object('activitySync',jsonb_build_object(
   'activityId',p_activity_id,'revision',after_revision));
 end if;
 return projection;
end $$;

-- CREATE OR REPLACE conserva dueño y ACL. Sólo authenticated puede invocarla,
-- como antes; app.activity_sync y app.activity_snapshot mantienen sus controles.
