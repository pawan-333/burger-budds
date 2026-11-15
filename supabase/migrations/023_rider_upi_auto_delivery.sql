-- PREPARED ONLY: migration 022 is already applied. Review deployed function state before applying.
begin;

create or replace function public.confirm_cashfree_payment(target_order_id uuid, provider_order text, provider_payment text, paid_amount numeric)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.cashfree_payments; o public.orders; review boolean; auto_deliver boolean;
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
    return jsonb_build_object('paid',true,'refund_required',p.refund_required,
      'delivered',o.status='delivered' and o.collection_method='upi_delivery');
  end if;
  review := coalesce(o.status in ('cancelled','rejected') or o.collection_method='cash' or o.payment_status='refunded'
    or p.state <> 'pending' or p.expires_at <= now()
    or (p.purpose='delivery' and (o.status <> 'out_for_delivery' or o.payment_status <> 'pending')),false);
  auto_deliver := p.purpose='delivery' and not review and o.status='out_for_delivery'
    and o.payment_status='pending' and o.collection_method is null;
  update public.cashfree_payments set state='paid',provider_payment_id=provider_payment,paid_at=now(),refund_required=review where order_id=o.id;
  if o.collection_method is distinct from 'cash' and o.payment_status <> 'refunded' then
    update public.orders set payment_status='paid',
      collection_method=case when p.purpose='delivery' and not review then 'upi_delivery' else collection_method end,
      collected_at=case when p.purpose='delivery' and not review then now() else collected_at end,
      collected_by=case when p.purpose='delivery' and not review then rider_id else collected_by end,
      collection_reference=case when p.purpose='delivery' then provider_payment else collection_reference end,
      status=case when auto_deliver then 'delivered' else status end,
      delivered_at=case when auto_deliver then now() else delivered_at end
      where id=o.id returning * into o;
  end if;
  insert into public.order_events(order_id,status,actor,note) values(o.id,
    case when auto_deliver then 'delivered' else o.status end,'system',
    case when review then 'UPI payment received: refund/review required; delivery not auto-completed'
    when p.environment='sandbox' then 'TEST UPI payment verified; no real money collected'
    when auto_deliver then 'UPI at delivery verified by Cashfree; delivery auto-completed'
    when p.purpose='delivery' then 'UPI at delivery verified by Cashfree'
    else 'UPI prepaid verified by Cashfree' end);
  return jsonb_build_object('paid',true,'refund_required',review,'delivered',auto_deliver);
end; $$;

commit;
