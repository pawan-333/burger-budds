begin;

-- Provision explicitly after creating the rider's Supabase Auth user. A phone
-- in a manual handover note is never sufficient to claim a rider account.
create table public.rider_accounts (
  rider_id uuid primary key references public.riders(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index rider_accounts_outlet_idx on public.rider_accounts(outlet_id) where is_active;
create index orders_rider_delivery_idx on public.orders(rider_id, outlet_id, status, placed_at)
  where rider_id is not null and order_type = 'delivery';
alter table public.rider_accounts enable row level security;
revoke all on public.rider_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.rider_accounts to service_role;

create function public.assign_order_rider(target_order_id uuid, acting_user uuid, target_rider_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  current_order public.orders;
  assigned_rider public.riders;
  mobile text;
begin
  select * into current_order from public.orders where id = target_order_id for update;
  if current_order.id is null or acting_user is null then
    raise exception 'Order unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.staff where user_id = acting_user and outlet_id = current_order.outlet_id)
    and not exists (select 1 from public.super_admins where user_id = acting_user) then
    raise exception 'Order unavailable' using errcode = '42501';
  end if;
  select r.* into assigned_rider from public.riders r
    join public.rider_accounts a on a.rider_id = r.id
    where r.id = target_rider_id and a.outlet_id = current_order.outlet_id
      and a.is_active and r.is_active
    for share of a, r;
  if assigned_rider.id is null or current_order.order_type <> 'delivery'
    or (current_order.payment_method::text <> 'cod' and current_order.payment_status <> 'paid') then
    raise exception 'Order or rider unavailable' using errcode = '22023';
  end if;
  -- A retry of an already saved assignment must not duplicate the event.
  if current_order.status = 'out_for_delivery' and current_order.rider_id = target_rider_id then
    null;
  elsif current_order.status = 'ready' then
    mobile := regexp_replace(assigned_rider.phone, '[[:space:]()-]', '', 'g');
    if mobile ~ '^[6-9][0-9]{9}$' then mobile := '+91' || mobile;
    elsif mobile ~ '^91[6-9][0-9]{9}$' then mobile := '+' || mobile;
    end if;
    if mobile !~ '^\+91[6-9][0-9]{9}$' or length(btrim(assigned_rider.name)) not between 1 and 80
      or assigned_rider.name ~ '[[:cntrl:]]' then
      raise exception 'Rider contact is invalid' using errcode = '22023';
    end if;
    update public.orders set rider_id = assigned_rider.id, status = 'out_for_delivery'
      where id = current_order.id returning * into current_order;
    insert into public.order_events(order_id, status, actor, note)
      values(current_order.id, 'out_for_delivery', 'merchant',
        'rider-handover:' || jsonb_build_object('name', btrim(assigned_rider.name), 'phone', mobile)::text);
  else
    raise exception 'Order is no longer ready' using errcode = '22023';
  end if;
  return to_jsonb(current_order) || jsonb_build_object(
    'items', coalesce((select jsonb_agg(i) from public.order_items i where order_id = current_order.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(e order by created_at) from public.order_events e where order_id = current_order.id), '[]'::jsonb));
end;
$$;

create function public.complete_rider_delivery(target_order_id uuid, acting_user uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  current_order public.orders;
  assigned_rider uuid;
begin
  select * into current_order from public.orders where id = target_order_id for update;
  if current_order.id is null or acting_user is null then
    raise exception 'Order unavailable' using errcode = '42501';
  end if;
  select a.rider_id into assigned_rider from public.rider_accounts a
    join public.riders r on r.id = a.rider_id
    where a.user_id = acting_user and a.rider_id = current_order.rider_id
      and a.outlet_id = current_order.outlet_id and a.is_active and r.is_active
    for share of a, r;
  if assigned_rider is null or current_order.order_type <> 'delivery' then
    raise exception 'Order unavailable' using errcode = '42501';
  end if;
  if current_order.status = 'delivered' then
    return jsonb_build_object('id', current_order.id, 'status', 'delivered', 'delivered_at', current_order.delivered_at);
  end if;
  if current_order.status <> 'out_for_delivery'
    or (current_order.payment_method::text <> 'cod' and current_order.payment_status <> 'paid') then
    raise exception 'Order is not deliverable' using errcode = '22023';
  end if;
  -- Delivery confirmation does not mark COD/online payments as paid.
  update public.orders set status = 'delivered', delivered_at = now()
    where id = current_order.id returning * into current_order;
  insert into public.order_events(order_id, status, actor, note)
    values(current_order.id, 'delivered', 'rider', 'Delivery confirmed by assigned rider');
  return jsonb_build_object('id', current_order.id, 'status', 'delivered', 'delivered_at', current_order.delivered_at);
end;
$$;

-- Only server routes may invoke these functions, using a verified Auth user ID.
revoke all on function public.assign_order_rider(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_rider_delivery(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_order_rider(uuid, uuid, uuid) to service_role;
grant execute on function public.complete_rider_delivery(uuid, uuid) to service_role;

commit;
