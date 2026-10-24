-- Badagaon: free delivery from INR 349; otherwise a flat INR 29 within its delivery zone.
-- outlet-slug: burger-budds-badagaon-gwalior
-- outlet-fee-patch: {"base_fee":29,"free_above":349,"per_km_above_3km":0}
begin;
update public.outlets
set delivery_fee_rules = coalesce(delivery_fee_rules, '{}'::jsonb)
  || '{"base_fee":29,"free_above":349,"per_km_above_3km":0}'::jsonb
where slug = 'burger-budds-badagaon-gwalior';
commit;
