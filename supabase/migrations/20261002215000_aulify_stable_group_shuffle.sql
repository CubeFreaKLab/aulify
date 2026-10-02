-- Cada grupo dependiente recibe una sola clave aleatoria antes de unir sus preguntas.
-- La materialización impide que el planificador evalúe random() por cada pregunta.
create or replace function app.begin_attempt(a uuid,p uuid,req uuid default gen_random_uuid()) returns uuid language plpgsql security definer set search_path='' as $$
declare x app.activities; q app.quiz_settings; t uuid; total int; v uuid;
begin
 select * into x from app.activities where id=a for update; select * into q from app.quiz_settings where activity_id=a;
 perform 1 from app.participants where id=p and activity_id=a for update;
 if not found then raise exception 'INVALID_PARTICIPANT'; end if;
 select id into t from app.attempts where participant_id=p and closed_at is null;
 if t is not null then if app.deadline(a,p,(select started_at from app.attempts where id=t))>now() then return t; else perform app.close_attempt(t,'deadline'); end if; end if;
 if x.published_at is null or now()<x.opens_at or now()>=app.deadline(a) then raise exception 'ACTIVITY_CLOSED'; end if;
 select count(*) into total from app.attempts where participant_id=p;
 if total>=q.attempt_limit then raise exception 'ATTEMPTS_EXHAUSTED'; end if;
 if q.teams_enabled and (not exists(select 1 from app.team_members where participant_id=p) or exists(select 1 from app.teams where activity_id=a and id not in(select team_id from app.team_members))) then raise exception 'TEAMS_REQUIRED'; end if;
 update app.activities set locked_at=coalesce(locked_at,now()) where id=a;
 insert into app.attempts(participant_id,attempt_no,request_key) values(p,total+1,req) returning id into t;
 with groups_order as materialized (
  select g.*,case when q.shuffle_groups then random() else g.position::float end sort
  from app.question_groups g where version_id=x.version_id
 )
 insert into app.attempt_questions(attempt_id,version_id,question_key,position,item_order)
 select t,qu.version_id,qu.question_key,row_number() over(order by gp.sort,gp.position,qu.position),jsonb_build_object('items',coalesce((select jsonb_agg(i.item_key order by case when q.shuffle_options or qu.kind='order' then random() else i.position::float end) from app.question_items i where i.version_id=qu.version_id and i.question_key=qu.question_key),'[]'::jsonb))
 from app.questions qu join groups_order gp using(version_id,group_key) where qu.version_id=x.version_id;
 return t;
end $$;

-- CREATE OR REPLACE conserva propietario y ACL; el helper no se expone como RPC.
