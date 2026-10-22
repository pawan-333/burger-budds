begin;
-- Deny direct browser writes to money-bearing orders and privileged outlet fields.
revoke update on public.orders from authenticated,anon;
revoke update on public.outlets from authenticated,anon;
revoke update on public.items from authenticated,anon;
revoke update on public.profiles from authenticated,anon;
grant update(name,email,phone) on public.profiles to authenticated;
-- Restrict new identity roles through administrator provisioning.
create or replace function public.sync_membership_to_staff() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if TG_OP='DELETE' then delete from public.staff where user_id=old.user_id and outlet_id=old.outlet_id; return old; end if;
 insert into public.staff(user_id,outlet_id,role) values(new.user_id,new.outlet_id,case new.role when 'franchise_owner' then 'owner'::public.staff_role when 'outlet_manager' then 'manager'::public.staff_role else 'staff'::public.staff_role end) on conflict(user_id,outlet_id) do update set role=excluded.role;
 return new; end; $$;
create trigger sync_membership_to_staff after insert or update or delete on public.outlet_memberships for each row execute function public.sync_membership_to_staff();
commit;
