begin;
alter table public.orders add column if not exists guest_session_hash text;
create unique index if not exists orders_guest_request_key on public.orders(guest_session_hash,idempotency_key) where user_id is null;
create or replace function public.create_order_atomic(order_payload jsonb, request_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_order public.orders;
  line jsonb;
  guest_hash text := order_payload->>'guest_session_hash';
  selected_user uuid := (order_payload->>'user_id')::uuid;
begin
  if selected_user is null and coalesce(guest_hash, '') !~ '^[a-f0-9]{64}$' then raise exception 'Guest session required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(selected_user::text, guest_hash) || request_key, 0));
  select * into current_order from public.orders where ((selected_user is not null and user_id = selected_user) or (selected_user is null and guest_session_hash = guest_hash)) and idempotency_key = request_key;
  if current_order.id is null then
    insert into public.orders (
      id, order_no, user_id, guest_session_hash, customer_name, customer_phone, outlet_id, order_type,
      address_snapshot, status, item_total, tax, delivery_fee, platform_fee,
      discount, wallet_used, grand_total, coupon_code, payment_method, payment_status,
      special_instructions, marketing_opt_in, prep_time_min, idempotency_key
    ) values (
      (order_payload->>'id')::uuid, order_payload->>'order_no', selected_user, guest_hash,
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

create or replace function public.validate_order_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare selected_coupon public.coupons;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.user_id::text, new.guest_session_hash), 0));
  if exists (select 1 from public.orders where (user_id = new.user_id or (new.user_id is null and guest_session_hash = new.guest_session_hash)) and placed_at > now() - interval '10 seconds') then
    raise exception 'Please wait a few seconds before placing another order';
  end if;
  if new.coupon_code is not null then
    select * into selected_coupon from public.coupons where code = new.coupon_code for update;
    if selected_coupon.id is null or not selected_coupon.is_active or
      selected_coupon.starts_at > now() or selected_coupon.ends_at <= now() or
      new.item_total < selected_coupon.min_order then raise exception 'Coupon is no longer available'; end if;
    if selected_coupon.first_order_only and (new.user_id is null or exists (
      select 1 from public.orders where (user_id = new.user_id or (new.user_id is null and guest_session_hash = new.guest_session_hash)) and status not in ('rejected', 'cancelled')
    )) then raise exception 'This coupon is for your first order only'; end if;
    if selected_coupon.usage_limit is not null and (
      select count(*) from public.orders where coupon_code = selected_coupon.code
    ) >= selected_coupon.usage_limit then raise exception 'Coupon usage limit reached'; end if;
  end if;
  return new;
end;
$$;
create or replace function public.cancel_guest_order(target_order_id uuid, session_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare current_order public.orders;
begin
 select * into current_order from public.orders where id = target_order_id and user_id is null and guest_session_hash = session_hash for update;
 if current_order.id is null or current_order.status != 'placed' then raise exception 'Cancellation not allowed'; end if;
 update public.orders set status = 'cancelled' where id = current_order.id returning * into current_order;
 insert into public.order_events(order_id, status, actor, note) values(current_order.id, 'cancelled', 'customer', 'Cancelled by guest customer');
 return to_jsonb(current_order) - 'guest_session_hash';
end;
$$;
revoke all on function public.cancel_guest_order(uuid,text) from public, anon, authenticated;
grant execute on function public.cancel_guest_order(uuid,text) to service_role;
commit;
