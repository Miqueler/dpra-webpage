# 1. Supabase project setup

Supabase provides the database, auth, and RLS (row-level security) the whole
app is built on.

## Create the project

1. Go to [supabase.com](https://supabase.com) and sign in (a GitHub login is
   easiest).
2. **New project** → pick an organization → give it a name (e.g.
   `dpra-webpage`) → choose a region close to you/your users → set a strong
   database password (save it somewhere — you won't need it day-to-day, but
   you'll need it if you ever connect a raw Postgres client).
3. Wait ~2 minutes for provisioning.

## Run the schema migration

The full schema (tables, RLS policies, triggers, RPC functions) lives at
`supabase/migrations/0001_init.sql` in this repo. It is **not** applied
automatically — you need to run it once against your new project.

Easiest path (no CLI install needed):

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. **New query**.
3. Open `supabase/migrations/0001_init.sql` from this repo, copy its entire
   contents, paste into the editor.
4. **Run**. It should finish with no errors and create:
   - Tables: `profiles`, `coin_transactions`, `daily_rolls`, `rng_sessions`, `friendships`
   - A view: `leaderboard`
   - A trigger (`on_auth_user_created`) that auto-creates a `profiles` row
     (with a generated 6-character machine code and a 50-coin signup bonus)
     whenever someone signs up via Google
   - RPC functions: `grant_coins`, `claim_daily_bonus`, `redeem_invite`, `buy_roll`

### Alternative: Supabase CLI

If you'd rather use the CLI and keep migrations versioned/repeatable:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>   # found in Project Settings > General
supabase db push
```

`supabase db push` applies every file under `supabase/migrations/` in order.

## Where to find your API keys

**Project Settings → API** (gear icon → API, or `/project/_/settings/api`):

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`

The service role key bypasses every RLS policy — never commit it, never
expose it to the browser. It's only read server-side, in
`src/lib/supabase/admin.ts`, used by the two `/api/machine/*` routes that the
physical ATZAR machine calls.

Next: [Google OAuth login](./02-google-oauth.md).
