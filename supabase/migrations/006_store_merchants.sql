-- Store accounts use the manager role to avoid global owner privileges.
begin;

insert into public.outlets (
  id, slug, name, address, area, lat, lng, phone, is_open, delivery_enabled, timings
) values (
  '11111111-1111-1111-1111-111111111102',
  'burger-budds-badagaon-gwalior',
  'Burger Budds Badagaon Restaurant',
  'Badagaon, Gwalior, Madhya Pradesh',
  'Badagaon, Gwalior', 26.232214, 78.2708995, '', false, false, '{}'::jsonb
) on conflict (slug) do nothing;

create or replace function public.assign_store_merchant()
returns trigger language plpgsql security definer set search_path = public as $$
declare store_slug text;
begin
  store_slug := case lower(new.email)
    when 'vinaynagar@burgerbudds.in' then 'burger-budds-vinay-nagar-gwalior'
    when 'badagaon@burgerbudds.in' then 'burger-budds-badagaon-gwalior'
    else null end;
  -- Require an administrator-provisioned account, never public signup.
  if store_slug is not null and new.raw_app_meta_data->>'store_merchant' = 'true' then
    insert into public.staff(user_id, outlet_id, role)
    select new.id, id, 'manager'::public.staff_role from public.outlets where slug = store_slug
    on conflict (user_id, outlet_id) do update set role = excluded.role;
  end if;
  return new;
end;
$$;

create trigger assign_burger_budds_store_merchant
after insert or update of raw_app_meta_data on auth.users
for each row execute function public.assign_store_merchant();

insert into public.staff(user_id, outlet_id, role)
select u.id, o.id, 'manager'::public.staff_role
from auth.users u join public.outlets o on o.slug = case lower(u.email)
  when 'vinaynagar@burgerbudds.in' then 'burger-budds-vinay-nagar-gwalior'
  when 'badagaon@burgerbudds.in' then 'burger-budds-badagaon-gwalior' end
where u.raw_app_meta_data->>'store_merchant' = 'true'
on conflict (user_id, outlet_id) do update set role = excluded.role;

commit;
