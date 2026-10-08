-- Privacy policy acceptance.
-- New citizens are asked to accept the privacy policy (/privacy) the first
-- time they log in; the site keeps asking until they do. Citizens who already
-- had an account when this was introduced are marked as having accepted.

alter table public.profiles
  add column if not exists privacy_accepted_at timestamptz;

-- Everyone who is already here.
update public.profiles
set privacy_accepted_at = now()
where privacy_accepted_at is null;

-- Records the logged-in citizen's acceptance. The first date is kept if it is
-- called again.
create or replace function public.accept_privacy_policy()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Identify yourself first, citizen.';
  end if;

  update public.profiles
  set privacy_accepted_at = now()
  where id = auth.uid() and privacy_accepted_at is null;
end;
$$;

revoke execute on function public.accept_privacy_policy() from public, anon;
grant execute on function public.accept_privacy_policy() to authenticated;
