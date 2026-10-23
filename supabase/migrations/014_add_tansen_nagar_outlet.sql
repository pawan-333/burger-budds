-- Tansen Nagar outlet requested and approved by the user on 2026-10-23.
-- Address/phone: user supplied. Map pin: public matching Yappe listing.
-- Public source: https://yappe.in/madhya-pradesh/gwalior/burger-budds/320313
-- Keep orders closed until verified timings and menu are configured.
-- No merchant credentials, memberships or other outlets are modified.
-- outlet-data: {"id":"e4b1ac8b-ce17-495c-81cd-5f73aec26e0b","slug":"burger-budds-tansen-nagar-gwalior","name":"Burger Budds — Tansen Nagar, Gwalior","address":"Ground floor, State Bank Choraha, near Tirupati Bajaj Showroom, New Colony, Birla Nagar, Gwalior, Madhya Pradesh 474004","area":"Tansen Nagar, Gwalior","lat":26.2280699,"lng":78.1820268,"phone":"+918224889318","is_open":false,"delivery_enabled":false,"is_active":true,"timings":{}}
begin;
insert into public.outlets(id,slug,name,address,area,lat,lng,phone,is_open,delivery_enabled,is_active,timings)
select id,slug,name,address,area,lat,lng,phone,is_open,delivery_enabled,is_active,timings
from jsonb_to_record($outlet${"id":"e4b1ac8b-ce17-495c-81cd-5f73aec26e0b","slug":"burger-budds-tansen-nagar-gwalior","name":"Burger Budds — Tansen Nagar, Gwalior","address":"Ground floor, State Bank Choraha, near Tirupati Bajaj Showroom, New Colony, Birla Nagar, Gwalior, Madhya Pradesh 474004","area":"Tansen Nagar, Gwalior","lat":26.2280699,"lng":78.1820268,"phone":"+918224889318","is_open":false,"delivery_enabled":false,"is_active":true,"timings":{}}$outlet$::jsonb)
as o(id uuid,slug text,name text,address text,area text,lat double precision,lng double precision,phone text,is_open boolean,delivery_enabled boolean,is_active boolean,timings jsonb)
on conflict(slug) do nothing;
commit;
