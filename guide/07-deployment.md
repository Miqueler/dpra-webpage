# 7. Deploying

The app is a standard Next.js App Router project, so it deploys cleanly to
[Vercel](https://vercel.com) (built by the same team as Next.js, zero extra
config needed). Any host that runs a Node.js server works too (Netlify,
Fly.io, a plain VPS with `npm run build && npm run start`), but Vercel is the
path of least resistance.

## Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. [vercel.com/new](https://vercel.com/new) → import the repo. Vercel
   auto-detects Next.js; no build command changes needed.
3. **Environment Variables** (in the import screen, or later under Project
   Settings → Environment Variables), add the same four from
   [03-environment-variables.md](./03-environment-variables.md):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MACHINE_API_SECRET`
4. Deploy.
5. Once you have the real production URL, go back to Supabase
   **Authentication → URL Configuration** and add
   `https://<your-domain>/auth/callback` to **Redirect URLs** (and update
   **Site URL** if this is now the primary place people log in) — see
   [02-google-oauth.md](./02-google-oauth.md). Also add the same URL as an
   authorized origin/redirect in the Google Cloud OAuth client if you're
   using a custom domain different from what you tested with.

## Custom domain

Add it under Project Settings → Domains in Vercel, point your DNS per their
instructions, then repeat the Supabase/Google redirect URL step above for
the final domain.

## After every deploy

Nothing else is required — there's no build step that touches the database.
Schema changes (new migrations under `supabase/migrations/`) still need to
be run manually against the Supabase project (SQL Editor, or
`supabase db push` if you're using the CLI) — they are not applied
automatically on deploy.
