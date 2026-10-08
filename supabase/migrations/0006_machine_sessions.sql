-- Linking a play from the machine's side.
-- Citizens used to carry a permanent machine code and type it into the ATZAR
-- machine. Now the machine asks for a short-lived code when someone presses
-- play, shows it on its screen, and the citizen types it into /atzar to link
-- that play to their account. One code is good for one play.
--
-- profiles.machine_code is no longer used by the site. It is left in place so
-- that running this file loses nothing.

-- ---------------------------------------------------------------------------
-- machine_sessions — one row per code the machine has shown
-- ---------------------------------------------------------------------------
create table if not exists public.machine_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  used_at timestamptz
);

alter table public.machine_sessions enable row level security;

-- No policies: citizens never read or write this table directly. They go
-- through claim_machine_session() below; the machine routes use the service
-- role.
revoke all on public.machine_sessions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_machine_session — called by the machine route when play is pressed
-- ---------------------------------------------------------------------------
create or replace function public.create_machine_session()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- No 0/O or 1/I, so the code can be read off the machine and typed in.
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  -- Codes are single-use and short-lived; old rows are only clutter.
  delete from public.machine_sessions s
  where s.expires_at < now() - interval '1 day';

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.machine_sessions s where s.code = new_code
    );
  end loop;

  return query
  insert into public.machine_sessions as s (code, expires_at)
  values (new_code, now() + interval '10 minutes')
  returning s.code, s.expires_at;
end;
$$;

revoke execute on function public.create_machine_session() from public, anon, authenticated;
grant execute on function public.create_machine_session() to service_role;

-- ---------------------------------------------------------------------------
-- claim_machine_session — the citizen types the machine's code into /atzar
-- ---------------------------------------------------------------------------
create or replace function public.claim_machine_session(session_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := upper(btrim(coalesce(session_code, '')));
  target public.machine_sessions;
begin
  if auth.uid() is null then
    raise exception 'Identify yourself first, citizen.';
  end if;

  select * into target
  from public.machine_sessions
  where code = cleaned
  for update;

  if not found or target.used_at is not null or target.expires_at <= now() then
    raise exception 'That code is unknown or has expired, citizen.';
  end if;

  if target.user_id is not null and target.user_id <> auth.uid() then
    raise exception 'That code has already been claimed by another citizen.';
  end if;

  -- Claiming restarts the clock, so the citizen has time to actually play.
  update public.machine_sessions
  set user_id = auth.uid(),
      claimed_at = coalesce(claimed_at, now()),
      expires_at = now() + interval '10 minutes'
  where id = target.id;
end;
$$;

revoke execute on function public.claim_machine_session(text) from public, anon;
grant execute on function public.claim_machine_session(text) to authenticated;
