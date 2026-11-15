begin read only;
select jsonb_build_object(
  'collection_columns', (select count(*)=4 from information_schema.columns where table_schema='public' and table_name='orders'
    and column_name in ('collection_method','collected_at','collected_by','collection_reference')),
  'purpose_column', exists(select 1 from information_schema.columns where table_schema='public' and table_name='cashfree_payments' and column_name='purpose' and is_nullable='NO'),
  'old_completion_removed', to_regprocedure('public.complete_rider_delivery(uuid,uuid)') is null,
  'new_completion_exists', to_regprocedure('public.complete_rider_delivery(uuid,uuid,text)') is not null,
  'rpc_grants', (select jsonb_agg(jsonb_build_object('function',p.oid::regprocedure::text,
    'service',has_function_privilege('service_role',p.oid,'execute'),
    'anon',has_function_privilege('anon',p.oid,'execute'),
    'authenticated',has_function_privilege('authenticated',p.oid,'execute'),
    'definer',p.prosecdef,'search_path',p.proconfig)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('start_rider_payment','complete_rider_delivery','confirm_cashfree_payment','expire_cashfree_order')),
  'rls', (select jsonb_agg(jsonb_build_object('table',relname,'enabled',relrowsecurity)) from pg_class
    where oid in ('public.orders'::regclass,'public.cashfree_payments'::regclass,'public.rider_accounts'::regclass)),
  'guards', (select jsonb_agg(t.tgname) from pg_trigger t where t.tgrelid='public.orders'::regclass
    and t.tgname in ('guard_cashfree_fulfilment','guard_delivery_collection') and t.tgenabled='O'),
  'existing_payment_guard_md5', md5(pg_get_functiondef('public.guard_cashfree_fulfilment()'::regprocedure)),
  'delivery_guard_definer', (select prosecdef from pg_proc where oid='public.guard_delivery_collection()'::regprocedure)
) as postflight;
rollback;
