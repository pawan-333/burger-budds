begin;
alter table public.coupons add column outlet_id uuid references public.outlets(id);
alter table public.coupons add column approval_status text not null default 'approved' check(approval_status in ('pending','approved','rejected'));
alter table public.coupons add column per_user_limit integer not null default 1;
create table public.brand_settings(id boolean primary key default true check(id),coin_earn_percent numeric not null default 5,coin_redeem_percent numeric not null default 20,referral_reward numeric not null default 50,referral_min_order numeric not null default 199);
insert into public.brand_settings(id) values(true);
alter table public.brand_settings enable row level security;
create policy "Read brand settings" on public.brand_settings for select using(true);
create table public.coupon_redemptions(id uuid primary key default gen_random_uuid(),coupon_id uuid references public.coupons(id),order_id uuid unique references public.orders(id),user_id uuid references auth.users(id),identity_hash text not null,created_at timestamptz default now());
alter table public.coupon_redemptions enable row level security;
create table public.coin_reservations(order_id uuid primary key references public.orders(id),user_id uuid not null references auth.users(id),amount numeric not null check(amount>=0),state text not null default 'reserved' check(state in ('reserved','redeemed','released')));
alter table public.coin_reservations enable row level security;
create policy "Read own coin holds" on public.coin_reservations for select using(user_id=auth.uid());
alter function public.create_order_atomic(jsonb,text) rename to create_order_legacy;
create or replace function public.create_order_atomic(order_payload jsonb,request_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; c public.coupons; u uuid:=(order_payload->>'user_id')::uuid; identity text:=coalesce(u::text,order_payload->>'guest_session_hash'); used numeric:=coalesce((order_payload->>'wallet_used')::numeric,0); available numeric; count_used integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(identity||request_key,0));
 select to_jsonb(o) into result from public.orders o where coalesce(o.user_id::text,o.guest_session_hash)=identity and o.idempotency_key=request_key;
 if result is not null then return result||jsonb_build_object('items',(select jsonb_agg(i) from public.order_items i where order_id=(result->>'id')::uuid)); end if;
 if nullif(order_payload->>'coupon_code','') is not null then
 select * into c from public.coupons where upper(code)=upper(order_payload->>'coupon_code') for update;
 if c.id is null or not c.is_active or c.approval_status<>'approved' or c.starts_at>now() or c.ends_at<=now() or (c.outlet_id is not null and c.outlet_id<>(order_payload->>'outlet_id')::uuid) or c.min_order>(order_payload->>'item_total')::numeric then raise exception 'Coupon invalid'; end if;
 select count(*) into count_used from public.coupon_redemptions where coupon_id=c.id;
 if c.usage_limit is not null and count_used>=c.usage_limit then raise exception 'Coupon exhausted'; end if;
 if (select count(*) from public.coupon_redemptions where coupon_id=c.id and identity_hash=identity)>=c.per_user_limit then raise exception 'Coupon already used'; end if;
 if c.first_order_only and (u is null or exists(select 1 from public.orders where user_id=u and status not in ('cancelled','rejected'))) then raise exception 'First order coupon requires a new authenticated customer'; end if;
 end if;
 if used>0 then
 if u is null then raise exception 'Login required for coins'; end if;
 select wallet_balance into available from public.profiles where id=u for update;
 available:=available-coalesce((select sum(amount) from public.coin_reservations where user_id=u and state='reserved'),0);
 if available is null or used>available then raise exception 'Insufficient coins'; end if;
 end if;
 result:=public.create_order_legacy(order_payload,request_key);
 update public.orders set wallet_used=used where id=(result->>'id')::uuid;
 if used>0 then insert into public.coin_reservations(order_id,user_id,amount) values((result->>'id')::uuid,u,used); end if;
 if c.id is not null then insert into public.coupon_redemptions(coupon_id,order_id,user_id,identity_hash) values(c.id,(result->>'id')::uuid,u,identity); end if;
 return result||jsonb_build_object('wallet_used',used);
end; $$;
revoke all on function public.create_order_atomic(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_order_atomic(jsonb,text) to service_role;
create unique index wallet_order_type_once on public.wallet_transactions(user_id,ref_order_id,type) where ref_order_id is not null;
create or replace function public.apply_order_coins() returns trigger language plpgsql security definer set search_path=public as $$ declare r public.coin_reservations; reward numeric; begin
 if new.user_id is null then return new; end if;
 select * into r from public.coin_reservations where order_id=new.id for update;
 if new.status in ('cancelled','rejected') and r.state='reserved' then update public.coin_reservations set state='released' where order_id=new.id;
 elsif new.payment_status='paid' and r.state='reserved' then
 update public.profiles set wallet_balance=wallet_balance-r.amount where id=r.user_id;
 insert into public.wallet_transactions(user_id,amount,type,ref_order_id) values(r.user_id,r.amount,'debit',new.id) on conflict do nothing;
 update public.coin_reservations set state='redeemed' where order_id=new.id;
 end if;
 if new.payment_status='paid' and new.status='delivered' and old.status<>'delivered' then
 select floor(new.grand_total*coin_earn_percent/100) into reward from public.brand_settings;
 insert into public.wallet_transactions(user_id,amount,type,ref_order_id) values(new.user_id,reward,'credit',new.id) on conflict do nothing;
 if found then update public.profiles set wallet_balance=wallet_balance+reward where id=new.user_id; end if;
 end if;
 return new; end; $$;
create trigger apply_order_coins after update on public.orders for each row execute function public.apply_order_coins();
commit;
