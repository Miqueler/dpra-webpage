-- Commissariat upgrade.
-- Admins may now assign ranks from the admin page, and that page shows the
-- full file on each citizen: contact details from auth.users, who sponsored
-- them, and their ATZAR activity.

-- ---------------------------------------------------------------------------
-- set_rank — admin rank assignment
-- ---------------------------------------------------------------------------
-- Ranks are free text (the Party invents new ones as needed), trimmed and
-- capped so they fit wherever a rank is displayed.
create or replace function public.set_rank(target_user uuid, new_rank text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := btrim(coalesce(new_rank, ''));
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may assign ranks.';
  end if;

  if char_length(cleaned) < 1 or char_length(cleaned) > 40 then
    raise exception 'A rank must be between 1 and 40 characters.';
  end if;

  update public.profiles set rank = cleaned where id = target_user;
  if not found then
    raise exception 'Unknown citizen.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_citizens — the register, as the Commissariat sees it
-- ---------------------------------------------------------------------------
-- Security definer because it reads auth.users and every citizen's play
-- history, neither of which row-level security exposes to the caller.
create or replace function public.admin_citizens()
returns table (
  id uuid,
  username text,
  avatar_url text,
  rank text,
  coins integer,
  is_admin boolean,
  machine_code text,
  created_at timestamptz,
  last_daily_bonus_at date,
  email text,
  email_confirmed boolean,
  last_sign_in_at timestamptz,
  invited_by_username text,
  invited_count integer,
  friend_count integer,
  plays integer,
  best_score integer,
  last_played_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles me where me.id = auth.uid() and me.is_admin
  ) then
    raise exception 'Only the Commissariat may read the register.';
  end if;

  return query
  select
    p.id,
    p.username,
    p.avatar_url,
    p.rank,
    p.coins,
    p.is_admin,
    p.machine_code,
    p.created_at,
    p.last_daily_bonus_at,
    u.email::text,
    u.email_confirmed_at is not null,
    u.last_sign_in_at,
    sponsor.username,
    (select count(*) from public.profiles i where i.invited_by = p.id)::integer,
    (
      select count(*) from public.friendships f
      where f.status = 'accepted' and (f.user_id = p.id or f.friend_id = p.id)
    )::integer,
    (select count(*) from public.rng_sessions r where r.user_id = p.id)::integer,
    (select max(r.score) from public.rng_sessions r where r.user_id = p.id),
    (select max(r.played_at) from public.rng_sessions r where r.user_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.profiles sponsor on sponsor.id = p.invited_by
  order by p.username;
end;
$$;

revoke execute on function public.set_rank(uuid, text) from public, anon;
revoke execute on function public.admin_citizens() from public, anon;
grant execute on function public.set_rank(uuid, text) to authenticated;
grant execute on function public.admin_citizens() to authenticated;
