-- User approved Badagaon daily hours: 11:00 AM to 9:30 PM on 2026-10-24.
-- Re-enable accepting orders; computed opening status still follows India-time hours.
-- outlet-slug: burger-budds-badagaon-gwalior
-- outlet-patch: {"is_open":true,"pause_until":null,"timings":{"open":"11:00","close":"21:30"}}
begin;
update public.outlets
set is_open=true,pause_until=null,timings='{"open":"11:00","close":"21:30"}'::jsonb
where slug='burger-budds-badagaon-gwalior';
commit;
