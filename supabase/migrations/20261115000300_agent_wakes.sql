begin;
create table if not exists public.vynex_agent_wakes(owner_id uuid primary key references public.vynex_profiles(id) on delete cascade, nonce uuid not null default gen_random_uuid(), updated_at timestamptz not null default now());
alter table public.vynex_agent_wakes enable row level security;
revoke all on public.vynex_agent_wakes from anon,authenticated;
grant all on public.vynex_agent_wakes to service_role;
commit;
