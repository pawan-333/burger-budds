-- PREPARED ONLY: verify deployed schema/functions before applying with approval.
begin;
alter table public.orders
  add column collection_method text check (collection_method in ('cash', 'upi_delivery')),
  add column collected_at timestamptz,
  add column collected_by uuid references public.riders(id),
  add column collection_reference text;
alter table public.cashfree_payments add column purpose text not null default 'prepaid'
  check (purpose in ('prepaid', 'delivery'));

create function public.start_rider_payment(target_order_id uuid, acting_user uuid, selected_environment text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders;
begin
  select * into o from public.orders where id=target_order_id for update;
  if o.id is null or acting_user is null then raise exception 'Order unavailable' using errcode='42501'; end if;
  perform 1 from public.rider_accounts a join public.riders r on r.id=a.rider_id
    where a.user_id=acting_user and a.rider_id=o.rider_id and a.outlet_id=o.outlet_id and a.is_active and r.is_active
    for share of a,r;
  if not found then raise exception 'Order unavailable' using errcode='42501'; end if;
  if o.status <> 'out_for_delivery' or o.order_type <> 'delivery' or o.payment_method::text <> 'cod'
    or o.payment_status <> 'pending' or o.collection_method is not null or o.grand_total < 1
    or selected_environment not in ('sandbox','production') or selected_environment is null
    or (selected_environment='sandbox' and o.payment_environment is distinct from 'sandbox')
    or (selected_environment='production' and o.payment_environment='sandbox') then
    raise exception 'Order is not payable' using errcode='22023'; end if;
  if exists (select 1 from public.cashfree_payments where order_id=o.id and
      (purpose <> 'delivery' or environment <> selected_environment or state <> 'pending' or expires_at <= now())) then
    raise exception 'Payment attempt requires store review' using errcode='22023'; end if;
  update public.orders set payment_environment=selected_environment where id=o.id;
  insert into public.cashfree_payments(order_id,outlet_id,provider_order_id,amount,environment,purpose)
    values(o.id,o.outlet_id,'bb_' || replace(o.id::text,'-',''),o.grand_total,selected_environment,'delivery')
    on conflict (order_id) do nothing;
end; $$;

-- Replace the old signature so older clients cannot silently confirm unpaid COD.
drop function public.complete_rider_delivery(uuid,uuid);
create function public.complete_rider_delivery(target_order_id uuid, acting_user uuid, collection text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders;
begin
  select * into o from public.orders where id=target_order_id for update;
  if o.id is null or acting_user is null then raise exception 'Order unavailable' using errcode='42501'; end if;
  perform 1 from public.rider_accounts a join public.riders r on r.id=a.rider_id
    where a.user_id=acting_user and a.rider_id=o.rider_id and a.outlet_id=o.outlet_id and a.is_active and r.is_active
    for share of a,r;
  if not found or o.order_type <> 'delivery' then raise exception 'Order unavailable' using errcode='42501'; end if;
  if o.status='delivered' then return jsonb_build_object('id',o.id,'status',o.status,'delivered_at',o.delivered_at); end if;
  if o.status <> 'out_for_delivery' or o.payment_status not in ('pending','paid') or (collection is not null and collection <> 'cash') then
    raise exception 'Order is not deliverable' using errcode='22023'; end if;
  if o.payment_status <> 'paid' then
    if o.payment_method::text <> 'cod' or (o.grand_total > 0 and collection is distinct from 'cash') or exists (
      select 1 from public.cashfree_payments where order_id=o.id and state='pending'
    ) then raise exception 'Confirm collection or resolve UPI first' using errcode='22023'; end if;
    update public.orders set payment_status='paid',collection_method='cash',collected_at=now(),collected_by=o.rider_id where id=o.id;
  elsif collection is not null then
    raise exception 'Payment already collected' using errcode='22023';
  end if;
  update public.orders set status='delivered',delivered_at=now() where id=o.id returning * into o;
  insert into public.order_events(order_id,status,actor,note) values(o.id,'delivered','rider',
    case when o.collection_method='cash' then 'Cash collection confirmed by assigned rider; cash settlement pending'
    when o.collection_method='upi_delivery' then 'Delivery confirmed; UPI at delivery verified by Cashfree'
    else 'Delivery confirmed; payment already recorded' end);
  return jsonb_build_object('id',o.id,'status',o.status,'delivered_at',o.delivered_at);
end; $$;

create or replace function public.confirm_cashfree_payment(target_order_id uuid, provider_order text, provider_payment text, paid_amount numeric)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.cashfree_payments; o public.orders; review boolean;
begin
  select * into o from public.orders where id=target_order_id for update;
  select * into p from public.cashfree_payments where order_id=target_order_id for update;
  if p.order_id is null or not ((p.purpose='prepaid' and o.payment_method::text='cashfree') or
      (p.purpose='delivery' and o.payment_method::text='cod'))
    or p.environment not in ('sandbox','production') or p.environment is distinct from o.payment_environment
    or p.outlet_id is distinct from o.outlet_id or p.provider_order_id is distinct from provider_order
    or paid_amount is distinct from p.amount or paid_amount is distinct from o.grand_total
    or coalesce(provider_payment,'') !~ '^[0-9]{1,40}$' then raise exception 'Payment mismatch'; end if;
  if p.state='paid' then
    if p.provider_payment_id <> provider_payment then raise exception 'Payment already recorded'; end if;
    return jsonb_build_object('paid',true,'refund_required',p.refund_required);
  end if;
  review := o.status in ('cancelled','rejected') or o.collection_method='cash' or o.payment_status='refunded';
  review := coalesce(review,false);
  update public.cashfree_payments set state='paid',provider_payment_id=provider_payment,paid_at=now(),refund_required=review where order_id=o.id;
  if o.collection_method is distinct from 'cash' and o.payment_status <> 'refunded' then
    update public.orders set payment_status='paid',
      collection_method=case when p.purpose='delivery' then 'upi_delivery' else collection_method end,
      collected_at=case when p.purpose='delivery' then now() else collected_at end,
      collected_by=case when p.purpose='delivery' then rider_id else collected_by end,
      collection_reference=case when p.purpose='delivery' then provider_payment else collection_reference end where id=o.id;
  end if;
  insert into public.order_events(order_id,status,actor,note) values(o.id,o.status,'system',
    case when review then 'UPI payment received: refund/review required; prior collection preserved'
    when p.environment='sandbox' then 'TEST UPI payment verified; no real money collected'
    when p.purpose='delivery' then 'UPI at delivery verified by Cashfree' else 'UPI prepaid verified by Cashfree' end);
  return jsonb_build_object('paid',true,'refund_required',review);
end; $$;

-- Delivery payment expiry must not cancel a food order already on its way.
create or replace function public.expire_cashfree_order(target_order_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders; p public.cashfree_payments;
begin
  select * into o from public.orders where id=target_order_id for update;
  select * into p from public.cashfree_payments where order_id=target_order_id for update;
  if p.order_id is null then raise exception 'Payment not found'; end if;
  if p.state <> 'pending' then return; end if;
  update public.cashfree_payments set state='expired' where order_id=o.id;
  if p.purpose='prepaid' and o.payment_status='pending' and o.status='placed' then
    update public.orders set status='cancelled',payment_status='failed',reject_reason='Payment session expired' where id=o.id;
    insert into public.order_events(order_id,status,actor,note) values(o.id,'cancelled','system','Cashfree payment session expired');
  end if;
end; $$;

-- Covers merchant/legacy transitions too, preserving collection checks.
create function public.guard_delivery_collection() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.collection_method='upi_delivery' and new.status in ('cancelled','rejected') then
    update public.cashfree_payments set refund_required=true where order_id=new.id;
  end if;
  if new.status='delivered' and old.status is distinct from 'delivered' and new.rider_id is not null
    and new.payment_method::text='cod' and (new.payment_status <> 'paid' or new.collection_method is null) then
    raise exception 'Assigned rider must confirm payment collection before delivery';
  end if;
  return new;
end; $$;
create trigger guard_delivery_collection before update on public.orders for each row execute function public.guard_delivery_collection();
revoke all on function public.start_rider_payment(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.complete_rider_delivery(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.confirm_cashfree_payment(uuid,text,text,numeric) from public,anon,authenticated;
revoke all on function public.expire_cashfree_order(uuid) from public,anon,authenticated;
revoke all on function public.guard_delivery_collection() from public,anon,authenticated;
grant execute on function public.start_rider_payment(uuid,uuid,text) to service_role;
grant execute on function public.complete_rider_delivery(uuid,uuid,text) to service_role;
grant execute on function public.confirm_cashfree_payment(uuid,text,text,numeric) to service_role;
grant execute on function public.expire_cashfree_order(uuid) to service_role;
commit;
