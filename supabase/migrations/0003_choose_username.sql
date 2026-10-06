-- Citizen-chosen usernames.
-- Citizens may now pick their own username: at email sign-up (sent as
-- `username` in the auth metadata) and at any time from their profile page.
-- The email-derived name stays only as the fallback for sign-ups that do not
-- supply one (Google OAuth).

-- ---------------------------------------------------------------------------
-- username format — enforced whenever a citizen changes it
-- ---------------------------------------------------------------------------
-- Checked on change only, so names already derived from an email address
-- (which may contain other characters) stay valid until their owner edits
-- them. Keep the pattern in sync with src/lib/username.ts.
create or replace function public.validate_profile_username()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username !~ '^[A-Za-z0-9_.-]{3,20}$' then
    raise exception 'That username is not acceptable to the Party, citizen.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_profile_username_trigger on public.profiles;
create trigger validate_profile_username_trigger
  before update of username on public.profiles
  for each row
  when (new.username is distinct from old.username)
  execute function public.validate_profile_username();

-- ---------------------------------------------------------------------------
-- New citizen onboarding — prefer the username the citizen asked for
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  base_username text;
  final_username text;
  suffix int := 0;
  new_code text;
begin
  requested_username := new.raw_user_meta_data ->> 'username';

  if requested_username ~ '^[A-Za-z0-9_.-]{3,20}$' then
    base_username := requested_username;
  else
    base_username := coalesce(
      split_part(new.raw_user_meta_data ->> 'email', '@', 1),
      split_part(new.email, '@', 1),
      'citizen'
    );
  end if;
  final_username := base_username;

  -- A taken name gets a numeric suffix rather than failing the sign-up; the
  -- citizen can pick another from their profile.
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
