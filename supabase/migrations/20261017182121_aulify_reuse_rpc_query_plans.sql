-- Las consultas de estos endpoints se repiten con identidades e IDs distintos.
-- Reutilizar el plan evita su preparación repetida; los parámetros, los datos
-- y los permisos se evalúan de nuevo en cada ejecución. No es una caché de datos.
-- El ajuste dura solo dentro de la función y conserva search_path, dueño y ACL.
alter function public.aulify_command(text,jsonb)
 set plan_cache_mode='force_generic_plan';
alter function public.aulify_activity_snapshot(uuid)
 set plan_cache_mode='force_generic_plan';
alter function public.aulify_workspace_overview()
 set plan_cache_mode='force_generic_plan';
alter function public.aulify_service_sync_batch(jsonb)
 set plan_cache_mode='force_generic_plan';
