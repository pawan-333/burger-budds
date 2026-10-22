begin;
create table public.auth_rate_limits(key text primary key,count integer not null,reset_at timestamptz not null);
alter table public.auth_rate_limits enable row level security;
create function public.consume_auth_limit(target_key text,max_requests integer,window_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$ declare n integer; begin
 insert into public.auth_rate_limits values(target_key,1,now()+make_interval(secs=>window_seconds)) on conflict(key) do update set count=case when auth_rate_limits.reset_at<=now() then 1 else auth_rate_limits.count+1 end,reset_at=case when auth_rate_limits.reset_at<=now() then now()+make_interval(secs=>window_seconds) else auth_rate_limits.reset_at end returning count into n;
 return n<=max_requests; end; $$;
revoke all on function public.consume_auth_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_auth_limit(text,integer,integer) to service_role;
commit;
