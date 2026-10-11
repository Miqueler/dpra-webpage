-- Ranks belong to the Commissariat.
-- Ranks stop being a fixed list in the code: admins create, rename and delete
-- them from the admin page, and choose which one new citizens start with.
-- Every citizen is reset to the one rank that exists to begin with, Citizen.

-- ---------------------------------------------------------------------------
-- ranks — the list the Commissariat keeps
-- ---------------------------------------------------------------------------
create table if not exists public.ranks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name = btrim(name) and char_length(name) between 1 and 40),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- "Citizen" and "citizen" are the same rank.
create unique index if not exists ranks_name_lower_key on public.ranks (lower(name));
-- Exactly one rank is handed to new citizens.
create unique index if not exists ranks_one_default on public.ranks (is_default) where is_default;

alter table public.ranks enable row level security;

-- Rank names are shown next to usernames, so anyone may read them. Nobody
-- writes to the table directly: the functions below do it for admins.
drop policy if exists "ranks are public" on public.ranks;
create policy "ranks are public"
  on public.ranks for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.ranks from anon, authenticated;

insert into public.ranks (name, is_default)
select 'Citizen', true
where not exists (select 1 from public.ranks);

-- The rank a new citizen starts with.
create or replace function public.default_rank()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select name from public.ranks where is_default;
$$;

-- ---------------------------------------------------------------------------
-- profiles.rank — now one of the ranks above
-- ---------------------------------------------------------------------------
-- Only the first time this file is run: running it again must not undo the
-- ranks the Commissariat has assigned since.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_rank_fkey'
  ) then
    alter table public.profiles drop constraint if exists profiles_rank_check;

    update public.profiles set rank = public.default_rank() where true;

    -- Renaming a rank renames it for everyone who holds it, and a rank
    -- somebody holds cannot be deleted.
    alter table public.profiles
      add constraint profiles_rank_fkey
      foreign key (rank) references public.ranks (name)
      on update cascade on delete restrict;
  end if;
end;
$$;

alter table public.profiles alter column rank set default public.default_rank();

-- ---------------------------------------------------------------------------
-- the Commissariat's rank functions
-- ---------------------------------------------------------------------------
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
  -- profiles_rank_fkey holds the list of ranks.
  when foreign_key_violation or not_null_violation then
    raise exception 'Unknown rank.';
end;
$$;

create or replace function public.create_rank(new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := btrim(coalesce(new_name, ''));
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may create ranks.';
  end if;

  if char_length(cleaned) < 1 or char_length(cleaned) > 40 then
    raise exception 'A rank must be between 1 and 40 characters.';
  end if;

  if exists (select 1 from public.ranks where lower(name) = lower(cleaned)) then
    raise exception 'That rank already exists.';
  end if;

  insert into public.ranks (name) values (cleaned);
end;
$$;

-- Everyone who holds the rank keeps it under its new name.
create or replace function public.rename_rank(rank_id uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := btrim(coalesce(new_name, ''));
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may rename ranks.';
  end if;

  if char_length(cleaned) < 1 or char_length(cleaned) > 40 then
    raise exception 'A rank must be between 1 and 40 characters.';
  end if;

  if exists (
    select 1 from public.ranks where lower(name) = lower(cleaned) and id <> rank_id
  ) then
    raise exception 'That rank already exists.';
  end if;

  update public.ranks set name = cleaned where id = rank_id;
  if not found then
    raise exception 'Unknown rank.';
  end if;
end;
$$;

-- Everyone who held the old default rank moves to the new one.
create or replace function public.set_default_rank(rank_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_default public.ranks;
  new_default public.ranks;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may choose the default rank.';
  end if;

  select * into new_default from public.ranks where id = rank_id;
  if not found then
    raise exception 'Unknown rank.';
  end if;
  if new_default.is_default then
    return;
  end if;

  select * into old_default from public.ranks where is_default;

  update public.ranks set is_default = false where is_default;
  update public.ranks set is_default = true where id = rank_id;
  update public.profiles set rank = new_default.name where rank = old_default.name;
end;
$$;

create or replace function public.delete_rank(rank_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.ranks;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only the Commissariat may delete ranks.';
  end if;

  select * into target from public.ranks where id = rank_id;
  if not found then
    raise exception 'Unknown rank.';
  end if;

  if target.is_default then
    raise exception 'The default rank cannot be deleted.';
  end if;

  if exists (select 1 from public.profiles where rank = target.name) then
    raise exception 'A rank that citizens hold cannot be deleted.';
  end if;

  delete from public.ranks where id = rank_id;
end;
$$;

revoke execute on function public.create_rank(text) from public, anon;
revoke execute on function public.rename_rank(uuid, text) from public, anon;
revoke execute on function public.set_default_rank(uuid) from public, anon;
revoke execute on function public.delete_rank(uuid) from public, anon;
grant execute on function public.create_rank(text) to authenticated;
grant execute on function public.rename_rank(uuid, text) to authenticated;
grant execute on function public.set_default_rank(uuid) to authenticated;
grant execute on function public.delete_rank(uuid) to authenticated;
