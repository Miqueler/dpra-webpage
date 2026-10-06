-- Email + password sign-up.
-- Citizens who register by email exist in auth.users before they have proven
-- they own the address, so the signup bonus moves from "row created" to
-- "email confirmed". Google sign-ups arrive already confirmed and are paid
-- immediately, as before.

-- ---------------------------------------------------------------------------
-- protect_profile_columns — let the Party's own functions through
-- ---------------------------------------------------------------------------
-- The original check used auth.role(), which reads the caller's JWT and so
-- stays 'authenticated' (or empty, for the auth server) inside the
-- security-definer functions that legitimately move coins. Running this
-- trigger as the invoker makes current_user the role actually performing the
-- write: 'authenticated'/'anon' for direct API updates, the function owner
-- for security-definer functions, 'service_role' for the machine routes.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.coins is distinct from old.coins
    or new.rank is distinct from old.rank
    or new.is_admin is distinct from old.is_admin
    or new.machine_code is distinct from old.machine_code
    or new.invited_by is distinct from old.invited_by
    or new.last_daily_bonus_at is distinct from old.last_daily_bonus_at
  then
    raise exception 'Only the Party may alter that field, citizen.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- signup bonus — paid once, only to confirmed citizens
-- ---------------------------------------------------------------------------
create or replace function public.grant_signup_bonus(target_user uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1 from public.coin_transactions
    where user_id = target_user and reason = 'signup_bonus'
  ) then
    return;
  end if;

  insert into public.coin_transactions (user_id, amount, reason)
  values (target_user, 50, 'signup_bonus');

  update public.profiles set coins = coins + 50 where id = target_user;
end;
$$;

-- Only the triggers below call this; keep it off the public API.
revoke execute on function public.grant_signup_bonus(uuid) from public, anon, authenticated;

-- New citizen onboarding: create the profile row on auth.users insert. The
-- bonus is paid here only if the email is already confirmed (Google OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
  new_code text;
begin
  base_username := coalesce(
    split_part(new.raw_user_meta_data ->> 'email', '@', 1),
    split_part(new.email, '@', 1),
    'citizen'
  );
  final_username := base_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  new_code := public.generate_machine_code();

  insert into public.profiles (id, username, avatar_url, machine_code)
  values (
    new.id,
    final_username,
    new.raw_user_meta_data ->> 'avatar_url',
    new_code
  );

  if new.email_confirmed_at is not null then
    perform public.grant_signup_bonus(new.id);
  end if;

  return new;
end;
$$;

-- Email sign-ups: pay the bonus when the confirmation link is followed.
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.grant_signup_bonus(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();
