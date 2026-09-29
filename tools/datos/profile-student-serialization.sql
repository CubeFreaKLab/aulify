-- Prototipo aislado, no migración: reutilizar preguntas ya filtradas en una llamada.
create function app.profile_version_questions(v uuid, questions jsonb) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',x.id,'resourceId',x.resource_id,'ownerId',r.owner_id,'number',x.version_no,'title',x.title,'publishedAt',x.published_at,'editorDocument',x.editor_document,'blocks',coalesce((select jsonb_agg(b.body||jsonb_build_object('id',b.block_key,'type',case b.kind when 'video_link' then 'video' else b.kind end)||case when b.kind='quiz' then jsonb_build_object('questions',questions) when b.kind='video_link' then jsonb_build_object('url',b.external_url) when b.kind='image' then jsonb_build_object('fileId',b.file_id,'url','/api/files/'||b.file_id::text,'alt',b.alt_text) else '{}'::jsonb end order by b.position) from app.content_blocks b where b.version_id=v),'[]'::jsonb)) from app.resource_versions x join app.resources r on r.id=x.resource_id where x.id=v;
$$;
revoke all on function app.profile_version_questions(uuid,jsonb) from public,anon,authenticated;

create or replace function app.student_activity(a uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare x app.activities; m uuid; p uuid; t uuid; v jsonb; q jsonb; ord jsonb;
begin
 select * into x from app.activities where id=a; m:=app.require_student(x.subject_id);
 if x.published_at is null then raise exception 'ACTIVITY_UNAVAILABLE'; end if;
 select id into p from app.participants where activity_id=a and membership_id=m;
 for t in select at.id from app.attempts at where at.participant_id=p and at.closed_at is null and app.deadline(a,p,at.started_at)<=now() loop perform app.close_attempt(t,'deadline'); end loop;
 select id into t from app.attempts where participant_id=p order by attempt_no desc limit 1;
 select coalesce(jsonb_agg(z.question order by coalesce(aq.position,g.position*1000+qu.position)),'[]'::jsonb) into q from app.questions qu join app.question_groups g using(version_id,group_key) left join app.attempt_questions aq on aq.version_id=qu.version_id and aq.question_key=qu.question_key and aq.attempt_id=t cross join lateral(select app.present_question(qu.version_id,qu.question_key,t) question) z where qu.version_id=x.version_id;
 v:=app.profile_version_questions(x.version_id,q);
 select jsonb_set(v,'{blocks}',jsonb_agg(case when b->>'type'='quiz' then jsonb_set(b,'{questions}',q) else b end order by n)) into v from jsonb_array_elements(v->'blocks') with ordinality z(b,n);
 return jsonb_build_object('activity',app.activity_json(a),'title',v->>'title','blocks',v->'blocks','editorDocument',v->'editorDocument','questions',q,'attempt',case when t is null then null else app.attempt_json(t) end,'attemptsRemaining',greatest(0,(select attempt_limit from app.quiz_settings where activity_id=a)-(select count(*) from app.attempts where participant_id=p)),'hintUsed',exists(select 1 from app.powerup_uses where participant_id=p and kind='hint'),'doubleUsed',exists(select 1 from app.powerup_uses where participant_id=p and kind='double'));
end $$;
