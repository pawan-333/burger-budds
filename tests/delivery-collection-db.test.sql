-- Run only through the temporary-table harness. Never substitute public for pg_temp.
create function pg_temp.assert_collection(condition boolean, label text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'Collection test failed: %',label; end if; end; $$;

insert into pg_temp.riders(id,name,phone) values
 ('10000000-0000-4000-8000-000000000001','Synthetic Rider A','9000000001'),
 ('10000000-0000-4000-8000-000000000002','Synthetic Rider B','9000000002');
insert into pg_temp.rider_accounts(rider_id,user_id,outlet_id) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002');

create function pg_temp.collection_fixture(number integer, method text default 'cod', state text default 'pending', environment text default null, total numeric default 150)
returns uuid language plpgsql as $$
declare id uuid := ('40000000-0000-4000-8000-' || lpad(number::text,12,'0'))::uuid;
begin
  insert into pg_temp.orders(id,order_no,customer_name,customer_phone,outlet_id,order_type,status,
    item_total,tax,grand_total,payment_method,payment_status,payment_environment,rider_id)
  values(id,'SYNTHETIC-COLLECTION-' || number,'Synthetic Customer','9000000003','30000000-0000-4000-8000-000000000001',
    'delivery','out_for_delivery',total,0,total,method::public.payment_method_type,state,environment,'10000000-0000-4000-8000-000000000001');
  return id;
end; $$;

do $$
declare
  o uuid; p uuid; result jsonb; events_before bigint;
  rider_user uuid := '20000000-0000-4000-8000-000000000001';
  provider text;
begin
  o := pg_temp.collection_fixture(1);
  begin perform pg_temp.complete_rider_delivery(o,'20000000-0000-4000-8000-000000000002','cash'); raise exception 'Wrong rider accepted'; exception when insufficient_privilege then null; end;
  update pg_temp.rider_accounts set outlet_id='30000000-0000-4000-8000-000000000002' where user_id=rider_user;
  begin perform pg_temp.start_rider_payment(o,rider_user,'production'); raise exception 'Wrong outlet accepted'; exception when insufficient_privilege then null; end;
  update pg_temp.rider_accounts set outlet_id='30000000-0000-4000-8000-000000000001',is_active=false where user_id=rider_user;
  begin perform pg_temp.complete_rider_delivery(o,rider_user,'cash'); raise exception 'Inactive account accepted'; exception when insufficient_privilege then null; end;
  update pg_temp.rider_accounts set is_active=true where user_id=rider_user;
  update pg_temp.riders set is_active=false where id='10000000-0000-4000-8000-000000000001';
  begin perform pg_temp.start_rider_payment(o,rider_user,'production'); raise exception 'Inactive rider accepted'; exception when insufficient_privilege then null; end;
  update pg_temp.riders set is_active=true where id='10000000-0000-4000-8000-000000000001';
  begin perform pg_temp.complete_rider_delivery(o,rider_user); raise exception 'Unconfirmed cash accepted'; exception when invalid_parameter_value then null; end;
  begin perform pg_temp.complete_rider_delivery(o,rider_user,'upi_delivery'); raise exception 'Self-reported UPI accepted'; exception when invalid_parameter_value then null; end;
  perform pg_temp.complete_rider_delivery(o,rider_user,'cash');
  perform pg_temp.assert_collection((select status='delivered' and payment_status='paid' and collection_method='cash' and collected_by=rider_id and collected_at is not null from pg_temp.orders where id=o),'cash audit and delivery');
  select count(*) into events_before from pg_temp.order_events where order_id=o;
  perform pg_temp.complete_rider_delivery(o,rider_user,'cash');
  perform pg_temp.assert_collection((select count(*)=events_before from pg_temp.order_events where order_id=o),'cash completion idempotent');

  o := pg_temp.collection_fixture(2);
  begin perform pg_temp.start_rider_payment(o,rider_user,'sandbox'); raise exception 'Sandbox accepted real COD'; exception when invalid_parameter_value then null; end;
  o := pg_temp.collection_fixture(3,'cod','pending','sandbox');
  begin perform pg_temp.start_rider_payment(o,rider_user,'production'); raise exception 'Production accepted sandbox COD'; exception when invalid_parameter_value then null; end;
  perform pg_temp.start_rider_payment(o,rider_user,'sandbox');
  perform pg_temp.start_rider_payment(o,rider_user,'sandbox');
  perform pg_temp.assert_collection((select count(*)=1 from pg_temp.cashfree_payments where order_id=o),'single payment record');
  begin perform pg_temp.complete_rider_delivery(o,rider_user,'cash'); raise exception 'Cash accepted during pending UPI'; exception when invalid_parameter_value then null; end;
  begin update pg_temp.orders set status='delivered',payment_status='paid' where id=o; raise exception 'Legacy merchant bypass accepted'; exception when raise_exception then if SQLERRM='Legacy merchant bypass accepted' then raise; end if; end;
  provider := 'bb_' || replace(o::text,'-','');
  begin perform pg_temp.confirm_cashfree_payment(o,provider,'123001',1); raise exception 'Wrong amount accepted'; exception when raise_exception then if SQLERRM='Wrong amount accepted' then raise; end if; end;
  perform pg_temp.confirm_cashfree_payment(o,provider,'123001',150);
  perform pg_temp.assert_collection((select payment_method::text='cod' and payment_status='paid' and collection_method='upi_delivery' and collection_reference='123001' and collected_by=rider_id from pg_temp.orders where id=o),'verified UPI audit, COD origin preserved');
  select count(*) into events_before from pg_temp.order_events where order_id=o;
  perform pg_temp.confirm_cashfree_payment(o,provider,'123001',150);
  perform pg_temp.assert_collection((select count(*)=events_before from pg_temp.order_events where order_id=o),'callback idempotent');
  begin perform pg_temp.confirm_cashfree_payment(o,provider,'123002',150); raise exception 'Second payment identity accepted'; exception when raise_exception then if SQLERRM='Second payment identity accepted' then raise; end if; end;
  perform pg_temp.complete_rider_delivery(o,rider_user);

  o := pg_temp.collection_fixture(4,'cod','pending','sandbox');
  perform pg_temp.start_rider_payment(o,rider_user,'sandbox');
  perform pg_temp.expire_cashfree_order(o);
  perform pg_temp.assert_collection((select status='out_for_delivery' and payment_status='pending' from pg_temp.orders where id=o),'delivery payment expiry keeps food order');
  perform pg_temp.complete_rider_delivery(o,rider_user,'cash');
  result := pg_temp.confirm_cashfree_payment(o,'bb_' || replace(o::text,'-',''),'123004',150);
  perform pg_temp.assert_collection((result->>'refund_required')::boolean,'late paid cash requires refund');
  perform pg_temp.assert_collection((select collection_method='cash' and collection_reference is null from pg_temp.orders where id=o),'late UPI preserves cash audit');

  o := pg_temp.collection_fixture(5,'cashfree','pending','sandbox');
  update pg_temp.orders set status='placed' where id=o;
  insert into pg_temp.cashfree_payments(order_id,outlet_id,provider_order_id,amount,environment)
    values(o,'30000000-0000-4000-8000-000000000001','bb_' || replace(o::text,'-',''),150,'sandbox');
  perform pg_temp.expire_cashfree_order(o);
  perform pg_temp.assert_collection((select status='cancelled' and payment_status='failed' from pg_temp.orders where id=o),'prepaid expiry compatibility');
  result := pg_temp.confirm_cashfree_payment(o,'bb_' || replace(o::text,'-',''),'123005',150);
  perform pg_temp.assert_collection((result->>'refund_required')::boolean,'late cancelled prepaid refund');

  o := pg_temp.collection_fixture(6,'cod','refunded');
  begin perform pg_temp.complete_rider_delivery(o,rider_user,'cash'); raise exception 'Refunded order collected'; exception when invalid_parameter_value then null; end;
  o := pg_temp.collection_fixture(7,'cod','pending',null,0);
  perform pg_temp.complete_rider_delivery(o,rider_user);
  perform pg_temp.assert_collection((select status='delivered' and grand_total=0 from pg_temp.orders where id=o),'zero COD delivery');
  o := pg_temp.collection_fixture(8,'cashfree','paid','production');
  perform pg_temp.complete_rider_delivery(o,rider_user);
  perform pg_temp.assert_collection((select status='delivered' and collection_method is null from pg_temp.orders where id=o),'prepaid delivery has no cash declaration');
  o := pg_temp.collection_fixture(9,'cod','pending','sandbox');
  perform pg_temp.start_rider_payment(o,rider_user,'sandbox');
  update pg_temp.orders set status='cancelled' where id=o;
  result := pg_temp.confirm_cashfree_payment(o,'bb_' || replace(o::text,'-',''),'123009',150);
  perform pg_temp.assert_collection((result->>'refund_required')::boolean,'cancelled delivery UPI refund');
  o := pg_temp.collection_fixture(10,'cod','pending','sandbox');
  perform pg_temp.start_rider_payment(o,rider_user,'sandbox');
  perform pg_temp.confirm_cashfree_payment(o,'bb_' || replace(o::text,'-',''),'123010',150);
  update pg_temp.orders set status='cancelled' where id=o;
  perform pg_temp.assert_collection((select refund_required from pg_temp.cashfree_payments where order_id=o),'cancellation after delivery UPI flags refund');

  perform pg_temp.assert_collection(not has_function_privilege('anon','pg_temp.start_rider_payment(uuid,uuid,text)','execute'),'anonymous start denied');
  perform pg_temp.assert_collection(not has_function_privilege('authenticated','pg_temp.complete_rider_delivery(uuid,uuid,text)','execute'),'authenticated direct completion denied');
  perform pg_temp.assert_collection(has_function_privilege('service_role','pg_temp.confirm_cashfree_payment(uuid,text,text,numeric)','execute'),'service confirmation granted');
end; $$;
select 'PASS: synthetic temporary-table collection/expiry/authorization/refund checks; transaction will roll back' as result;
