# 8. The online machine and its badges

While the physical ATZAR machine is being built, citizens can roll on the
website itself, at `/atzar/play`. It behaves like the real machine:

- it spends the same daily free roll, then purchased rolls;
- its results go to the same play history and leaderboard;
- the number and its score are worked out on the server, never in the
  browser, so a citizen cannot choose their own result.

A roll is a whole number from 0 to 1,000,000. The digits stop one by one,
from the first to the last, and then the badges the number earns appear, the
cheapest first.

## Switching it on and off

Run `supabase/migrations/0007_online_machine.sql` and then
`0008_online_machine_switch_fix.sql` once (see
[01-supabase-setup.md](./01-supabase-setup.md)). The machine starts **off**.

An admin switches it from the **Online ATZAR machine** card at the top of
`/admin`. While it is off, `/atzar` hides the "Play online" card and
`/atzar/play` says the machine is switched off. A roll sent at the very
moment it is switched off is refused and costs nothing.

## Where the badges live

Everything about badges is in one file:
[`src/lib/atzar/badges.ts`](../src/lib/atzar/badges.ts). It holds the list of
badges, the helpers for writing their rules, and every calculation: which
badges a number earns, what each is worth, and how a roll is scored.

You never write the points yourself. A badge is worth **the number of rolls
it takes, on average, to see it once**: a badge half of all numbers earn is
worth 2 points, one that a single number earns is worth 1,000,001. The points
are worked out by trying every possible roll and are saved in
`src/lib/atzar/badge-stats.json`, which you regenerate with one command.

## Creating a badge

1. Open `src/lib/atzar/badges.ts` and add an entry to the `BADGES` list:

   ```ts
   {
     id: "LUCKY_SEVENS",
     emoji: "🎰",
     name: { ca: "Tres sets", es: "Tres sietes", en: "Three sevens" },
     description: {
       ca: 'Conté "777".',
       es: 'Contiene "777".',
       en: 'Contains "777".',
     },
     check: ({ s }) => s.includes("777"),
     examples: { yes: [777, 17770], no: [77, 7707] },
   },
   ```

   - `id` — capital letters, digits and underscores. It is stored with every
     play, so once a badge is live **never rename it or reuse it** for a
     different rule.
   - `name` and `description` — one text per language, or a plain string
     (`name: "1984"`) when it is the same in all three.
   - `check` — the rule. It receives the roll as `n` (the number, e.g.
     `4096`) and `s` (its digits as text, e.g. `"4096"`) and answers `true`
     when the badge is earned. Use whichever is handier:
     `({ n }) => n % 7 === 0` or `({ s }) => s.endsWith("99")`.
   - `examples` — a few numbers that must earn the badge (`yes`) and a few
     that must not (`no`). The tests check them, which is how you find out
     that a rule does not do what you meant.

2. Recalculate the points:

   ```bash
   npm run atzar:stats
   ```

   It takes a few seconds and prints every badge with how many of the
   1,000,001 possible rolls earn it and what it is worth. Look at your new
   badge's line: if `rolls` is 0, no number can ever earn it and the rule is
   wrong.

3. Run the tests:

   ```bash
   npm test
   ```

4. Commit `badges.ts` **and** `badge-stats.json` together, and deploy.

### Helpers for writing rules

The top of `badges.ts` has small functions for the usual cases:

| Helper | What it gives you | Example |
| --- | --- | --- |
| `digits(s)` | each digit as a number | `digits("4096")` → `[4, 0, 9, 6]` |
| `digitSum(s)` | the digits added up | `digitSum("4096")` → `19` |
| `distinct(s)` | how many different digits | `distinct("4004")` → `2` |
| `steps(s)` | the change from each digit to the next | `steps("4096")` → `[-4, 9, -3]` |
| `hasRun(s, 3)` | the same digit 3 times in a row | `hasRun("4447", 3)` → `true` |
| `isPalindrome(s)` | reads the same both ways | `isPalindrome("1221")` → `true` |
| `isPrime(n)` | a prime number | `isPrime(97)` → `true` |
| `isPower(n, 3)` | a whole number cubed | `isPower(64, 3)` → `true` |

If a rule needs something else, write another helper next to these.

### Groups: steps of the same idea

Some badges are stronger versions of another: "ends in 0", "ends in 00",
"ends in 000". A number ending in 000 earns all three, and counting all
three would pay for the same thing three times. Give them the same `group`:

```ts
group: "ROUND",
```

The roll still shows every badge it earned, but within a group only the one
worth the most points is added to the score; the others appear dimmed as
"outranked by a better badge".

## Removing a badge

1. Delete its entry from the `BADGES` list in `src/lib/atzar/badges.ts`.
2. Run `npm run atzar:stats`, then `npm test`.
3. Commit both files and deploy.

Plays already recorded keep their score. Their stored list of badge ids will
still mention the removed badge, which is harmless — nothing looks it up.

## Changing a badge's rule

Edit its `check` (and its `examples`), then run `npm run atzar:stats` and
`npm test` as above. The points change with the rule, since they depend on
how many numbers earn it.

## If you forget `npm run atzar:stats`

`npm test` fails with *"is up to date with the badges — otherwise run
`npm run atzar:stats`"*. The test notices whenever a badge was added, removed
or its rule changed since `badge-stats.json` was last generated. Until you
run the command, a new badge would be worth 0 points.

## How a roll is ranked

Besides the score, each roll gets a verdict from how it compares with every
possible roll: *poor* (bottom 10%), *common*, *uncommon* (better than half),
*rare* (better than 75%), *epic* (better than 90%) and *legendary* (better
than 99%). Badges have their own rarity from their points: *common* (under
10), *uncommon*, *rare* (100 or more), *epic* (1,000 or more) and
*legendary* (10,000 or more). Both scales are functions in `badges.ts`
(`rollTier` and `badgeRarity`); their names are translated in
`src/messages/*/atzar.json` under `play`.

## Implementation notes

- `src/lib/atzar/badges.ts` — badges and all calculations. It imports
  nothing, so `scripts/atzar-stats.mjs` can run it directly with Node.
- `src/lib/atzar/badge-stats.json` — generated; do not edit by hand.
- `src/lib/atzar/machine.ts` — joins the two and translates a scored roll
  for the browser.
- `src/app/api/atzar/roll/route.ts` — rolls the number, scores it, and asks
  the database (`record_online_play`) to spend a roll and record the play in
  one step. The number is only sent back if that succeeded.
- `src/components/atzar/OnlineMachine.tsx` — the reels and the badge reveal.
  Citizens whose device asks for reduced motion get the result at once.
