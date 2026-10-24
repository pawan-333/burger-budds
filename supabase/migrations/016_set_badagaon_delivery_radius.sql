-- User confirmed Badagaon delivery radius should be 6km on 2026-10-24.
-- Changes only this outlet's radius; coordinates, hours and other settings remain unchanged.
-- outlet-slug: burger-budds-badagaon-gwalior
-- outlet-patch: {"delivery_radius_km":6}
begin;
update public.outlets set delivery_radius_km=6 where slug='burger-budds-badagaon-gwalior';
commit;
