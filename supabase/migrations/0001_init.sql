-- DPRA / ATZAR schema
-- Citizens (profiles), the coin ledger, daily roll tracking, machine play
-- history, and friendships. Scoring itself happens on the physical ATZAR
-- machine — this schema only stores and displays results.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar_url text,
  rank text not null default 'Citizen',
  coins integer not null default 0,
  is_admin boolean not null default false,
  machine_code text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  last_daily_bonus_at date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by authenticated citizens"
  on public.profiles for select
  to authenticated
  using (true);

create policy "citizens may update their own display fields"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Row policy above allows the owner to UPDATE their row, but coins / rank /
-- is_admin / machine_code / invited_by must stay out of citizen hands. RLS is
-- row-level only, so a trigger enforces the column restriction.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
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

create trigger protect_profile_columns_trigger
  before update on public.profiles
  for each row
  execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- coin_transactions — append-only ledger
-- ---------------------------------------------------------------------------
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text not null check (
    reason in (
      'signup_bonus',
      'daily_bonus',
      'invite_bonus',
      'admin_grant',
      'event_grant',
      'roll_purchase'
    )
  ),
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.coin_transactions enable row level security;

create policy "citizens read their own ledger"
  on public.coin_transactions for select
  to authenticated
  using (user_id = auth.uid());

create policy "admins read every ledger"
  on public.coin_transactions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

-- No insert/update/delete policies: the ledger is only ever written by
-- security-definer functions (below) or the service role.

-- ---------------------------------------------------------------------------
-- daily_rolls — one row per citizen per day
-- ---------------------------------------------------------------------------
create table if not exists public.daily_rolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  roll_date date not null default current_date,
  free_roll_used boolean not null default false,
  extra_rolls integer not null default 0,
  unique (user_id, roll_date)
);

alter table public.daily_rolls enable row level security;

create policy "citizens read their own roll record"
  on public.daily_rolls for select
  to authenticated
  using (user_id = auth.uid());

-- No direct insert/update: mutated only via buy_roll()/the machine ingestion
-- route, both of which run with elevated privilege.

-- ---------------------------------------------------------------------------
-- rng_sessions — results reported by the physical machine
-- ---------------------------------------------------------------------------
create table if not exists public.rng_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  score integer,
  payload jsonb,
  source text not null default 'machine',
  played_at timestamptz not null default now()
);

alter table public.rng_sessions enable row level security;

create policy "citizens read their own play history"
  on public.rng_sessions for select
  to authenticated
  using (user_id = auth.uid());

-- Inserts only via the service-role machine ingestion route.

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friendships enable row level security;

create policy "citizens see requests involving them"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "citizens send requests"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "recipients accept requests"
  on public.friendships for update
  to authenticated
  using (auth.uid() = friend_id)
  with check (auth.uid() = friend_id);

create policy "either side may withdraw"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Declared here rather than alongside rng_sessions because it references
-- friendships, which must exist first.
create policy "citizens read friends' play history"
  on public.rng_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.user_id = auth.uid() and f.friend_id = rng_sessions.user_id)
          or (f.friend_id = auth.uid() and f.user_id = rng_sessions.user_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- leaderboard view — score only, no coin balances exposed
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard as
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  p.rank,
  max(r.score) as best_score,
  count(r.id) as plays
from public.profiles p
join public.rng_sessions r on r.user_id = p.id
group by p.id, p.username, p.avatar_url, p.rank;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.generate_machine_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  exists_already boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.profiles where machine_code = code) into exists_already;
    if not exists_already then
      return code;
    end if;
  end loop;
end;
$$;

-- New citizen onboarding: create profile row + signup bonus, fired on
-- auth.users insert (Google OAuth via Supabase Auth).
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

  insert into public.coin_transactions (user_id, amount, reason)
  values (new.id, 50, 'signup_bonus');

  update public.profiles set coins = coins + 50 where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Admin coin grant. Only callable by an authenticated admin.
create or replace function public.grant_coins(
  target_user uuid,
  amount integer,
  grant_reason text,
  grant_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may grant coins.';
  end if;

  if grant_reason not in ('admin_grant', 'event_grant') then
    raise exception 'Invalid grant reason.';
  end if;

  insert into public.coin_transactions (user_id, amount, reason, note, created_by)
  values (target_user, amount, grant_reason, grant_note, auth.uid());

  update public.profiles set coins = coins + amount where id = target_user;
end;
$$;

-- One coin bonus per citizen per day.
create or replace function public.claim_daily_bonus()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  bonus_amount integer := 10;
  already_claimed date;
begin
  select last_daily_bonus_at into already_claimed
  from public.profiles where id = auth.uid();

  if already_claimed = current_date then
    raise exception 'The daily bonus has already been distributed today, citizen.';
  end if;

  insert into public.coin_transactions (user_id, amount, reason)
  values (auth.uid(), bonus_amount, 'daily_bonus');

  update public.profiles
  set coins = coins + bonus_amount, last_daily_bonus_at = current_date
  where id = auth.uid();

  return bonus_amount;
end;
$$;

-- Redeem an invite: grants both the inviter and the new citizen a bonus.
-- Callable once per profile (invited_by must still be null).
create or replace function public.redeem_invite(inviter_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inviter_id uuid;
  bonus_amount integer := 25;
  already_invited uuid;
begin
  select invited_by into already_invited from public.profiles where id = auth.uid();
  if already_invited is not null then
    raise exception 'An invitation has already been redeemed for this citizen.';
  end if;

  select id into inviter_id from public.profiles where username = inviter_username;
  if inviter_id is null then
    raise exception 'Unknown sponsor.';
  end if;
  if inviter_id = auth.uid() then
    raise exception 'A citizen cannot sponsor themself.';
  end if;

  update public.profiles set invited_by = inviter_id where id = auth.uid();

  insert into public.coin_transactions (user_id, amount, reason)
  values (auth.uid(), bonus_amount, 'invite_bonus'), (inviter_id, bonus_amount, 'invite_bonus');

  update public.profiles set coins = coins + bonus_amount where id = auth.uid();
  update public.profiles set coins = coins + bonus_amount where id = inviter_id;
end;
$$;

-- Spend coins for an extra roll, credited to today's daily_rolls row.
create or replace function public.buy_roll()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  roll_cost integer := 20;
  balance integer;
begin
  select coins into balance from public.profiles where id = auth.uid();
  if balance < roll_cost then
    raise exception 'Insufficient coins, citizen.';
  end if;

  insert into public.daily_rolls (user_id, roll_date, extra_rolls)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, roll_date)
  do update set extra_rolls = public.daily_rolls.extra_rolls + 1;

  insert into public.coin_transactions (user_id, amount, reason)
  values (auth.uid(), -roll_cost, 'roll_purchase');

  update public.profiles set coins = coins - roll_cost where id = auth.uid();
end;
$$;

grant execute on function public.grant_coins(uuid, integer, text, text) to authenticated;
grant execute on function public.claim_daily_bonus() to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.buy_roll() to authenticated;
