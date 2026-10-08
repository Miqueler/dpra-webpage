# 4. Running locally

Requires Node.js 20+ (built/tested with Node 23).

```bash
npm install
cp .env.local.example .env.local   # then fill in real values, see 03-environment-variables.md
npm run dev
```

Open http://localhost:3000 — it redirects to `/ca` (Catalan is the default
locale). Try `/es` and `/en` too, and use the language switcher in the
header.

Without a real Supabase project wired up (step 1–3), pages that don't touch
the database — home, projects, recruitment, propaganda — render fine. Login,
profile, ATZAR, and admin will error at runtime since they query a database
that doesn't exist yet at the placeholder URL.

## Other useful commands

```bash
npm run build       # production build — also runs TypeScript
npm run typecheck   # tsc --noEmit, no build output
npm run lint         # eslint .
npm test             # vitest run — the whole test suite, a few seconds
npm run test:watch   # re-runs the affected tests as you edit
npm run start        # serve the production build (run `npm run build` first)
```

All four (`typecheck`, `lint`, `test`, `build`) should pass with zero errors
on a clean checkout — if one doesn't, something in your local setup (Node
version, stale `node_modules`) is likely the cause; try `rm -rf node_modules
.next && npm install` first.

## Tests

`npm test` needs no Supabase project or `.env.local`. The suite lives in
`tests/`:

- `messages.test.ts` — the three languages have the same keys and
  placeholders, and the name is DPRA in all of them.
- `username.test.ts` — the username rule, and that the SQL migration uses the
  same one.
- `database.test.ts` — runs every file in `supabase/migrations/` against an
  in-memory Postgres (PGlite) and checks sign-up, the coin functions
  (`claim_daily_bonus`, `buy_roll`, `redeem_invite`, `grant_coins`), the
  protected profile columns and the row-level security policies.
- `proxy.test.ts`, `redirects.test.ts`, `auth-routes.test.ts` — locale
  redirects, and that login/confirmation links never redirect off-site.
- `machine-api.test.ts` — the routes the physical ATZAR machine calls.
- `atzar-badges.test.ts`, `atzar-roll-api.test.ts`, `atzar-streak.test.ts` —
  the online machine: every badge's examples, that the points file is up to
  date, the roll route, and the daily-streak calculation.
- `components/` — every form and button, including that the top-bar coin
  balance refreshes after coins move.

Adding a message key to one language only, or a new namespace file that is
not registered in `src/i18n/request.ts`, fails the suite.

Two limits worth knowing. The route and component tests replace Supabase
with a stand-in (`tests/helpers/supabase.ts`), so they check what the app
asks Supabase to do, not Supabase itself. And the database tests supply a
minimal copy of what Supabase provides (`auth.users`, `auth.uid()`, the
`anon`/`authenticated` roles — see `tests/helpers/database.ts`) and use a
single connection, so they cannot catch two requests racing each other.

## Project layout, if you want to orient yourself

```
src/
  app/
    [locale]/           every page, nested under the locale segment
      atzar/             the slot-machine subsection (own layout/theme)
      admin/, login/, profile/, projects/, propaganda/, recruitment/
      layout.tsx         root layout: <html>, fonts, Header, Footer
      page.tsx           home page
    api/machine/         routes the physical ATZAR machine calls
    auth/                OAuth callback + signout (outside [locale] on purpose)
  components/
    ui/                  generic building blocks (PosterCard, Button, ...)
    layout/, auth/, profile/, atzar/, admin/    page-specific pieces
  i18n/                  next-intl routing/navigation/request config
  lib/supabase/          browser / server / admin Supabase clients
  messages/{ca,es,en}/   one JSON file per page namespace, per locale
  types/database.ts      hand-written types mirroring the SQL schema
supabase/migrations/      the SQL schema (run manually, see 01-supabase-setup.md)
tests/                    the test suite (`npm test`)
```

Next: [Becoming an admin](./05-admin-promotion.md).
