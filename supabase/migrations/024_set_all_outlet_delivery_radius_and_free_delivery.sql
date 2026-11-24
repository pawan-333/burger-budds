-- All outlets: six-kilometer delivery radius, GST disabled, and free delivery from INR 199.
-- Keep each outlet's existing base fee and per-kilometer rate.
-- Reconcile the target's migration history before applying this file.
begin;

update public.outlets
set delivery_radius_km = 6,
    gst_percent = 0,
    delivery_fee_rules = coalesce(delivery_fee_rules, '{}'::jsonb)
      || '{"free_above":199}'::jsonb;

commit;
