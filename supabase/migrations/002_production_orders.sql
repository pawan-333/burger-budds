-- Apply only to the dedicated Burger Budds project.
begin;
alter table public.outlets add column if not exists delivery_enabled boolean not null default true;
alter table public.outlets add column if not exists pause_until timestamptz;
alter table public.orders add column if not exists idempotency_key text;
create unique index if not exists orders_user_request_key on public.orders(user_id, idempotency_key);
alter table public.profiles alter column wallet_balance set default 0;

-- The server computes totals and verifies identity before writing orders.
drop policy if exists "Customers create own orders" on public.orders;
drop policy if exists "Staff update outlet orders" on public.orders;
drop policy if exists "Insert order_items" on public.order_items;
drop policy if exists "Insert order_events" on public.order_events;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
revoke insert, update, delete on public.profiles, public.orders, public.order_items, public.order_events from anon, authenticated;
grant update(name, phone, email, marketing_opt_in) on public.profiles to authenticated;
create policy "Users update profile details" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
revoke all on public.riders from anon;
drop policy if exists "Public read riders" on public.riders;
create policy "Staff read riders" on public.riders for select to authenticated using (public.is_owner() or exists (select 1 from public.staff where user_id = auth.uid()));

alter function public.is_outlet_staff(uuid) set search_path = public;
alter function public.is_owner() set search_path = public;

create or replace function public.create_customer_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, name, phone, email, wallet_balance, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.phone, coalesce(new.email, ''), 0, 'BB' || replace(new.id::text, '-', ''))
  on conflict (id) do nothing;
  if lower(new.email) = 'pavankotiya142@gmail.com' then
    insert into public.staff(user_id, outlet_id, role)
    values (new.id, '11111111-1111-1111-1111-111111111101', 'owner')
    on conflict (user_id, outlet_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger create_burger_budds_profile after insert on auth.users for each row execute function public.create_customer_profile();

create or replace function public.create_order_atomic(order_payload jsonb, request_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_order public.orders;
  line jsonb;
  selected_user uuid := (order_payload->>'user_id')::uuid;
begin
  -- Serialize retries for this user and key before inserting.
  perform pg_advisory_xact_lock(hashtextextended(selected_user::text || request_key, 0));
  select * into current_order from public.orders where user_id = selected_user and idempotency_key = request_key;
  if current_order.id is null then
    insert into public.orders (
      id, order_no, user_id, customer_name, customer_phone, outlet_id, order_type,
      address_snapshot, status, item_total, tax, delivery_fee, platform_fee,
      discount, wallet_used, grand_total, coupon_code, payment_method, payment_status,
      special_instructions, marketing_opt_in, prep_time_min, idempotency_key
    ) values (
      (order_payload->>'id')::uuid, order_payload->>'order_no', selected_user,
      order_payload->>'customer_name', order_payload->>'customer_phone',
      (order_payload->>'outlet_id')::uuid, order_payload->>'order_type',
      nullif(order_payload->'address_snapshot', 'null'::jsonb), 'placed',
      (order_payload->>'item_total')::numeric, (order_payload->>'tax')::numeric,
      (order_payload->>'delivery_fee')::numeric, (order_payload->>'platform_fee')::numeric,
      (order_payload->>'discount')::numeric, 0, (order_payload->>'grand_total')::numeric,
      order_payload->>'coupon_code', 'cod', 'pending', order_payload->>'special_instructions',
      coalesce((order_payload->>'marketing_opt_in')::boolean, false),
      (order_payload->>'prep_time_min')::integer, request_key
    ) returning * into current_order;
    for line in select * from jsonb_array_elements(order_payload->'items') loop
      insert into public.order_items(id, order_id, item_id, item_name, diet, variant, addons, qty, unit_price)
      values ((line->>'id')::uuid, current_order.id, (line->>'item_id')::uuid,
        line->>'item_name', (line->>'diet')::public.diet_type, line->>'variant',
        line->'addons', (line->>'qty')::integer, (line->>'unit_price')::numeric);
    end loop;
    insert into public.order_events(order_id, status, actor, note)
    values (current_order.id, 'placed', 'customer', 'Order placed via COD');
  end if;
  return to_jsonb(current_order) || jsonb_build_object(
    'items', coalesce((select jsonb_agg(i) from public.order_items i where order_id = current_order.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(e order by created_at) from public.order_events e where order_id = current_order.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.create_order_atomic(jsonb, text) from public, anon, authenticated;
grant execute on function public.create_order_atomic(jsonb, text) to service_role;

create or replace function public.transition_order(target_order_id uuid, acting_user uuid, next_status public.order_status, preparation_minutes integer default 20, rejection_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_order public.orders;
  staff_member boolean;
begin
  select * into current_order from public.orders where id = target_order_id for update;
  if current_order.id is null then raise exception 'Order not found'; end if;
  select exists(select 1 from public.staff where user_id = acting_user and outlet_id = current_order.outlet_id) into staff_member;
  if not staff_member and not (current_order.user_id = acting_user and current_order.status = 'placed' and next_status = 'cancelled') then
    raise exception 'Access denied';
  end if;
  if not (
    (current_order.status = 'placed' and next_status in ('accepted','rejected','cancelled')) or
    (current_order.status = 'accepted' and next_status in ('preparing','ready','rejected','cancelled')) or
    (current_order.status = 'preparing' and next_status = 'ready') or
    (current_order.status = 'ready' and next_status in ('out_for_delivery','delivered')) or
    (current_order.status = 'out_for_delivery' and next_status = 'delivered')
  ) then raise exception 'Invalid status transition'; end if;
  if next_status = 'rejected' and coalesce(trim(rejection_reason), '') = '' then raise exception 'A rejection reason is required'; end if;
  update public.orders set status = next_status,
    prep_time_min = case when next_status = 'accepted' then greatest(1, least(120, preparation_minutes)) else prep_time_min end,
    accepted_at = case when next_status = 'accepted' then now() else accepted_at end,
    delivered_at = case when next_status = 'delivered' then now() else delivered_at end,
    payment_status = case when next_status = 'delivered' and payment_method = 'cod' then 'paid' else payment_status end,
    reject_reason = case when next_status = 'rejected' then rejection_reason else reject_reason end
  where id = target_order_id returning * into current_order;
  insert into public.order_events(order_id, status, actor, note)
  values (current_order.id, next_status, case when staff_member then 'merchant' else 'customer' end, rejection_reason);
  return to_jsonb(current_order) || jsonb_build_object(
    'items', coalesce((select jsonb_agg(i) from public.order_items i where order_id = current_order.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(e order by created_at) from public.order_events e where order_id = current_order.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.transition_order(uuid, uuid, public.order_status, integer, text) from public, anon, authenticated;
grant execute on function public.transition_order(uuid, uuid, public.order_status, integer, text) to service_role;
commit;
