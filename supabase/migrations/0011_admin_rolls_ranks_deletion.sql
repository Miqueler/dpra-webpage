-- Commissariat upgrade, part two.
-- Ranks become a closed list, admins can read every citizen's rolls, and
-- admins can delete a citizen from the admin page.

-- ---------------------------------------------------------------------------
-- ranks — a closed list of keys
-- ---------------------------------------------------------------------------
-- Ranks used to be free text. They are now one of a fixed set of keys, which
-- the site translates (src/lib/ranks.ts, and `ranks` in each common.json).
-- Ranks already assigned are matched to a key by their name in any of the
-- three languages; anything else becomes 'citizen'.
update public.profiles
set rank = case replace(lower(btrim(rank)), ' ', '_')
  when 'comrade' then 'comrade'
  when 'camarada' then 'comrade'
  when 'militant' then 'militant'
  when 'militante' then 'militant'
  when 'party_cadre' then 'party_cadre'
  when 'cuadro_del_partido' then 'party_cadre'
  when 'quadre_del_partit' then 'party_cadre'
  when 'hero_of_labour' then 'hero_of_labour'
  when 'héroe_del_trabajo' then 'hero_of_labour'
  when 'heroi_del_treball' then 'hero_of_labour'
  when 'supreme_leader' then 'supreme_leader'
  when 'líder_supremo' then 'supreme_leader'
  when 'líder_suprem' then 'supreme_leader'
  else 'citizen'
end
where true;

alter table public.profiles alter column rank set default 'citizen';

alter table public.profiles drop constraint if exists profiles_rank_check;
alter table public.profiles add constraint profiles_rank_check check (
  rank in (
    'citizen',
    'comrade',
    'militant',
    'party_cadre',
    'hero_of_labour',
    'supreme_leader'
  )
);

create or replace function public.set_rank(target_user uuid, new_rank text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may assign ranks.';
  end if;

  update public.profiles set rank = new_rank where id = target_user;
  if not found then
    raise exception 'Unknown citizen.';
  end if;
exception
  -- profiles_rank_check holds the list of ranks.
  when check_violation or not_null_violation then
    raise exception 'Unknown rank.';
end;
$$;

-- ---------------------------------------------------------------------------
-- rolls — the Commissariat sees everyone's
-- ---------------------------------------------------------------------------
drop policy if exists "admins read every play history" on public.rng_sessions;
create policy "admins read every play history"
  on public.rng_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

-- ---------------------------------------------------------------------------
-- delete_citizen — remove a citizen and everything attached to them
-- ---------------------------------------------------------------------------
-- Coins granted by a citizen who is later deleted stay in the ledger, with no
-- author. Without this, a former admin could never be deleted.
alter table public.coin_transactions
  drop constraint if exists coin_transactions_created_by_fkey;
alter table public.coin_transactions
  add constraint coin_transactions_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- Deleting the auth.users row takes the profile with it, and with the profile
-- the citizen's ledger, rolls, friendships and machine codes. Admins cannot
-- delete themselves or each other: an admin is demoted by hand first, the
-- same way they were promoted.
create or replace function public.delete_citizen(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may delete a citizen.';
  end if;

  select * into target from public.profiles where id = target_user;
  if not found then
    raise exception 'Unknown citizen.';
  end if;

  if target.is_admin then
    raise exception 'A commissar cannot be deleted.';
  end if;

  delete from auth.users where id = target_user;
end;
$$;

revoke execute on function public.delete_citizen(uuid) from public, anon;
grant execute on function public.delete_citizen(uuid) to authenticated;
