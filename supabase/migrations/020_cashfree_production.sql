-- Approved production-mode upgrade. Do not edit applied migrations 018/019.
begin;
alter table public.orders add column payment_environment text
  check (payment_environment in ('sandbox', 'production'));
alter table public.cashfree_payments drop constraint cashfree_payments_environment_check;
alter table public.cashfree_payments add constraint cashfree_payments_environment_check
  check (environment in ('sandbox', 'production'));
update public.orders o set payment_environment = p.environment
  from public.cashfree_payments p where p.order_id = o.id;

create or replace function public.create_cashfree_order_atomic(order_payload jsonb, request_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  existing public.orders;
  result jsonb;
  identity_key text := coalesce(order_payload->>'user_id', order_payload->>'guest_session_hash');
  selected_environment text := coalesce(order_payload->>'payment_environment', 'sandbox');
begin
  if selected_environment not in ('sandbox', 'production') then raise exception 'Invalid payment environment'; end if;
  if coalesce(identity_key, '') = '' or coalesce(request_key, '') = '' then raise exception 'Order identity required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(identity_key || request_key, 0));
  select * into existing from public.orders
    where idempotency_key = request_key and
      ((order_payload->>'user_id' is not null and user_id = (order_payload->>'user_id')::uuid) or
       (order_payload->>'user_id' is null and user_id is null and guest_session_hash = order_payload->>'guest_session_hash'));
  if existing.id is not null then
    if existing.payment_method::text <> 'cashfree' or not exists (
      select 1 from public.cashfree_payments where order_id=existing.id and environment=selected_environment
    ) then raise exception 'Request key belongs to another payment method or environment'; end if;
    return to_jsonb(existing) || jsonb_build_object(
      'items', coalesce((select jsonb_agg(i) from public.order_items i where order_id = existing.id), '[]'::jsonb),
      'events', coalesce((select jsonb_agg(e order by created_at) from public.order_events e where order_id = existing.id), '[]'::jsonb));
  end if;
  result := public.create_order_atomic(order_payload, request_key);
  update public.orders set payment_method = 'cashfree', payment_status = 'pending', payment_environment = selected_environment
    where id = (result->>'id')::uuid returning * into existing;
  insert into public.cashfree_payments(order_id, outlet_id, provider_order_id, amount, environment)
    values(existing.id, existing.outlet_id, 'bb_' || replace(existing.id::text, '-', ''), existing.grand_total, selected_environment);
  update public.order_events set note = case when selected_environment='production' then 'Awaiting UPI payment' else 'Awaiting Cashfree sandbox payment' end
    where order_id = existing.id and status = 'placed';
  return result || jsonb_build_object('payment_method', 'cashfree', 'payment_status', 'pending', 'payment_environment', selected_environment);
end;
$$;

create or replace function public.confirm_cashfree_payment(target_order_id uuid, provider_order text, provider_payment text, paid_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.cashfree_payments; o public.orders;
begin
  select * into o from public.orders where id = target_order_id for update;
  select * into p from public.cashfree_payments where order_id = target_order_id for update;
  if p.order_id is null or o.payment_method::text <> 'cashfree' or p.environment not in ('sandbox', 'production')
    or p.environment is distinct from o.payment_environment
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
    values(o.id, o.status, 'system', case when p.environment='production' then 'UPI payment verified by Cashfree' else 'Cashfree sandbox payment verified' end);
  return jsonb_build_object('paid', true, 'refund_required', o.status in ('cancelled', 'rejected'));
end;
$$;
revoke all on function public.create_cashfree_order_atomic(jsonb,text) from public, anon, authenticated;
revoke all on function public.confirm_cashfree_payment(uuid,text,text,numeric) from public, anon, authenticated;
grant execute on function public.create_cashfree_order_atomic(jsonb,text) to service_role;
grant execute on function public.confirm_cashfree_payment(uuid,text,text,numeric) to service_role;
commit;
