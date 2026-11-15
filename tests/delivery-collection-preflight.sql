begin read only;
select jsonb_build_object(
  'database', current_database(),
  'columns', (select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable,'default',column_default))
    from information_schema.columns where table_schema='public' and table_name in ('orders','cashfree_payments','rider_accounts','riders','order_events')),
  'functions', (select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('start_rider_payment','complete_rider_delivery','confirm_cashfree_payment','expire_cashfree_order','guard_cashfree_fulfilment','guard_delivery_collection','assign_order_rider')),
  'triggers', (select jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(p.oid)))
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
    where n.nspname='public' and c.relname in ('orders','cashfree_payments') and not t.tgisinternal),
  'constraints', (select jsonb_agg(jsonb_build_object('table',c.relname,'name',s.conname,'definition',pg_get_constraintdef(s.oid)))
    from pg_constraint s join pg_class c on c.oid=s.conrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('orders','cashfree_payments','rider_accounts','riders','order_events')),
  'rls', (select jsonb_agg(jsonb_build_object('table',relname,'enabled',relrowsecurity,'forced',relforcerowsecurity))
    from pg_class where oid in ('public.orders'::regclass,'public.cashfree_payments'::regclass,'public.rider_accounts'::regclass)),
  'delivery_states', (select jsonb_agg(x) from (select status,payment_method,payment_status,count(*) from public.orders
    where status='out_for_delivery' group by status,payment_method,payment_status) x)
) as preflight;
rollback;
