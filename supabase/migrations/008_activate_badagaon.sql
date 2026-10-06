-- Activate Badagaon using the existing Vinay Nagar menu and independent stock IDs.
begin;
do $$
declare
  source_id uuid;
  target_id uuid;
  source_row record;
  category_id uuid;
  item_id uuid;
  group_id uuid;
  new_id uuid;
begin
  select id into source_id from outlets where slug = 'burger-budds-vinay-nagar-gwalior';
  select id into target_id from outlets where slug = 'burger-budds-badagaon-gwalior';
  if source_id is null or target_id is null then raise exception 'Apply outlet migrations first'; end if;
  for source_row in select * from categories where outlet_id = source_id loop
    new_id := md5('badagaon:' || source_row.id::text)::uuid;
    insert into categories select (jsonb_populate_record(null::categories, to_jsonb(source_row) || jsonb_build_object('id', new_id, 'outlet_id', target_id, 'parent_id', case when source_row.parent_id is null then null else md5('badagaon:' || source_row.parent_id::text)::uuid end))).* on conflict (id) do nothing;
  end loop;
  for source_row in select * from items where outlet_id = source_id loop
    new_id := md5('badagaon:' || source_row.id::text)::uuid;
    category_id := md5('badagaon:' || source_row.category_id::text)::uuid;
    insert into items select (jsonb_populate_record(null::items, to_jsonb(source_row) || jsonb_build_object('id', new_id, 'outlet_id', target_id, 'category_id', category_id))).* on conflict (id) do nothing;
  end loop;
  for source_row in select v.* from item_variants v join items i on i.id=v.item_id where i.outlet_id=source_id loop
    new_id := md5('badagaon:' || source_row.id::text)::uuid;
    item_id := md5('badagaon:' || source_row.item_id::text)::uuid;
    insert into item_variants select (jsonb_populate_record(null::item_variants, to_jsonb(source_row) || jsonb_build_object('id', new_id, 'item_id', item_id))).* on conflict (id) do nothing;
  end loop;
  for source_row in select g.* from addon_groups g join items i on i.id=g.item_id where i.outlet_id=source_id loop
    new_id := md5('badagaon:' || source_row.id::text)::uuid;
    item_id := md5('badagaon:' || source_row.item_id::text)::uuid;
    insert into addon_groups select (jsonb_populate_record(null::addon_groups, to_jsonb(source_row) || jsonb_build_object('id', new_id, 'item_id', item_id))).* on conflict (id) do nothing;
  end loop;
  for source_row in select a.* from addons a join addon_groups g on g.id=a.group_id join items i on i.id=g.item_id where i.outlet_id=source_id loop
    new_id := md5('badagaon:' || source_row.id::text)::uuid;
    group_id := md5('badagaon:' || source_row.group_id::text)::uuid;
    insert into addons select (jsonb_populate_record(null::addons, to_jsonb(source_row) || jsonb_build_object('id', new_id, 'group_id', group_id))).* on conflict (id) do nothing;
  end loop;
  update outlets set is_open=true, delivery_enabled=true, is_active=true, pause_until=null where id=target_id;
end;
$$;
commit;
