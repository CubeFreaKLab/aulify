-- Reutiliza la única proyección estudiantil de preguntas al construir los bloques.
-- No modifica autorización, plazos, elección de intento ni contrato de salida.
create or replace function app.student_activity(a uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 x app.activities;
 m uuid;
 p uuid;
 t uuid;
 v jsonb;
 q jsonb;
begin
 select * into x from app.activities where id=a;
 m:=app.require_student(x.subject_id);
 if x.published_at is null then raise exception 'ACTIVITY_UNAVAILABLE'; end if;
 select id into p from app.participants where activity_id=a and membership_id=m;
 for t in
  select at.id from app.attempts at
  where at.participant_id=p and at.closed_at is null
   and app.deadline(a,p,at.started_at)<=now()
 loop
  perform app.close_attempt(t,'deadline');
 end loop;
 select id into t from app.attempts where participant_id=p order by attempt_no desc limit 1;

 select coalesce(jsonb_agg(z.question order by coalesce(aq.position,g.position*1000+qu.position)),'[]'::jsonb)
 into q
 from app.questions qu
 join app.question_groups g using(version_id,group_key)
 left join app.attempt_questions aq
  on aq.version_id=qu.version_id and aq.question_key=qu.question_key and aq.attempt_id=t
 cross join lateral(select app.present_question(qu.version_id,qu.question_key,t) question) z
 where qu.version_id=x.version_id;

 -- version_json construía question_json(false) antes de reemplazar esas preguntas
 -- con q. Aquí se mantienen los mismos merges y el orden, sin esa primera pasada.
 select case when projected.blocks is null then null else
  jsonb_build_object('title',rv.title,'editorDocument',rv.editor_document,'blocks',projected.blocks)
 end into v
 from app.resource_versions rv
 join app.resources r on r.id=rv.resource_id
 cross join lateral (
  select jsonb_agg(
   b.body||jsonb_build_object('id',b.block_key,'type',case b.kind when 'video_link' then 'video' else b.kind end)
   ||case
    when b.kind='quiz' then jsonb_build_object('questions',case
     when jsonb_typeof(b.body)='object' then q
     -- El esquema admite cuerpos JSON no objeto. En ese caso, || genera un
     -- array y el legado no reemplazaba sus preguntas: se conserva esa forma.
     else (select jsonb_agg(app.question_json(rv.id,qu.question_key,false) order by g.position,qu.position)
      from app.questions qu join app.question_groups g using(version_id,group_key)
      where qu.version_id=rv.id)
    end)
    when b.kind='video_link' then jsonb_build_object('url',b.external_url)
    when b.kind='image' then jsonb_build_object('fileId',b.file_id,'url','/api/files/'||b.file_id::text,'alt',b.alt_text)
    else '{}'::jsonb
   end order by b.position
  ) blocks
  from app.content_blocks b where b.version_id=rv.id
 ) projected
 where rv.id=x.version_id;
 -- Con cero bloques, la reescritura anterior devolvía SQL NULL para v entero.
 -- Se conserva ese comportamiento: title, blocks y editorDocument son JSON null.

 return jsonb_build_object(
  'activity',app.activity_json(a),'title',v->>'title','blocks',v->'blocks',
  'editorDocument',v->'editorDocument','questions',q,
  'attempt',case when t is null then null else app.attempt_json(t) end,
  'attemptsRemaining',greatest(0,(select attempt_limit from app.quiz_settings where activity_id=a)
   -(select count(*) from app.attempts where participant_id=p)),
  'hintUsed',exists(select 1 from app.powerup_uses where participant_id=p and kind='hint'),
  'doubleUsed',exists(select 1 from app.powerup_uses where participant_id=p and kind='double')
 );
end $$;
