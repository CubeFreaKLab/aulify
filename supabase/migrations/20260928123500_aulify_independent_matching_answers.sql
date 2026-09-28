-- Cada par enviado se puntúa de forma independiente. Una elección equivocada
-- puede repetir destino; todas las claves y destinos deben pertenecer a la pregunta.
-- No modifica soluciones, resultados anteriores ni permisos.
create or replace function app.score_answer(aq uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q app.questions; v uuid; k uuid; n int:=0; c int:=0; total int:=1; got jsonb; expected jsonb; valid boolean:=true; force_manual boolean;
begin
 select x.version_id,x.question_key into v,k from app.attempt_questions x where x.id=aq;
 select * into q from app.questions where version_id=v and question_key=k;
 if payload->>'type'<>app.question_json(v,k)->>'type' then raise exception 'ANSWER_TYPE'; end if;
 if octet_length(payload::text)>60000 then raise exception 'ANSWER_LIMIT'; end if;
 if q.kind='single' then
  valid:=exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=(payload->>'optionId')::uuid);
  select count(*) into c from app.item_solutions where version_id=v and question_key=k and is_correct and item_key=(payload->>'optionId')::uuid;
 elsif q.kind='multiple' then
  select count(*),count(distinct value) into n,c from jsonb_array_elements_text(payload->'optionIds');
  valid:=n>0 and n=c and n=(select count(*) from app.question_items where version_id=v and question_key=k and item_key::text in(select jsonb_array_elements_text(payload->'optionIds')));
  select jsonb_agg(value order by value) into got from jsonb_array_elements_text(payload->'optionIds');
  select jsonb_agg(item_key::text order by item_key::text) into expected from app.item_solutions where version_id=v and question_key=k and is_correct; c:=case when got=expected then 1 else 0 end;
 elsif q.kind='boolean' then
  valid:=jsonb_typeof(payload->'value')='boolean'; select count(*) into c from app.item_solutions s join app.question_items i using(version_id,question_key,item_key) where s.version_id=v and s.question_key=k and s.is_correct and i.label=payload->>'value';
 elsif q.kind='match' then
  select count(*) into total from app.question_items where version_id=v and question_key=k and kind='left';
  select count(*) into n from jsonb_each_text(payload->'pairs'); valid:=n=total;
  valid:=valid and not exists(select 1 from jsonb_each_text(payload->'pairs') p where not exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=p.key::uuid and kind='left') or not exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=p.value::uuid and kind='right'));
  select count(*) into c from app.item_solutions where version_id=v and question_key=k and target_item_key::text=payload->'pairs'->>item_key::text;
 elsif q.kind='order' then
  select count(*) into total from app.question_items where version_id=v and question_key=k;
  select count(*),count(distinct value) into n,c from jsonb_array_elements_text(payload->'itemIds'); valid:=n=total and c=total and n=(select count(*) from app.question_items where version_id=v and question_key=k and item_key::text in(select jsonb_array_elements_text(payload->'itemIds')));
  select count(*) into c from app.item_solutions where version_id=v and question_key=k and item_key::text=payload->'itemIds'->>(expected_position-1);
 elsif q.kind in ('gap_choice','gap_text') then
  got:=case q.kind when 'gap_choice' then payload->'choices' else payload->'texts' end;
  select count(*) into total from app.question_items where version_id=v and question_key=k and kind='gap'; select count(*) into n from jsonb_each_text(got); valid:=n=total;
  valid:=valid and not exists(select 1 from jsonb_each_text(got) p where not exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=p.key::uuid and kind='gap') or case when q.kind='gap_choice' then not exists(select 1 from app.question_items where version_id=v and question_key=k and item_key=p.value::uuid and parent_item_key=p.key::uuid) else length(trim(p.value)) not between 1 and 5000 end);
  if q.kind='gap_choice' then select count(*) into c from app.item_solutions where version_id=v and question_key=k and target_item_key::text=got->>item_key::text; end if;
 elsif q.kind='open' then valid:=jsonb_typeof(payload->'text')='string' and length(trim(payload->>'text')) between 1 and 5000;
 end if;
 if valid is not true then raise exception 'INVALID_ANSWER'; end if;
 select z.manual_closed_questions into force_manual from app.attempt_questions w join app.attempts t on t.id=w.attempt_id join app.participants p on p.id=t.participant_id join app.quiz_settings z on z.activity_id=p.activity_id where w.id=aq;
 if q.correction_mode='manual' or force_manual then return null; end if;
 return jsonb_build_object('numerator',q.max_points*100*c,'denominator',100*total);
end $$;
