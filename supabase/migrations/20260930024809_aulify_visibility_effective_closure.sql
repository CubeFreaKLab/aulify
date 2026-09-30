-- IN-06: conservar señales treinta días desde el cierre efectivo de actividad.
-- El envío individual no cierra la actividad; el cierre guiado sí puede
-- anticiparse al vencimiento general, incluidas sus ampliaciones.
do $migration$
declare
 definition text := pg_get_functiondef('app.maintenance(text,jsonb)'::regprocedure);
 previous text := 'and app.deadline(p.activity_id)+interval ''30 days''<=now();';
 replacement text := 'and least(app.deadline(p.activity_id),(select gs.closed_at from app.guided_sessions gs where gs.activity_id=p.activity_id))+interval ''30 days''<=now();';
begin
 if (length(definition)-length(replace(definition,previous,'')))/length(previous) <> 1 then
  raise exception 'MAINTENANCE_RETENTION_DEFINITION_MISMATCH';
 end if;
 -- CREATE OR REPLACE conserva propietario y permisos; no ejecuta la limpieza.
 execute replace(definition,previous,replacement);
end
$migration$;
