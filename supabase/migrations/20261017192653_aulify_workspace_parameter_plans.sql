-- El resumen mezcla ámbitos docentes y estudiantiles de tamaños muy distintos.
-- Planificar sus consultas con los parámetros actuales evita aplicar a un alumno
-- el mismo cálculo de cardinalidad que a un historial docente completo.
do $migration$
declare function_body text; signature text; old_fragment text; new_fragment text;
begin
 select prosrc into strict function_body from pg_proc
 where oid='app.workspace_attempts_json(uuid,uuid[],uuid[])'::regprocedure;
 old_fragment:='from base b left join answers ans';
 new_fragment:='into result from base b left join answers ans';
 if strpos(function_body,old_fragment)=0 then raise exception 'ATTEMPT_HISTORY_DEFINITION_CHANGED'; end if;
 function_body:=replace(function_body,old_fragment,new_fragment);
 execute format($definition$
  create or replace function app.workspace_attempts_json(u uuid,owned_subjects uuid[],visible_subjects uuid[])
  returns jsonb language plpgsql stable security definer
  set search_path='' set plan_cache_mode='force_custom_plan' as %L
 $definition$,'declare result jsonb; begin '||function_body||' return result; end');

 select prosrc into strict function_body from pg_proc
 where oid='app.workspace_evaluations_json(uuid,uuid[],uuid[],boolean)'::regprocedure;
 old_fragment:='from base b left join revisions r';
 new_fragment:='into result from base b left join revisions r';
 if strpos(function_body,old_fragment)=0 then raise exception 'EVALUATION_HISTORY_DEFINITION_CHANGED'; end if;
 function_body:=replace(function_body,old_fragment,new_fragment);
 execute format($definition$
  create or replace function app.workspace_evaluations_json(u uuid,owned_subjects uuid[],visible_subjects uuid[],draft boolean)
  returns jsonb language plpgsql stable security definer
  set search_path='' set plan_cache_mode='force_custom_plan' as %L
 $definition$,'declare result jsonb; begin '||function_body||' return result; end');
end $migration$;
alter function public.aulify_workspace_overview() set plan_cache_mode='force_custom_plan';
alter function app.student_results(uuid) set plan_cache_mode='force_custom_plan';
-- CREATE OR REPLACE conserva propietarios y ACL; no se exponen los helpers.
