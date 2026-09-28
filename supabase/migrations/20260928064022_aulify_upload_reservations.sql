alter table app.file_objects add column upload_purpose varchar(16) not null default 'submission' check(upload_purpose in ('resource','submission'));
alter table app.file_objects add column upload_expires_at timestamptz not null default now()+interval '24 hours';
create index upload_rate on app.file_objects(owner_id,created_at);
create function app.reserve_upload(p_owner uuid,p_id uuid,p_name text,p_purpose text,p_size bigint,p_mime text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f app.file_objects; begin
 perform 1 from app.profiles where id=p_owner for update;
 if not found or not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null) then raise exception 'AUTH_REQUIRED'; end if;
 if p_purpose not in ('resource','submission') or p_name ~ '[/\\]' or length(trim(p_name)) not between 1 and 255 or p_size<=0 or p_size>10485760 then raise exception 'INVALID_UPLOAD'; end if;
 if p_purpose='resource' and (p_size>5242880 or p_mime not in ('image/jpeg','image/png','image/webp') or not exists(select 1 from app.profiles where id=p_owner and role='teacher')) then raise exception 'INVALID_RESOURCE_IMAGE'; end if;
 if p_mime not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp') then raise exception 'INVALID_MIME'; end if;
 select * into f from app.file_objects where id=p_id;
 if f.id is not null then
  if f.owner_id<>p_owner or f.state<>'pending' or f.original_name<>p_name or f.byte_size<>p_size or f.mime_type<>p_mime or f.upload_purpose<>p_purpose or f.upload_expires_at<=now() then raise exception 'UPLOAD_CONFLICT'; end if;
  return jsonb_build_object('id',f.id,'bucket',f.bucket,'path',f.object_path,'expiresAt',f.upload_expires_at);
 end if;
 if (select count(*) from app.file_objects where owner_id=p_owner and created_at>now()-interval '1 minute')>=20 then raise exception 'UPLOAD_RATE_LIMIT'; end if;
 insert into app.file_objects(id,owner_id,bucket,object_path,original_name,mime_type,byte_size,state,upload_purpose) values(p_id,p_owner,'aulify-files',p_owner::text||'/'||p_id::text,p_name,p_mime,p_size,'pending',p_purpose) returning * into f;
 return jsonb_build_object('id',f.id,'bucket',f.bucket,'path',f.object_path,'expiresAt',f.upload_expires_at);
end $$;
create or replace function app.register_file(p_owner uuid,p_id uuid,p_name text,p_mime text,p_size bigint,p_sha256 text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f app.file_objects; begin
 if p_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_FILE_HASH'; end if;
 select * into f from app.file_objects where id=p_id for update;
 if f.id is null or f.owner_id<>p_owner or f.original_name<>p_name or f.byte_size<>p_size or f.mime_type<>p_mime or f.state='delete_pending' then raise exception 'UPLOAD_NOT_RESERVED'; end if;
 if f.state='ready' then if f.sha256<>p_sha256 then raise exception 'UPLOAD_CONFLICT'; end if; else
  if f.upload_expires_at<=now() or not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null) then raise exception 'UPLOAD_EXPIRED'; end if;
  if not exists(select 1 from storage.objects where bucket_id=f.bucket and name=f.object_path and (metadata->>'size')::bigint=p_size) then raise exception 'UPLOAD_NOT_FOUND'; end if;
  update app.file_objects set state='ready',sha256=p_sha256,validated_at=now() where id=p_id;
 end if;
 return jsonb_build_object('id',p_id,'name',p_name,'size',p_size,'mimeType',p_mime);
end $$;
create function public.aulify_reserve_upload(p_owner uuid,p_id uuid,p_name text,p_purpose text,p_size bigint,p_mime text) returns jsonb language sql security invoker set search_path='' as $$ select app.reserve_upload(p_owner,p_id,p_name,p_purpose,p_size,p_mime); $$;
revoke all on function app.reserve_upload(uuid,uuid,text,text,bigint,text),public.aulify_reserve_upload(uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function app.reserve_upload(uuid,uuid,text,text,bigint,text),public.aulify_reserve_upload(uuid,uuid,text,text,bigint,text) to service_role;
