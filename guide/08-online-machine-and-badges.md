# 8. The online machine and its badges

While the physical ATZAR machine is being built, citizens can roll on the
website itself, at `/atzar/play`. It behaves like the real machine:

- it spends the same daily free roll, then purchased rolls;
- its results go to the same play history and leaderboard;
- the number and its score are worked out on the server, never in the
  browser, so a citizen cannot choose their own result.

A roll is a whole number from 0 to 999,999 (`MAX_ROLL` in `badges.ts`). The
digits stop one by one,
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

The badges, their families and their values follow
[rngdle](https://rngdle.com), as listed in
[`rngdle-badges.md`](../rngdle-badges.md) at the root of the repository. A
test compares our rules against the values in that file.

You never write the points yourself. A badge is worth **100 points divided
by the chance of rolling it**: a badge half of all numbers earn is worth 200
points, one that a single number earns is worth 100,000,000. The points are
worked out by trying every possible roll and are saved in
`src/lib/atzar/badge-stats.json`, which you regenerate with one command.

## Creating a badge

1. Open `src/lib/atzar/badges.ts` and add an entry to the `BADGES` list:

   ```ts
   {
     id: "DOUBLETHINK",
     emoji: "👁️",
     name: tr("Doublethink", "Doblepensar", "Doblepensar"),
     description: tr(
       'Contains "225". Two and two make five.',
       'Contiene "225". Dos y dos son cinco.',
       'Conté "225". Dos i dos fan cinc.',
     ),
     check: ({ s }) => s.includes("225"),
     examples: { yes: [225, 12250], no: [22, 252] },
   },
   ```

   - `id` — capital letters, digits and underscores. It is stored with every
     play, so once a badge is live **never rename it or reuse it** for a
     different rule.
   - `name` and `description` — `tr(english, spanish, catalan)`, or a plain
     string (`name: "1984"`) when it is the same in all three.
   - `family` — optional; see "Families" below.
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

   It takes about half a minute and prints every badge with how many of the
   1,000,000 possible rolls earn it and what it is worth. Look at your new
   badge's line: if `rolls` is 0, no number can ever earn it and the rule is
   wrong.

3. Run the tests:

   ```bash
   npm test
   ```

4. Commit `badges.ts` **and** `badge-stats.json` together, and deploy.

### Shortcuts for the usual kinds of badge

Most badges are one of a few kinds, and each has a one-line shortcut that
writes the description (in the three languages), the rule and the examples
for you:

```ts
contains("JACKPOT", "💰", "Jackpot", "777"),          // has 777 somewhere
exactly("LEET_EXACT", "💻", "Exact Leet", [1337]),     // is exactly 1337
exactly("ALWAYS", "♾️", "Always", [247365, 365247]),   // is one of these
endsWith("CENTURY", "💯", "Century", "00"),            // ends in 00
exactlyOne("GHOST", "👻", "Ghost", "0"),               // has exactly one 0
digitCount("FOUR_DIGITS", "🍀", "Four Digits", 4),     // has four digits
power("CUBE", "🧊", 3),                                // is a perfect cube
```

`contains`, `exactly` and `endsWith` take an optional last argument for a
family and an extra sentence for the description:

```ts
contains("HELL", "🔥", "Hell", "7734", {
  family: "HELL",
  note: tr("It spells HELL upside down.", "Del revés se lee HELL.", "Cap per avall s'hi llegeix HELL."),
}),
```

`tr(english, spanish, catalan)` is how every text with translations is
written. A plain string (`name: "Jackpot"`) is shown as it is in all three
languages; that is what the rngdle badge names use.

### Helpers for writing rules

For anything the shortcuts do not cover, write the `check` yourself. The top
of `badges.ts` has small functions for the usual questions:

| Helper | What it gives you | Example |
| --- | --- | --- |
| `digits(s)` | each digit as a number | `digits("4096")` → `[4, 0, 9, 6]` |
| `digitSum(s)` / `digitProduct(s)` | the digits added up / multiplied | `digitSum("4096")` → `19` |
| `distinct(s)` | how many different digits | `distinct("4004")` → `2` |
| `tally(s)` | how many of each digit, 0 to 9 | `tally("4004")[4]` → `2` |
| `count(s, "0")` | how many of one digit | `count("4004", "0")` → `2` |
| `last(s)` | the last digit | `last("4096")` → `"6"` |
| `steps(s)` | the change from each digit to the next | `steps("4096")` → `[-4, 9, -3]` |
| `shape(s)` | the ups, downs and flats as letters | `shape("1332")` → `"ufd"` |
| `runs(s)` | the digits grouped by repeats | `runs("44477")` → `["444", "77"]` |
| `hasRun(s, 3)` | the same digit 3 times in a row | `hasRun("4447", 3)` → `true` |
| `hasSequence(s, 3)` | 3 digits in a row counting up or down | `hasSequence("9876", 3)` → `true` |
| `substrings(s, 4)` | every stretch of 4 or more digits | |
| `splits(s, 3)` | every way to cut it into 3 numbers | `splits("123", 3)` → `[[1, 2, 3]]` |
| `isPalindrome(s)` | reads the same both ways | `isPalindrome("1221")` → `true` |
| `isShuffledRun(s)` | sorted, the digits count up one by one | `isShuffledRun("3124")` → `true` |
| `isPrime(n)` | a prime number | `isPrime(97)` → `true` |
| `isPower(n, 3)` | a whole number cubed | `isPower(64, 3)` → `true` |
| `isPowerOf(n, 3)` | a power of 3 | `isPowerOf(81, 3)` → `true` |

`shape` pairs well with a regular expression: `/^u+d+$/.test(shape(s))` is
"the digits rise, then fall". If a rule needs something else, write another
helper next to these.

### Families: versions of the same idea

Some badges are stronger versions of another: "ends in 0", "ends in 00",
"ends in 000". A number ending in 000 earns all three, and counting all
three would pay for the same thing three times. Give them the same `family`:

```ts
family: "VOID_DEPTH",
```

The roll still shows every badge it earned, but within a family only the one
worth the most points is added to the score; the others appear dimmed as
"outranked by a better badge". Badges with no family always count.

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
possible roll: *trash* (bottom 1%), *common* (bottom half), *uncommon*
(better than half), *rare* (better than 75%), *epic* (better than 90%),
*anomaly* (better than 95%) and *mythic* (better than 99%).

Badges have their own rarity from their points: *common* (under 1,000, more
than a 10% chance), *uncommon* (1,000 or more), *rare* (10,000), *epic*
(100,000), *anomaly* (1,000,000) and *mythic* (10,000,000 or more).

Both scales are functions in `badges.ts` (`rollTier` and `badgeRarity`);
their names are translated in `src/messages/*/atzar.json` under `play`.

## Differences from rngdle

- rngdle rolls up to 1,000,000; here `MAX_ROLL` is 999,999. So the "One
  Million" badge is left out, and values are a hair lower (a one-number badge
  is worth 100,000,000 rather than 100,000,100). Set `MAX_ROLL` to
  `1_000_000`, add the badge and run `npm run atzar:stats` to match exactly.
- Descriptions are our own wording, translated; names are rngdle's.

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
