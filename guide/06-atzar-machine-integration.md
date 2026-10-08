# 6. ATZAR machine integration

The website never computes a slot-machine score — the **physical machine**
does all the RNG/scoring logic itself. The website only:

- hands the machine a short code to show when someone presses play,
- lets the citizen type that code into `/atzar` to link the play to their
  account,
- tells the machine who linked it and whether they have a free roll left
  today / how many paid rolls they've bought,
- records whatever result the machine reports, so it shows up in their play
  history and the leaderboard.

Citizens no longer carry a code of their own. The code comes from the
machine, lasts ten minutes, and is good for **one play**.

Three API routes implement this contract. All require the shared secret from
`MACHINE_API_SECRET` (see [03-environment-variables.md](./03-environment-variables.md))
sent as the `x-machine-secret` header — treat it like a password; anyone
with it can record scores for any citizen who links a code.

## The flow

1. Someone presses play. The machine calls `POST /api/machine/session` and
   shows the code it gets back.
2. The citizen opens `/atzar` on their phone and types the code in.
3. Meanwhile the machine polls `GET /api/machine/status?code=…` every second
   or two. Once it answers `"linked": true`, the machine knows who is playing
   and which rolls they have.
4. The machine plays the roll and calls `POST /api/machine/submit` with the
   same code. The code is now spent; the next play starts again at step 1.

## `POST /api/machine/session`

```
POST /api/machine/session
x-machine-secret: <MACHINE_API_SECRET>
```

Response (`201`):

```json
{
  "code": "XK42PM",
  "expires_at": "2026-05-01T10:10:00.000Z"
}
```

The code is six characters from `A–Z` and `2–9`, without `0`/`O` or `1`/`I`,
so it can be read off a screen and typed without mistakes. If nobody links it
before `expires_at`, ask for a new one. Linking a code gives the citizen
another ten minutes to finish the play.

## `GET /api/machine/status?code=<code>`

```
GET /api/machine/status?code=XK42PM
x-machine-secret: <MACHINE_API_SECRET>
```

Before a citizen has typed the code in:

```json
{ "linked": false }
```

After:

```json
{
  "linked": true,
  "username": "citizen123",
  "coins": 80,
  "free_roll_available": true,
  "extra_rolls": 2
}
```

Use `free_roll_available` / `extra_rolls` to decide whether the machine
should let this citizen play, and (if neither is available) show them a
"buy more rolls on the website" message instead. Keep polling in that case:
the code stays linked, so a roll bought on `/atzar` shows up on the next
poll.

Errors: `404` (a code the site never issued) and `410` (the code expired or
was already played) — in both cases stop polling and start a new session.

## `POST /api/machine/submit`

Call this immediately after a play completes, with whatever the machine
computed.

```
POST /api/machine/submit
x-machine-secret: <MACHINE_API_SECRET>
Content-Type: application/json

{
  "code": "XK42PM",
  "score": 742,
  "roll_type": "free",
  "payload": { "any": "machine-specific details you want stored" }
}
```

- `roll_type` is `"free"` or `"paid"` — this tells the server which counter
  to decrement (`daily_rolls.free_roll_used` or `daily_rolls.extra_rolls`).
  The server rejects the request (`409`) if that roll type wasn't actually
  available, so check `/status` first and don't let the machine play a roll
  the citizen doesn't have. A rejected play does not spend the code.
- `payload` is stored as-is in `rng_sessions.payload` (a JSON column) — put
  whatever raw numbers/properties the machine's scoring was based on here,
  in case you want to display or analyze them later. It's optional.
- On success: `{ "ok": true }`, and the code cannot be used again. On
  failure: `{ "error": "..." }` with a `401` (bad/missing secret), `404`
  (unknown code), `410` (code expired or already played), `409` (code not
  linked yet, or roll not available), or `400` (malformed request).

## Implementation notes

The routes live in `src/app/api/machine/`, with their shared checks in
`src/lib/machine.ts`. Codes are stored in the `machine_sessions` table
(`supabase/migrations/0006_machine_sessions.sql`); citizens cannot read it
and link a code only through the `claim_machine_session` database function.

The routes use the **service role** Supabase client
(`src/lib/supabase/admin.ts`), which bypasses Row Level Security entirely —
that's intentional and necessary, since the machine isn't an authenticated
citizen, but it's also why the shared-secret check at the top of each route
is load-bearing. Don't remove it, and don't expose `MACHINE_API_SECRET` or
`SUPABASE_SERVICE_ROLE_KEY` anywhere client-side.

Each profile still has a `machine_code` column from the old flow, where
citizens typed their own code into the machine. Nothing reads it any more.

Whatever hardware/software runs on the physical machine (Raspberry Pi,
microcontroller with wifi, etc.) just needs to be able to make HTTPS
requests to your deployed site — no SDK required.

Next: [Deploying](./07-deployment.md).
