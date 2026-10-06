# 6. ATZAR machine integration

The website never computes a slot-machine score — the **physical machine**
does all the RNG/scoring logic itself. The website only:

- shows each citizen their `machine_code` (on `/atzar` and `/profile`) so
  they can identify themselves at the machine,
- tells the machine whether that citizen has a free roll left today / how
  many paid rolls they've bought,
- records whatever result the machine reports, so it shows up in their play
  history and the leaderboard.

Two API routes implement this contract. Both require the shared secret from
`MACHINE_API_SECRET` (see [03-environment-variables.md](./03-environment-variables.md))
sent as the `x-machine-secret` header — treat it like a password; anyone
with it can record arbitrary scores for any citizen.

## `GET /api/machine/status?code=<machine_code>`

Call this before a play, once the citizen has entered/scanned their code at
the machine.

```
GET /api/machine/status?code=AB12CD
x-machine-secret: <MACHINE_API_SECRET>
```

Response:

```json
{
  "username": "citizen123",
  "coins": 80,
  "free_roll_available": true,
  "extra_rolls": 2
}
```

Use `free_roll_available` / `extra_rolls` to decide whether the machine
should let this citizen play, and (if neither is available) show them a
"buy more rolls from your profile" message instead.

## `POST /api/machine/submit`

Call this immediately after a play completes, with whatever the machine
computed.

```
POST /api/machine/submit
x-machine-secret: <MACHINE_API_SECRET>
Content-Type: application/json

{
  "code": "AB12CD",
  "score": 742,
  "roll_type": "free",
  "payload": { "any": "machine-specific details you want stored" }
}
```

- `roll_type` is `"free"` or `"paid"` — this tells the server which counter
  to decrement (`daily_rolls.free_roll_used` or `daily_rolls.extra_rolls`).
  The server rejects the request (`409`) if that roll type wasn't actually
  available, so always call `/status` first and don't let the machine play
  a roll it doesn't have.
- `payload` is stored as-is in `rng_sessions.payload` (a JSON column) — put
  whatever raw numbers/properties the machine's scoring was based on here,
  in case you want to display or analyze them later. It's optional.
- On success: `{ "ok": true }`. On failure: `{ "error": "..." }` with a
  `401` (bad/missing secret), `404` (unknown code), `409` (roll not
  available), or `400` (malformed request).

## Implementation notes

Both routes live in `src/app/api/machine/`. They use the **service role**
Supabase client (`src/lib/supabase/admin.ts`), which bypasses Row Level
Security entirely — that's intentional and necessary, since the machine
isn't an authenticated citizen, but it's also why the shared-secret check at
the top of each route is load-bearing. Don't remove it, and don't expose
`MACHINE_API_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` anywhere client-side.

Whatever hardware/software runs on the physical machine (Raspberry Pi,
microcontroller with wifi, etc.) just needs to be able to make two HTTPS
requests to your deployed site — no SDK required.

Next: [Deploying](./07-deployment.md).
