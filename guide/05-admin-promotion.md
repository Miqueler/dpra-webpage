# 5. Becoming an admin (the Commissariat)

There's no sign-up flow for admins — the very first admin has to be promoted
by hand directly in the database, since the admin page (`/admin`) itself
requires `is_admin = true` to even load.

1. Log in once through the normal Google login flow, so your `profiles` row
   exists.
2. In Supabase, go to **SQL Editor** and run:

   ```sql
   update public.profiles
   set is_admin = true
   where username = 'your_username';
   ```

   (Find your username on your `/profile` page, or via **Table Editor →
   profiles** in the dashboard.)

3. Refresh the site — the header nav should now show a "Commissariat" link,
   and `/admin` should load.

From then on, that admin can grant coins to anyone from the `/admin` page —
but promoting *other* citizens to admin still has to be done the same way
(directly in the database), since there's no "make this person an admin" UI.
That's intentional for v1: it's a rare, high-trust action.

### Why a citizen can't just set `is_admin` themselves

`profiles` has a trigger (`protect_profile_columns`, in
`supabase/migrations/0001_init.sql`) that blocks changes to `coins`, `rank`,
`is_admin`, `machine_code`, `invited_by`, and `last_daily_bonus_at` from
anyone except the service role. Row Level Security alone can't restrict
individual columns, so this trigger is the actual enforcement — editing via
the Supabase dashboard's SQL Editor works because that connection uses
elevated Postgres privileges, not your app's `anon`/`authenticated` role.

Next: [ATZAR machine integration](./06-atzar-machine-integration.md).
