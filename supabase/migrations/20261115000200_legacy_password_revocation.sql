begin;
create or replace function public.vynex_auth_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.encrypted_password is distinct from new.encrypted_password or old.banned_until is distinct from new.banned_until then
  delete from public.vynex_sessions where profile_id in(select id from public.vynex_profiles where auth_user_id=new.id);
  delete from public.vynex_legacy_auth where profile_id in(select id from public.vynex_profiles where auth_user_id=new.id);
 end if;
 if old.email is distinct from new.email then update public.vynex_profiles set email=lower(new.email) where auth_user_id=new.id; end if;
 return new;
end $$;
revoke all on function public.vynex_auth_changed() from public,anon,authenticated;
commit;
