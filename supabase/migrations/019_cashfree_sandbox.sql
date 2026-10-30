-- Prepared only. Verify deployed RPC/schema versions before applying.
begin;
create table public.cashfree_payments (
  order_id uuid primary key references public.orders(id),
  outlet_id uuid not null references public.outlets(id),
  provider_order_id text not null unique,
  provider_payment_id text unique,
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  amount numeric(12,2) not null check (amount >= 1),
  currency text not null default 'INR' check (currency = 'INR'),
  state text not null default 'pending' check (state in ('pending', 'paid', 'expired')),
  refund_required boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '20 minutes',
  paid_at timestamptz
);
alter table public.cashfree_payments enable row level security;
revoke all on public.cashfree_payments from public, anon, authenticated;
grant select, insert, update on public.cashfree_payments to service_role;

create function public.create_cashfree_order_atomic(order_payload jsonb, request_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  existing public.orders;
  result jsonb;
  identity_key text := coalesce(order_payload->>'user_id', order_payload->>'guest_session_hash');
begin
  if coalesce(identity_key, '') = '' or coalesce(request_key, '') = '' then raise exception 'Order identity required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(identity_key || request_key, 0));
  select * into existing from public.orders
    where idempotency_key = request_key and
      ((order_payload->>'user_id' is not null and user_id = (order_payload->>'user_id')::uuid) or
       (order_payload->>'user_id' is null and user_id is null and guest_session_hash = order_payload->>'guest_session_hash'));
  if existing.id is not null then
    if existing.payment_method::text <> 'cashfree' then raise exception 'Request key belongs to another payment method'; end if;
    return to_jsonb(existing) || jsonb_build_object(
      'items', coalesce((select jsonb_agg(i) from public.order_items i where order_id = existing.id), '[]'::jsonb),
      'events', coalesce((select jsonb_agg(e order by created_at) from public.order_events e where order_id = existing.id), '[]'::jsonb));
  end if;
  result := public.create_order_atomic(order_payload, request_key);
  update public.orders set payment_method = 'cashfree', payment_status = 'pending'
    where id = (result->>'id')::uuid returning * into existing;
  insert into public.cashfree_payments(order_id, outlet_id, provider_order_id, amount)
    values(existing.id, existing.outlet_id, 'bb_' || replace(existing.id::text, '-', ''), existing.grand_total);
  update public.order_events set note = 'Awaiting Cashfree sandbox payment'
    where order_id = existing.id and status = 'placed';
  return result || jsonb_build_object('payment_method', 'cashfree', 'payment_status', 'pending');
end;
$$;

create function public.guard_cashfree_fulfilment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.payment_method::text = 'cashfree' and new.payment_status <> 'paid'
    and new.status in ('cancelled', 'rejected')
    and to_regclass('public.coupon_redemptions') is not null then
    delete from public.coupon_redemptions where order_id = new.id;
  end if;
  if new.payment_method::text = 'cashfree' and new.payment_status <> 'paid'
    and new.status not in ('placed', 'cancelled', 'rejected') then
    raise exception 'Verified payment required before fulfilment';
  end if;
  if new.payment_method::text = 'cashfree' and new.payment_status = 'paid'
    and new.status in ('cancelled', 'rejected') then
    update public.cashfree_payments set refund_required = true where order_id = new.id;
  end if;
  return new;
end;
$$;
create trigger guard_cashfree_fulfilment before update on public.orders
  for each row execute function public.guard_cashfree_fulfilment();

create function public.confirm_cashfree_payment(target_order_id uuid, provider_order text, provider_payment text, paid_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.cashfree_payments; o public.orders;
begin
  -- All payment RPCs lock the order first to share lock order with status changes.
  select * into o from public.orders where id = target_order_id for update;
  select * into p from public.cashfree_payments where order_id = target_order_id for update;
  if p.order_id is null or o.payment_method::text <> 'cashfree' or p.environment <> 'sandbox'
    or p.outlet_id is distinct from o.outlet_id or p.provider_order_id is distinct from provider_order
    or paid_amount is distinct from p.amount or paid_amount is distinct from o.grand_total
    or coalesce(provider_payment, '') !~ '^[0-9]{1,40}$' then raise exception 'Payment mismatch'; end if;
  if p.state = 'paid' then
    if p.provider_payment_id <> provider_payment then raise exception 'Payment already recorded'; end if;
    return jsonb_build_object('paid', true, 'refund_required', p.refund_required);
  end if;
  update public.cashfree_payments set state = 'paid', provider_payment_id = provider_payment,
    paid_at = now(), refund_required = o.status in ('cancelled', 'rejected') where order_id = o.id;
  update public.orders set payment_status = 'paid' where id = o.id;
  insert into public.order_events(order_id, status, actor, note)
    values(o.id, o.status, 'system', 'Cashfree sandbox payment verified');
  return jsonb_build_object('paid', true, 'refund_required', o.status in ('cancelled', 'rejected'));
end;
$$;

create function public.expire_cashfree_order(target_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; p public.cashfree_payments;
begin
  select * into o from public.orders where id = target_order_id for update;
  select * into p from public.cashfree_payments where order_id = target_order_id for update;
  if p.order_id is null or o.payment_method::text <> 'cashfree' then raise exception 'Payment not found'; end if;
  if p.state <> 'pending' then return; end if;
  update public.cashfree_payments set state = 'expired' where order_id = o.id;
  if o.payment_status = 'pending' and o.status = 'placed' then
    update public.orders set status = 'cancelled', payment_status = 'failed', reject_reason = 'Payment session expired' where id = o.id;
    insert into public.order_events(order_id, status, actor, note) values(o.id, 'cancelled', 'system', 'Cashfree payment session expired');
  end if;
end;
$$;
revoke all on function public.create_cashfree_order_atomic(jsonb,text) from public, anon, authenticated;
revoke all on function public.confirm_cashfree_payment(uuid,text,text,numeric) from public, anon, authenticated;
revoke all on function public.expire_cashfree_order(uuid) from public, anon, authenticated;
revoke all on function public.guard_cashfree_fulfilment() from public, anon, authenticated;
grant execute on function public.create_cashfree_order_atomic(jsonb,text) to service_role;
grant execute on function public.confirm_cashfree_payment(uuid,text,text,numeric) to service_role;
grant execute on function public.expire_cashfree_order(uuid) to service_role;
commit;
