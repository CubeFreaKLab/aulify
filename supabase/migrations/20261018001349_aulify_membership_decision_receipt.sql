-- Reintentar una aprobación devuelve la misma membresía que la primera llamada.
-- No vuelve a aprobar una inscripción retirada ni agrega eventos de aprobación.
do $migration$
declare
 definition text := pg_get_functiondef('app.command(text,jsonb)'::regprocedure);
 original text := $old$if rec.status<>'pending' then return jsonb_build_object('id',id,'status',rec.status); end if;$old$;
 replacement text := $new$if rec.status<>'pending' then
  if rec.status='approved' then
   select mm.id into m from app.memberships mm
    where mm.subject_id=rec.subject_id and mm.student_id=rec.student_id;
  end if;
  return jsonb_build_object('id',coalesce(m,id),'status',rec.status);
 end if;$new$;
 permissions_before jsonb;
 permissions_after jsonb;
begin
 if (length(definition)-length(replace(definition,original,''))) / length(original) <> 1 then
  raise exception 'La rama de aprobación no coincide con la definición esperada.';
 end if;
 select jsonb_build_array(proowner,proacl,prosecdef,proconfig) into permissions_before
  from pg_proc where oid='app.command(text,jsonb)'::regprocedure;
 execute replace(definition,original,replacement);
 select jsonb_build_array(proowner,proacl,prosecdef,proconfig) into permissions_after
  from pg_proc where oid='app.command(text,jsonb)'::regprocedure;
 if permissions_before is distinct from permissions_after then
  raise exception 'La corrección no debe cambiar dueño, permisos ni configuración.';
 end if;
end $migration$;
