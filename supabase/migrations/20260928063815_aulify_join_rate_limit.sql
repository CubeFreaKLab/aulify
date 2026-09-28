-- Relación técnica adicional: intentos de código, también los inválidos.
-- No almacena el código ni datos de navegación. Retención máxima: diez minutos.
create table app.join_request_checks (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references app.profiles(id) on delete cascade,
 checked_at timestamptz not null default now()
);
create index join_checks_window on app.join_request_checks(profile_id,checked_at);
alter table app.join_request_checks enable row level security;
revoke all on app.join_request_checks from public,anon,authenticated;
grant all on app.join_request_checks to service_role;
create function app.consume_join_check(u uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform 1 from app.profiles where id=u for update;
 delete from app.join_request_checks where checked_at<=now()-interval '10 minutes';
 if (select count(*) from app.join_request_checks where profile_id=u)>=10 then return false; end if;
 insert into app.join_request_checks(profile_id) values(u); return true;
end $$;
revoke all on function app.consume_join_check(uuid) from public,anon,authenticated;
