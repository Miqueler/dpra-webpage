-- Leaderboard without a security-definer view.
-- A plain view runs with its creator's privileges, so public.leaderboard
-- skipped row-level security on everything it touched and answered anyone,
-- logged in or not. The view now runs as the caller (security_invoker), and
-- the one deliberate exception — showing every citizen's best score even
-- though play history is otherwise private — lives in a function that returns
-- only the leaderboard columns and only to logged-in citizens.

create or replace function public.leaderboard_rows()
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  rank text,
  best_score integer,
  plays bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.avatar_url,
    p.rank,
    max(r.score),
    count(r.id)
  from public.profiles p
  join public.rng_sessions r on r.user_id = p.id
  group by p.id, p.username, p.avatar_url, p.rank;
$$;

revoke execute on function public.leaderboard_rows() from public, anon;
grant execute on function public.leaderboard_rows() to authenticated;

create or replace view public.leaderboard
with (security_invoker = true) as
select user_id, username, avatar_url, rank, best_score, plays
from public.leaderboard_rows();

revoke all on public.leaderboard from anon;
