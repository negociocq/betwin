begin;
create table if not exists public.vynex_profiles (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid unique references auth.users(id) on delete cascade,
 username text unique check(username is null or username ~ '^[a-z0-9_.-]{3,32}$'),
 name text not null check(length(name) between 2 and 80),
 email text unique, is_owner boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.vynex_sessions (
 token_hash text primary key check(length(token_hash)=64),
 profile_id uuid not null references public.vynex_profiles(id) on delete cascade,
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index if not exists vynex_sessions_profile on public.vynex_sessions(profile_id);
create index if not exists vynex_sessions_expiry on public.vynex_sessions(expires_at);
create table if not exists public.vynex_legacy_auth (
 profile_id uuid primary key references public.vynex_profiles(id) on delete cascade,
 salt text not null, password_hash text not null
);
create table if not exists public.vynex_workspaces (
 owner_id uuid primary key references public.vynex_profiles(id) on delete cascade,
 payload text not null, version bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table if not exists public.vynex_auth_attempts (
 key text primary key, attempts integer not null, until_at timestamptz not null
);
alter table public.vynex_profiles enable row level security;
alter table public.vynex_sessions enable row level security;
alter table public.vynex_legacy_auth enable row level security;
alter table public.vynex_workspaces enable row level security;
alter table public.vynex_auth_attempts enable row level security;
revoke all on public.vynex_profiles, public.vynex_sessions, public.vynex_legacy_auth, public.vynex_workspaces, public.vynex_auth_attempts from anon, authenticated;
grant select on public.vynex_profiles to authenticated;
grant all on public.vynex_profiles, public.vynex_sessions, public.vynex_legacy_auth, public.vynex_workspaces, public.vynex_auth_attempts to service_role;
drop policy if exists vynex_profile_self on public.vynex_profiles;
create policy vynex_profile_self on public.vynex_profiles for select to authenticated using(auth_user_id=(select auth.uid()));
create or replace function public.vynex_new_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.vynex_profiles(id,auth_user_id,name,username,email)
 values(new.id,new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Usuário Vynex'),80),nullif(lower(trim(new.raw_user_meta_data->>'username')),''),lower(new.email));
 return new;
end $$;
drop trigger if exists vynex_new_auth_user on auth.users;
create trigger vynex_new_auth_user after insert on auth.users for each row execute function public.vynex_new_auth_user();
create or replace function public.vynex_auth_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.encrypted_password is distinct from new.encrypted_password or old.banned_until is distinct from new.banned_until then
  delete from public.vynex_sessions where profile_id in(select id from public.vynex_profiles where auth_user_id=new.id);
 end if;
 if old.email is distinct from new.email then update public.vynex_profiles set email=lower(new.email) where auth_user_id=new.id; end if;
 return new;
end $$;
drop trigger if exists vynex_auth_changed on auth.users;
create trigger vynex_auth_changed after update of encrypted_password,banned_until,email on auth.users for each row execute function public.vynex_auth_changed();
create or replace function public.vynex_auth_throttle(p_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare count_now integer;
begin
 insert into public.vynex_auth_attempts(key,attempts,until_at) values(p_key,1,now()+interval '15 minutes')
 on conflict(key) do update set attempts=case when public.vynex_auth_attempts.until_at<=now() then 1 else public.vynex_auth_attempts.attempts+1 end,
 until_at=case when public.vynex_auth_attempts.until_at<=now() then now()+interval '15 minutes' else public.vynex_auth_attempts.until_at end returning attempts into count_now;
 delete from public.vynex_auth_attempts where until_at<now()-interval '1 day';
 return count_now<=10;
end $$;
revoke all on function public.vynex_auth_throttle(text) from public,anon,authenticated;
grant execute on function public.vynex_auth_throttle(text) to service_role;
revoke all on function public.vynex_new_auth_user(),public.vynex_auth_changed() from public,anon,authenticated;
commit;
