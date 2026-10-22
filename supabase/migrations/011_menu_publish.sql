begin;
create or replace function public.publish_menu_item(target_item uuid,target_outlets uuid[] default null) returns integer language plpgsql security definer set search_path=public as $$
declare m public.menu_items; o public.outlets; c uuid; legacy uuid; n integer:=0;
begin
 select * into strict m from public.menu_items where id=target_item;
 for o in select * from public.outlets where is_active and (target_outlets is null or id=any(target_outlets)) loop
 select id into c from public.categories where outlet_id=o.id and name=m.category_name limit 1;
 if c is null then insert into public.categories(outlet_id,name) values(o.id,m.category_name) returning id into c; end if;
 select legacy_item_id into legacy from public.outlet_menu_items where outlet_id=o.id and item_id=m.id;
 if legacy is null then
 insert into public.items(outlet_id,category_id,name,description,price,diet,image_url) values(o.id,c,m.name,m.description,m.price,m.diet,m.image_url) returning id into legacy;
 insert into public.outlet_menu_items(outlet_id,item_id,legacy_item_id) values(o.id,m.id,legacy);
 else update public.items set name=m.name,description=m.description,category_id=c where id=legacy; end if;
 n:=n+1;
 end loop; return n;
end; $$;
revoke all on function public.publish_menu_item(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.publish_menu_item(uuid,uuid[]) to service_role;
commit;
