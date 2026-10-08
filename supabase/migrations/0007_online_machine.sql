-- The online ATZAR machine.
-- While the physical machine is being built, citizens can roll on the site
-- itself. It spends the same daily free roll and purchased rolls, and its
-- results land in the same play history and leaderboard. The Commissariat
-- switches it on and off from the admin page.

-- ---------------------------------------------------------------------------
-- atzar_settings — a single row of switches
-- ---------------------------------------------------------------------------
create table if not exists public.atzar_settings (
  -- Always true, so the table can never hold a second row.
  id boolean primary key default true check (id),
  online_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.atzar_settings default values
on conflict (id) do nothing;

alter table public.atzar_settings enable row level security;

create policy "citizens see whether the online machine is on"
  on public.atzar_settings for select
  to authenticated
  using (true);

-- No insert/update/delete policies: changed only through set_online_machine().

create or replace function public.set_online_machine(enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may operate the machine.';
  end if;

  if enabled is null then
    raise exception 'The machine is either on or off.';
  end if;

  update public.atzar_settings
  set online_enabled = enabled, updated_at = now(), updated_by = auth.uid();
end;
$$;

revoke execute on function public.set_online_machine(boolean) from public, anon;
grant execute on function public.set_online_machine(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- record_online_play — spend a roll and record the result, all or nothing
-- ---------------------------------------------------------------------------
-- Called by the site's own roll route (service role) after it has rolled the
-- number and scored it. Answers with what happened instead of raising, so the
-- route can tell the citizen why a roll was refused:
--   'free' / 'paid'  the play was recorded, using that kind of roll
--   'disabled'       the online machine is switched off
--   'no_rolls'       the citizen has no roll left today
create or replace function public.record_online_play(
  target_user uuid,
  play_score integer,
  play_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  today_roll public.daily_rolls;
  roll_kind text;
begin
  if not (select online_enabled from public.atzar_settings) then
    return 'disabled';
  end if;

  insert into public.daily_rolls (user_id, roll_date)
  values (target_user, current_date)
  on conflict (user_id, roll_date) do nothing;

  -- Locked, so two rolls sent at once cannot both spend the same roll.
  select * into today_roll
  from public.daily_rolls
  where user_id = target_user and roll_date = current_date
  for update;

  if not today_roll.free_roll_used then
    update public.daily_rolls set free_roll_used = true where id = today_roll.id;
    roll_kind := 'free';
  elsif today_roll.extra_rolls > 0 then
    update public.daily_rolls set extra_rolls = extra_rolls - 1 where id = today_roll.id;
    roll_kind := 'paid';
  else
    return 'no_rolls';
  end if;

  insert into public.rng_sessions (user_id, score, payload, source)
  values (target_user, play_score, play_payload, 'online');

  return roll_kind;
end;
$$;

revoke execute on function public.record_online_play(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.record_online_play(uuid, integer, jsonb) to service_role;
