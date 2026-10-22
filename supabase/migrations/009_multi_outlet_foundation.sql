begin;
alter table public.outlets alter column area set default '';
alter table public.outlets add column city text not null default '';
alter table public.outlets add column whatsapp text;
alter table public.outlets add column opening_hours jsonb not null default '{}';
alter table public.outlets add column fssai_number text;
alter table public.outlets add column gst_number text;
alter table public.outlets add column owner_type text not null default 'brand' check(owner_type in ('brand','franchise'));
alter table public.outlets add column franchisee_id uuid references auth.users(id);
alter table public.outlets add column status text not null default 'active' check(status in ('active','paused'));
alter table public.outlets add column packaging_fee numeric(10,2) not null default 0 check(packaging_fee>=0);
alter table public.outlets add column avg_delivery_min integer not null default 20;
alter table public.outlets add column allow_price_override boolean not null default false;
alter table public.outlets add column order_types jsonb not null default '{"delivery":true,"takeaway":true,"dine_in":false,"in_car":false,"reservation":false,"direct_pay":false}';
alter table public.outlets add column petpooja_restaurant_id text;
alter table public.outlets add column rapido_config jsonb;
alter table public.outlets add column integrations_enabled boolean not null default false;
create table public.menu_items (
 id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
 price numeric(10,2) not null check(price>=0), diet public.diet_type not null default 'veg',
 image_url text not null default '/menu-fallback.svg', category_name text not null default '',
 is_bestseller boolean not null default false,is_new boolean not null default false,
 variants jsonb not null default '[]',addon_groups jsonb not null default '[]',updated_at timestamptz not null default now()
);
-- Keep existing IDs and all historical order references intact.
insert into public.menu_items(id,name,description,price,diet,image_url,category_name,variants,addon_groups)
select i.id,i.name,i.description,i.price,i.diet,i.image_url,c.name,
coalesce((select jsonb_agg(v) from public.item_variants v where v.item_id=i.id),'[]'),
coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('addons',coalesce((select jsonb_agg(a) from public.addons a where a.group_id=g.id),'[]'))) from public.addon_groups g where g.item_id=i.id),'[]')
from public.items i join public.categories c on c.id=i.category_id;
create table public.outlet_menu_items (
 outlet_id uuid not null references public.outlets(id),item_id uuid not null references public.menu_items(id),legacy_item_id uuid references public.items(id),
 available boolean not null default true,price_override numeric(10,2) check(price_override>=0),sort_order integer not null default 0,
 variant_overrides jsonb not null default '{}',addon_overrides jsonb not null default '{}',primary key(outlet_id,item_id)
);
insert into public.outlet_menu_items(outlet_id,item_id,legacy_item_id,available,sort_order) select outlet_id,id,id,is_available,sort_order from public.items;
create table public.brand_memberships(user_id uuid primary key references auth.users(id),role text not null check(role='brand_admin'));
insert into public.brand_memberships select user_id,'brand_admin' from public.super_admins;
create table public.outlet_memberships(user_id uuid references auth.users(id),outlet_id uuid references public.outlets(id),role text not null check(role in ('franchise_owner','outlet_manager','staff')),primary key(user_id,outlet_id));
insert into public.outlet_memberships select user_id,outlet_id,case role::text when 'owner' then 'franchise_owner' when 'manager' then 'outlet_manager' else 'staff' end from public.staff;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.super_admins where user_id=auth.uid()) or exists(select 1 from public.brand_memberships where user_id=auth.uid() and role='brand_admin'); $$;
create or replace function public.is_outlet_staff(target_outlet_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select public.is_owner() or exists(select 1 from public.staff where user_id=auth.uid() and outlet_id=target_outlet_id) or exists(select 1 from public.outlet_memberships where user_id=auth.uid() and outlet_id=target_outlet_id); $$;
alter table public.menu_items enable row level security;
alter table public.outlet_menu_items enable row level security;
alter table public.brand_memberships enable row level security;
alter table public.outlet_memberships enable row level security;
create policy "Brand membership self read" on public.brand_memberships for select to authenticated using(user_id=auth.uid());
create policy "Outlet membership self read" on public.outlet_memberships for select to authenticated using(user_id=auth.uid());
create policy "Public central menu" on public.menu_items for select using(true);
create policy "Brand edit central menu" on public.menu_items for all to authenticated using(public.is_owner()) with check(public.is_owner());
create policy "Public outlet menu" on public.outlet_menu_items for select using(true);
-- Mutations go through validated server routes, not unrestricted browser updates.
create policy "Brand outlet menu write" on public.outlet_menu_items for all to authenticated using(public.is_owner()) with check(public.is_owner());
commit;
