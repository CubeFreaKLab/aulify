-- Keep HTTPS-only web links and the existing image/file and private-key guards.
-- No existing draft or published version is rewritten.
create function app.assert_editor_href(value jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare href text; code integer; position integer;
begin
 if jsonb_typeof(value) is distinct from 'string' then raise exception 'INVALID_EDITOR_LINK'; end if;
 href:=value#>>'{}';
 if char_length(href)>8192 or href !~* '^https://[^/?#]+([/?#].*)?$' then
  raise exception 'INVALID_EDITOR_LINK';
 end if;
 for position in 1..char_length(href) loop
  code:=ascii(substr(href,position,1));
  if code<=32 or code=127 or code between 8192 and 8202
    or code=any(array[133,160,5760,8232,8233,8239,8287,12288,65279]) then
   raise exception 'INVALID_EDITOR_LINK';
  end if;
 end loop;
end $$;

create or replace function app.assert_editor(value jsonb,depth int default 0)
returns void language plpgsql set search_path='' as $$
declare x record;
begin
 if depth>30 then raise exception 'EDITOR_DEPTH_LIMIT'; end if;
 if jsonb_typeof(value)='object' then
  for x in select * from jsonb_each(value) loop
   if x.key in ('correctOptionId','correctOptionIds','correctOrder','correct','pairs','manualGuide','explanation','hint','solutions','expected_position') then
    raise exception 'PRIVATE_EDITOR_CONTENT: Las soluciones no pertenecen al documento visible.';
   end if;
   if x.key='href' then
    perform app.assert_editor_href(x.value);
   elsif x.key in ('url','src') and jsonb_typeof(x.value)='string' and x.value#>>'{}' !~ '^(https://|/api/files/|#)' then
    raise exception 'INVALID_EDITOR_URL';
   end if;
   perform app.assert_editor(x.value,depth+1);
  end loop;
 elsif jsonb_typeof(value)='array' then
  for x in select v from jsonb_array_elements(value) v loop
   perform app.assert_editor(x.v,depth+1);
  end loop;
 end if;
end $$;

create function app.check_version_editor_links() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.editor_document is not null then
  if jsonb_typeof(new.editor_document)<>'array' or jsonb_array_length(new.editor_document)>200 then
   raise exception 'INVALID_EDITOR_DOCUMENT';
  end if;
  perform app.assert_editor(new.editor_document);
 end if;
 return new;
end $$;

revoke all on function app.assert_editor_href(jsonb) from public,anon,authenticated;
revoke all on function app.check_version_editor_links() from public,anon,authenticated;

create trigger validate_version_editor_links
before insert on app.resource_versions
for each row execute function app.check_version_editor_links();
