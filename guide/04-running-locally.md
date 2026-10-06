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
npm run start        # serve the production build (run `npm run build` first)
```

All three (`typecheck`, `lint`, `build`) should pass with zero errors on a
clean checkout — if one doesn't, something in your local setup (Node
version, stale `node_modules`) is likely the cause; try `rm -rf node_modules
.next && npm install` first.

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
```

Next: [Becoming an admin](./05-admin-promotion.md).
