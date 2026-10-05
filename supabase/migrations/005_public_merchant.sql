-- Temporary public merchant access explicitly requested by the owner.
begin;
create or replace function public.transition_public_order(target_order_id uuid, acting_user uuid, next_status public.order_status, preparation_minutes integer default 20, rejection_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_order public.orders;
  staff_member boolean := true;
begin
  select * into current_order from public.orders where id = target_order_id for update;
  if current_order.id is null then raise exception 'Order not found'; end if;
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
revoke all on function public.transition_public_order(uuid, uuid, public.order_status, integer, text) from public, anon, authenticated;
grant execute on function public.transition_public_order(uuid, uuid, public.order_status, integer, text) to service_role;
commit;
