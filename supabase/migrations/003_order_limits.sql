begin;
create or replace function public.validate_order_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare selected_coupon public.coupons;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if exists (select 1 from public.orders where user_id = new.user_id and placed_at > now() - interval '10 seconds') then
    raise exception 'Please wait a few seconds before placing another order';
  end if;
  if new.coupon_code is not null then
    select * into selected_coupon from public.coupons where code = new.coupon_code for update;
    if selected_coupon.id is null or not selected_coupon.is_active or
      selected_coupon.starts_at > now() or selected_coupon.ends_at <= now() or
      new.item_total < selected_coupon.min_order then raise exception 'Coupon is no longer available'; end if;
    if selected_coupon.first_order_only and exists (
      select 1 from public.orders where user_id = new.user_id and status not in ('rejected', 'cancelled')
    ) then raise exception 'This coupon is for your first order only'; end if;
    if selected_coupon.usage_limit is not null and (
      select count(*) from public.orders where coupon_code = selected_coupon.code
    ) >= selected_coupon.usage_limit then raise exception 'Coupon usage limit reached'; end if;
  end if;
  return new;
end;
$$;
create trigger enforce_order_limits before insert on public.orders for each row execute function public.validate_order_limits();
commit;
