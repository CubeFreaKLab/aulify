-- Diagnóstico de solo lectura. Ejecutar una vez desde el SQL Editor autorizado.
-- 160 muestras separadas por al menos 100 ms (~16 s más el costo de observar).
-- No modifica funciones, tablas, roles ni estadísticas acumuladas.
-- No devuelve PID, usuario, dirección, UUID ni texto SQL de ninguna sesión.
with recursive samples(n, observed_at, summary) as (
 select 0, clock_timestamp(), null::jsonb
 union all
 select previous.n+1, clock_timestamp(), observation.summary
 from samples previous
 cross join lateral (
  select pg_sleep(0.1) slept where previous.n>=0
 ) pause
 cross join lateral (
  select pg_stat_clear_snapshot() cleared where pause.slept::text is not null
 ) fresh
 cross join lateral (
  with activity as materialized (
   select a.pid,a.state,a.wait_event_type,a.wait_event,a.query_start,
    case
     when a.query ilike '%aulify_command%' then 'command'
     when a.query ilike '%aulify_activity_snapshot%' then 'activity_snapshot'
     when a.query ilike '%aulify_sync%' then 'sync'
     when a.query ilike '%aulify_snapshot%' then 'workspace_snapshot'
     else 'other'
    end rpc,
    case when a.state='active' then cardinality(pg_blocking_pids(a.pid)) else 0 end blocker_count
   -- El argumento depende de fresh para leer actividad después de limpiar
   -- la instantánea. La salida void convertida a texto tiene longitud cero.
   from pg_stat_get_activity(nullif(length(fresh.cleared::text),0)) a
   where a.datid=(select oid from pg_database where datname=current_database())
    and a.pid<>pg_backend_pid() and a.backend_type='client backend'
  ), counter_locks as materialized (
   select l.pid,l.mode,l.granted,l.locktype
   from pg_locks l
   where l.relation='app.activity_sync_versions'::regclass
    and l.database=(select oid from pg_database where datname=current_database())
    and fresh.cleared::text is not null
  )
  select jsonb_build_object(
   'sessions',coalesce((select jsonb_agg(to_jsonb(g)) from (
    select rpc,coalesce(state,'unknown') state,
     coalesce(wait_event_type,'none') wait_type,coalesce(wait_event,'none') wait_event,
     count(*) sessions,count(*) filter(where blocker_count>0) blocked,
     count(*) filter(where state='active' and wait_event_type is null) active_without_wait,
     round(max(extract(epoch from(clock_timestamp()-query_start))*1000)
      filter(where state='active'),2) longest_active_ms
    from activity group by rpc,state,wait_event_type,wait_event
   ) g),'[]'::jsonb),
   'counter_relation_locks',coalesce((select jsonb_agg(to_jsonb(g)) from (
    select locktype,mode,granted,count(*) locks from counter_locks group by locktype,mode,granted
   ) g),'[]'::jsonb),
   'commands_with_counter_write_lock',(
    select jsonb_build_object('active',count(*),
     'blocked',count(*) filter(where a.blocker_count>0),
     'transactionid_wait',count(*) filter(where a.wait_event_type='Lock' and a.wait_event='transactionid'),
     'tuple_wait',count(*) filter(where a.wait_event_type='Lock' and a.wait_event='tuple'),
     'active_without_wait',count(*) filter(where a.wait_event_type is null))
    from activity a where a.rpc='command' and a.state='active'
     and exists(select 1 from counter_locks l where l.pid=a.pid and l.mode='RowExclusiveLock' and l.granted)
   )
  ) summary
 ) observation
 where previous.n<160
)
select jsonb_build_object(
 'scope','Instantáneas agregadas de actividad y bloqueos; active_without_wait no mide CPU directamente',
 'requested_samples',160,'minimum_interval_ms',100,
 'actual_samples',count(*),'started_at',min(observed_at),'ended_at',max(observed_at),
 'samples',jsonb_agg(jsonb_build_object('sample',n,'at',observed_at,'data',summary) order by n)
) diagnostic
from samples where n>0;
