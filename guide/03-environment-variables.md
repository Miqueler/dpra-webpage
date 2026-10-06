# 3. Environment variables

Copy the example file and fill in real values:

```bash
cp .env.local.example .env.local
```

| Variable | Where it's used | Where to find the value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server Supabase clients (`src/lib/supabase/client.ts`, `server.ts`, `admin.ts`) | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as above | Supabase → Project Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client (`src/lib/supabase/admin.ts`), used by `/api/machine/*` routes | Supabase → Project Settings → API → service_role key (click Reveal) |
| `MACHINE_API_SECRET` | Shared secret the physical ATZAR machine sends as the `x-machine-secret` header to `/api/machine/status` and `/api/machine/submit` | You choose this — generate a long random string, e.g. `openssl rand -hex 32` |

Notes:

- Anything prefixed `NEXT_PUBLIC_` is bundled into client-side JavaScript —
  fine for the URL and anon key (anon key is designed to be public; RLS is
  what actually protects data), but **never** prefix the service role key or
  machine secret that way.
- `.env.local` is gitignored (see `.gitignore`) — it will never be committed.
  `.env.local.example` (committed) documents the shape without real values.
- If you deploy (see [07-deployment.md](./07-deployment.md)), set these same
  four variables in your hosting provider's environment variable settings —
  `.env.local` only applies locally.
- After editing `.env.local`, restart `npm run dev` — Next.js only reads env
  files at process start.

Next: [Running locally](./04-running-locally.md).
