-- Burger Budds Online Ordering + Merchant App
-- Supabase Postgres Schema + Row Level Security (RLS) + Realtime

create extension if not exists "pgcrypto";

-- 1. ENUM Types
do $$ begin
  create type diet_type as enum ('veg', 'nonveg', 'egg');
exception when duplicate_object then null; end $$;

do $$ begin
  create type address_label as enum ('home', 'office', 'hotel', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'placed',
    'accepted',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method_type as enum ('razorpay', 'cod');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_role as enum ('owner', 'manager', 'staff');
exception when duplicate_object then null; end $$;

-- 2. Tables

create table if not exists outlets (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  address text not null,
  area text not null default 'Vinay Nagar, Gwalior',
  lat double precision not null,
  lng double precision not null,
  phone text not null,
  is_open boolean not null default true,
  prep_time_min integer not null default 35,
  delivery_radius_km double precision not null default 5.0,
  delivery_polygon jsonb default null,
  min_order numeric(10,2) not null default 99.00,
  gst_percent numeric(5,2) not null default 5.00,
  platform_fee numeric(10,2) not null default 9.00,
  delivery_fee_rules jsonb not null default '{"base_fee": 29, "free_above": 299, "per_km_above_3km": 8}'::jsonb,
  timings jsonb not null default '{"open": "11:00", "close": "23:30"}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  parent_id uuid references categories(id) on delete set null,
  is_active boolean not null default true
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null,
  original_price numeric(10,2) default null,
  image_url text not null,
  diet diet_type not null default 'veg',
  is_available boolean not null default true,
  is_bestseller boolean not null default false,
  is_new boolean not null default false,
  is_on_offer boolean not null default false,
  rating numeric(3,2) not null default 4.40,
  order_count integer not null default 50,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists item_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0.00
);

create table if not exists addon_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  name text not null,
  min_select integer not null default 0,
  max_select integer not null default 4
);

create table if not exists addons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references addon_groups(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0.00,
  diet diet_type not null default 'veg'
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text default '',
  phone text unique,
  email text default '',
  wallet_balance numeric(10,2) not null default 150.00,
  referral_code text unique,
  referred_by uuid references profiles(id) on delete set null,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label address_label not null default 'home',
  house text not null,
  landmark text default '',
  phone text not null,
  email text default '',
  lat double precision not null,
  lng double precision not null,
  locality text not null,
  city text not null,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  description text not null default '',
  type text not null check (type in ('flat', 'percent', 'fixed_price')),
  value numeric(10,2) not null,
  min_order numeric(10,2) not null default 0.00,
  max_discount numeric(10,2) default null,
  first_order_only boolean not null default false,
  starts_at timestamptz default now(),
  ends_at timestamptz default (now() + interval '1 year'),
  usage_limit integer default 1000,
  is_active boolean not null default true
);

create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  order_type text not null default 'delivery' check (order_type in ('delivery', 'takeaway')),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  variant_id uuid references item_variants(id) on delete set null,
  addons jsonb not null default '[]'::jsonb,
  qty integer not null default 1 check (qty > 0),
  note text default ''
);

create table if not exists riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  is_active boolean not null default true
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null default 'Guest Customer',
  customer_phone text not null,
  outlet_id uuid not null references outlets(id) on delete restrict,
  order_type text not null default 'delivery' check (order_type in ('delivery', 'takeaway')),
  address_snapshot jsonb default null,
  status order_status not null default 'placed',
  reject_reason text default null,
  item_total numeric(10,2) not null,
  tax numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0.00,
  platform_fee numeric(10,2) not null default 0.00,
  discount numeric(10,2) not null default 0.00,
  wallet_used numeric(10,2) not null default 0.00,
  grand_total numeric(10,2) not null,
  coupon_code text default null,
  payment_method payment_method_type not null default 'cod',
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded', 'failed')),
  razorpay_order_id text default null,
  special_instructions text default '',
  marketing_opt_in boolean not null default false,
  prep_time_min integer default 20,
  rider_id uuid references riders(id) on delete set null,
  placed_at timestamptz not null default now(),
  accepted_at timestamptz default null,
  delivered_at timestamptz default null
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  item_name text not null,
  diet diet_type not null default 'veg',
  variant text default null,
  addons jsonb not null default '[]'::jsonb,
  qty integer not null default 1,
  unit_price numeric(10,2) not null
);

create table if not exists order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  actor text not null default 'customer',
  note text default null,
  created_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null,
  type text not null check (type in ('credit', 'debit')),
  ref_order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  role staff_role not null default 'staff',
  unique(user_id, outlet_id)
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- 3. Helper functions for RLS
create or replace function is_outlet_staff(target_outlet_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from staff
    where staff.user_id = auth.uid()
      and staff.outlet_id = target_outlet_id
  );
$$;

create or replace function is_owner()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from staff
    where staff.user_id = auth.uid()
      and staff.role = 'owner'
  );
$$;

-- 4. Enable Row Level Security (RLS)
alter table outlets enable row level security;
alter table categories enable row level security;
alter table items enable row level security;
alter table item_variants enable row level security;
alter table addon_groups enable row level security;
alter table addons enable row level security;
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table coupons enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;
alter table wallet_transactions enable row level security;
alter table staff enable row level security;
alter table riders enable row level security;
alter table push_subscriptions enable row level security;

-- Public Read Policies for Menu & Coupons
create policy "Public read outlets" on outlets for select using (true);
create policy "Staff update outlets" on outlets for update using (is_outlet_staff(id) or is_owner());

create policy "Public read categories" on categories for select using (true);
create policy "Owner write categories" on categories for all using (is_owner());

create policy "Public read items" on items for select using (true);
create policy "Staff update items stock" on items for update using (is_outlet_staff(outlet_id) or is_owner());
create policy "Owner insert/delete items" on items for all using (is_owner());

create policy "Public read item_variants" on item_variants for select using (true);
create policy "Owner write item_variants" on item_variants for all using (is_owner());

create policy "Public read addon_groups" on addon_groups for select using (true);
create policy "Owner write addon_groups" on addon_groups for all using (is_owner());

create policy "Public read addons" on addons for select using (true);
create policy "Owner write addons" on addons for all using (is_owner());

create policy "Public read coupons" on coupons for select using (true);
create policy "Owner write coupons" on coupons for all using (is_owner());

create policy "Public read riders" on riders for select using (true);

-- Customer Self-Access Policies
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Users manage own addresses" on addresses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own carts" on carts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own cart_items" on cart_items for all
  using (exists (select 1 from carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid()))
  with check (exists (select 1 from carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid()));

-- Orders Policies (Customer own + Outlet Staff)
create policy "Customers read own orders" on orders for select
  using (auth.uid() = user_id or is_outlet_staff(outlet_id) or is_owner());

create policy "Customers create own orders" on orders for insert
  with check (auth.uid() = user_id);

create policy "Staff update outlet orders" on orders for update
  using (is_outlet_staff(outlet_id) or is_owner() or (auth.uid() = user_id and status = 'placed'));

create policy "Read order_items" on order_items for select
  using (exists (
    select 1 from orders
    where orders.id = order_items.order_id
      and (orders.user_id = auth.uid() or is_outlet_staff(orders.outlet_id) or is_owner())
  ));

create policy "Insert order_items" on order_items for insert
  with check (exists (
    select 1 from orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  ));

create policy "Read order_events" on order_events for select
  using (exists (
    select 1 from orders
    where orders.id = order_events.order_id
      and (orders.user_id = auth.uid() or is_outlet_staff(orders.outlet_id) or is_owner())
  ));

create policy "Insert order_events" on order_events for insert
  with check (exists (
    select 1 from orders
    where orders.id = order_events.order_id
      and (orders.user_id = auth.uid() or is_outlet_staff(orders.outlet_id) or is_owner())
  ));

create policy "Users read own wallet_transactions" on wallet_transactions for select
  using (auth.uid() = user_id);

create policy "Staff read own membership" on staff for select
  using (auth.uid() = user_id or is_owner());

create policy "Staff manage push_subscriptions" on push_subscriptions for all
  using (exists (select 1 from staff where staff.id = push_subscriptions.staff_id and staff.user_id = auth.uid()));

-- 5. Enable Supabase Realtime on orders, order_events, items, outlets
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_events;
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table outlets;
