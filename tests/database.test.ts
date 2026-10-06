import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type TestDatabase } from "./helpers/database";

// Runs the real SQL in supabase/migrations against an in-memory Postgres.
// Every test signs up its own citizens, so tests do not depend on each other.

let db: TestDatabase;
let n = 0;

/** A username no other test uses. */
function unique(base: string) {
  n += 1;
  return `${base}_${n}`;
}

/** A confirmed citizen with the 50-coin sign-up bonus. */
async function citizen(base = "citizen") {
  const username = unique(base);
  const id = await db.signUp({ metadata: { username } });
  return { id, username };
}

beforeAll(async () => {
  db = await createDatabase();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("signing up", () => {
  it("creates a profile with a machine code and the sign-up bonus", async () => {
    const id = await db.signUp({ email: "newcomer@upc.edu" });
    const profile = await db.profile(id);

    expect(profile).toMatchObject({
      username: "newcomer",
      coins: 50,
      rank: "Citizen",
      is_admin: false,
      invited_by: null,
    });
    // No 0/O or 1/I, so the code can be read off a screen and typed in.
    expect(profile.machine_code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(await db.ledger(id)).toEqual([[50, "signup_bonus"]]);
  });

  it("uses the username the citizen asked for", async () => {
    const username = unique("great.abril");
    const id = await db.signUp({ email: "someone@upc.edu", metadata: { username } });
    expect((await db.profile(id)).username).toBe(username);
  });

  it.each(["ab", "has spaces", "x".repeat(21), "", "abríl", "a@b"])(
    "ignores the unacceptable requested username %j and falls back to the email",
    async (username) => {
      const local = unique("fallback");
      const id = await db.signUp({ email: `${local}@upc.edu`, metadata: { username } });
      expect((await db.profile(id)).username).toBe(local);
    },
  );

  it("numbers a requested username that is already taken", async () => {
    const username = unique("popular");
    await db.signUp({ metadata: { username } });
    const second = await db.signUp({ metadata: { username } });
    const third = await db.signUp({ metadata: { username } });

    expect((await db.profile(second)).username).toBe(`${username}1`);
    expect((await db.profile(third)).username).toBe(`${username}2`);
  });

  it("numbers an email-derived username that is already taken", async () => {
    const local = unique("twin");
    await db.signUp({ email: `${local}@upc.edu` });
    const second = await db.signUp({ email: `${local}@gmail.com` });
    expect((await db.profile(second)).username).toBe(`${local}1`);
  });

  it("gives every citizen a different machine code", async () => {
    const ids = await Promise.all(Array.from({ length: 5 }, () => citizen().then((c) => c.id)));
    const codes = await Promise.all(ids.map(async (id) => (await db.profile(id)).machine_code));
    expect(new Set(codes).size).toBe(5);
  });

  it("copies the Google avatar onto the profile", async () => {
    const id = await db.signUp({
      metadata: { username: unique("pictured"), avatar_url: "https://lh3.example/a.png" },
    });
    const [row] = await db.admin("select avatar_url from profiles where id = $1", [id]);
    expect(row.avatar_url).toBe("https://lh3.example/a.png");
  });
});

describe("the sign-up bonus for email sign-ups", () => {
  it("is withheld until the email is confirmed", async () => {
    const id = await db.signUp({ confirmed: false, metadata: { username: unique("pending") } });
    expect((await db.profile(id)).coins).toBe(0);
    expect(await db.ledger(id)).toEqual([]);

    await db.confirmEmail(id);
    expect((await db.profile(id)).coins).toBe(50);
    expect(await db.ledger(id)).toEqual([[50, "signup_bonus"]]);
  });

  it("is never paid twice", async () => {
    const id = await db.signUp({ confirmed: false, metadata: { username: unique("once") } });
    await db.confirmEmail(id);
    // e.g. the address is changed and confirmed again
    await db.admin("update auth.users set email_confirmed_at = null where id = $1", [id]);
    await db.confirmEmail(id);

    expect((await db.profile(id)).coins).toBe(50);
    expect(await db.ledger(id)).toEqual([[50, "signup_bonus"]]);
  });

  it("cannot be claimed by calling the function directly", async () => {
    const { id } = await citizen();
    await expect(db.as(id, "select grant_signup_bonus($1)", [id])).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("changing a username", () => {
  const rename = (id: string, username: string, target = id) =>
    db.as(id, "update profiles set username = $1 where id = $2 returning username", [
      username,
      target,
    ]);

  it("lets a citizen rename themself", async () => {
    const { id } = await citizen();
    const username = unique("renamed");
    expect(await rename(id, username)).toEqual([{ username }]);
    expect((await db.profile(id)).username).toBe(username);
  });

  it.each(["ab", "has spaces", "x".repeat(21), "", "abríl", "a@b", "<b>hi</b>"])(
    "refuses the unacceptable username %j",
    async (username) => {
      const me = await citizen();
      await expect(rename(me.id, username)).rejects.toThrow(/not acceptable/);
      expect((await db.profile(me.id)).username).toBe(me.username);
    },
  );

  it("refuses a username that belongs to someone else, with the code the form expects", async () => {
    const me = await citizen();
    const other = await citizen();
    // UsernameForm shows its "taken" message for Postgres error 23505.
    await expect(rename(me.id, other.username)).rejects.toMatchObject({ code: "23505" });
  });

  it("does not let a citizen rename someone else", async () => {
    const me = await citizen();
    const other = await citizen();
    expect(await rename(me.id, unique("hijacked"), other.id)).toEqual([]);
    expect((await db.profile(other.id)).username).toBe(other.username);
  });

  it("does not let a visitor rename anyone", async () => {
    const other = await citizen();
    expect(
      await db.as(null, "update profiles set username = $1 where id = $2 returning id", [
        unique("anon"),
        other.id,
      ]),
    ).toEqual([]);
  });

  it("leaves an older email-derived name alone when other fields change", async () => {
    // Names derived from an email may contain characters the rule forbids.
    const local = `legacy+tag${unique("")}`;
    const id = await db.signUp({ email: `${local}@upc.edu` });
    expect((await db.profile(id)).username).toBe(local);

    await db.as(id, "update profiles set avatar_url = 'https://x.example/a.png' where id = $1", [
      id,
    ]);
    expect((await db.profile(id)).username).toBe(local);
  });
});

describe("fields only the Party may change", () => {
  it.each([
    ["coins", "coins = 1000000"],
    ["rank", "rank = 'Supreme Leader'"],
    ["is_admin", "is_admin = true"],
    ["machine_code", "machine_code = 'HACKED'"],
    // Back-dating it would let the daily bonus be claimed again.
    ["last_daily_bonus_at", "last_daily_bonus_at = '2000-01-01'"],
  ])("refuses a citizen editing their own %s", async (_column, assignment) => {
    const { id } = await citizen();
    const before = await db.profile(id);

    await expect(db.as(id, `update profiles set ${assignment} where id = $1`, [id])).rejects.toThrow(
      /Only the Party/,
    );
    expect(await db.profile(id)).toEqual(before);
  });

  it("refuses a citizen assigning themself a sponsor", async () => {
    const me = await citizen();
    const other = await citizen();
    await expect(
      db.as(me.id, "update profiles set invited_by = $1 where id = $2", [other.id, me.id]),
    ).rejects.toThrow(/Only the Party/);
  });
});

describe("claim_daily_bonus", () => {
  it("pays 10 coins once per day", async () => {
    const { id } = await citizen();
    const [today] = await db.admin<{ today: string }>("select current_date::text as today");

    expect(await db.as(id, "select claim_daily_bonus() as paid")).toEqual([{ paid: 10 }]);
    expect(await db.profile(id)).toMatchObject({ coins: 60, last_daily_bonus_at: today.today });
    expect(await db.ledger(id)).toEqual([
      [10, "daily_bonus"],
      [50, "signup_bonus"],
    ]);

    await expect(db.as(id, "select claim_daily_bonus()")).rejects.toThrow(
      /already been distributed/,
    );
    expect((await db.profile(id)).coins).toBe(60);
  });

  it("pays again the next day", async () => {
    const { id } = await citizen();
    await db.as(id, "select claim_daily_bonus()");
    await db.admin("update profiles set last_daily_bonus_at = current_date - 1 where id = $1", [id]);

    await db.as(id, "select claim_daily_bonus()");
    expect((await db.profile(id)).coins).toBe(70);
  });

  it("pays each citizen separately", async () => {
    const a = await citizen();
    const b = await citizen();
    await db.as(a.id, "select claim_daily_bonus()");
    await db.as(b.id, "select claim_daily_bonus()");

    expect((await db.profile(a.id)).coins).toBe(60);
    expect((await db.profile(b.id)).coins).toBe(60);
  });

  it("pays nothing to a visitor", async () => {
    await expect(db.as(null, "select claim_daily_bonus()")).rejects.toThrow();
  });
});

describe("buy_roll", () => {
  const rollsToday = (id: string) =>
    db.admin<{ extra_rolls: number; free_roll_used: boolean }>(
      "select extra_rolls, free_roll_used from daily_rolls where user_id = $1 and roll_date = current_date",
      [id],
    );

  it("spends 20 coins per extra roll and stops when the citizen cannot pay", async () => {
    const { id } = await citizen();

    await db.as(id, "select buy_roll()");
    expect((await db.profile(id)).coins).toBe(30);
    expect(await rollsToday(id)).toEqual([{ extra_rolls: 1, free_roll_used: false }]);

    await db.as(id, "select buy_roll()");
    expect((await db.profile(id)).coins).toBe(10);
    expect(await rollsToday(id)).toEqual([{ extra_rolls: 2, free_roll_used: false }]);

    await expect(db.as(id, "select buy_roll()")).rejects.toThrow(/Insufficient coins/);
    expect((await db.profile(id)).coins).toBe(10);
    expect(await rollsToday(id)).toEqual([{ extra_rolls: 2, free_roll_used: false }]);
    expect(await db.ledger(id)).toEqual([
      [-20, "roll_purchase"],
      [-20, "roll_purchase"],
      [50, "signup_bonus"],
    ]);
  });

  it("keeps a free roll that was already used today", async () => {
    const { id } = await citizen();
    await db.admin("insert into daily_rolls (user_id, free_roll_used) values ($1, true)", [id]);

    await db.as(id, "select buy_roll()");
    expect(await rollsToday(id)).toEqual([{ extra_rolls: 1, free_roll_used: true }]);
  });

  it("can be bought with exactly 20 coins", async () => {
    const { id } = await citizen();
    await db.admin("update profiles set coins = 20 where id = $1", [id]);

    await db.as(id, "select buy_roll()");
    expect((await db.profile(id)).coins).toBe(0);
  });
});

describe("redeem_invite", () => {
  it("pays 25 coins to both the new citizen and their sponsor", async () => {
    const sponsor = await citizen("sponsor");
    const recruit = await citizen("recruit");

    await db.as(recruit.id, "select redeem_invite($1)", [sponsor.username]);

    expect(await db.profile(recruit.id)).toMatchObject({ coins: 75, invited_by: sponsor.id });
    expect((await db.profile(sponsor.id)).coins).toBe(75);
    expect(await db.ledger(sponsor.id)).toContainEqual([25, "invite_bonus"]);
    expect(await db.ledger(recruit.id)).toContainEqual([25, "invite_bonus"]);
  });

  it("can only be redeemed once per citizen", async () => {
    const first = await citizen("sponsor");
    const second = await citizen("sponsor");
    const recruit = await citizen("recruit");
    await db.as(recruit.id, "select redeem_invite($1)", [first.username]);

    await expect(
      db.as(recruit.id, "select redeem_invite($1)", [second.username]),
    ).rejects.toThrow(/already been redeemed/);
    expect((await db.profile(recruit.id)).coins).toBe(75);
    expect((await db.profile(second.id)).coins).toBe(50);
  });

  it("refuses an unknown sponsor", async () => {
    const recruit = await citizen("recruit");
    await expect(
      db.as(recruit.id, "select redeem_invite($1)", ["nobody_at_all"]),
    ).rejects.toThrow(/Unknown sponsor/);
    expect((await db.profile(recruit.id)).coins).toBe(50);
  });

  it("refuses a citizen sponsoring themself", async () => {
    const me = await citizen();
    await expect(db.as(me.id, "select redeem_invite($1)", [me.username])).rejects.toThrow(
      /cannot sponsor themself/,
    );
    expect(await db.profile(me.id)).toMatchObject({ coins: 50, invited_by: null });
  });

  it("still finds a sponsor who has renamed themself", async () => {
    const sponsor = await citizen("sponsor");
    const recruit = await citizen("recruit");
    const renamed = unique("renamed_sponsor");
    await db.as(sponsor.id, "update profiles set username = $1 where id = $2", [
      renamed,
      sponsor.id,
    ]);

    await db.as(recruit.id, "select redeem_invite($1)", [renamed]);
    expect((await db.profile(recruit.id)).invited_by).toBe(sponsor.id);
  });
});

describe("grant_coins", () => {
  async function commissar() {
    const admin = await citizen("commissar");
    await db.admin("update profiles set is_admin = true where id = $1", [admin.id]);
    return admin;
  }

  it("lets an admin grant coins, recording who and why", async () => {
    const admin = await commissar();
    const target = await citizen();

    await db.as(admin.id, "select grant_coins($1, 40, 'event_grant', 'May Day parade')", [
      target.id,
    ]);

    expect((await db.profile(target.id)).coins).toBe(90);
    const [entry] = await db.admin(
      "select amount, reason, note, created_by from coin_transactions where user_id = $1 and reason = 'event_grant'",
      [target.id],
    );
    expect(entry).toEqual({
      amount: 40,
      reason: "event_grant",
      note: "May Day parade",
      created_by: admin.id,
    });
  });

  it("lets an admin take coins away", async () => {
    const admin = await commissar();
    const target = await citizen();
    await db.as(admin.id, "select grant_coins($1, -30, 'admin_grant')", [target.id]);
    expect((await db.profile(target.id)).coins).toBe(20);
  });

  it("refuses a citizen who is not an admin", async () => {
    const me = await citizen();
    await expect(
      db.as(me.id, "select grant_coins($1, 1000, 'admin_grant')", [me.id]),
    ).rejects.toThrow(/Only the Commissariat/);
    expect((await db.profile(me.id)).coins).toBe(50);
  });

  it("refuses a visitor", async () => {
    const target = await citizen();
    await expect(
      db.as(null, "select grant_coins($1, 1000, 'admin_grant')", [target.id]),
    ).rejects.toThrow();
    expect((await db.profile(target.id)).coins).toBe(50);
  });

  it.each(["signup_bonus", "daily_bonus", "roll_purchase", "whatever"])(
    "refuses the reason %j",
    async (reason) => {
      const admin = await commissar();
      const target = await citizen();
      await expect(
        db.as(admin.id, "select grant_coins($1, 10, $2)", [target.id, reason]),
      ).rejects.toThrow(/Invalid grant reason/);
      expect((await db.profile(target.id)).coins).toBe(50);
    },
  );
});

describe("who can see what", () => {
  it("lets citizens look each other up, but shows visitors nothing", async () => {
    const me = await citizen();
    const other = await citizen();

    expect(
      await db.as(me.id, "select username from profiles where id = $1", [other.id]),
    ).toEqual([{ username: other.username }]);
    expect(await db.as(null, "select username from profiles")).toEqual([]);
  });

  it("shows a citizen only their own coin ledger", async () => {
    const me = await citizen();
    const other = await citizen();

    const mine = await db.as<{ user_id: string }>(me.id, "select user_id from coin_transactions");
    expect(mine.map((row) => row.user_id)).toEqual([me.id]);
    expect(
      await db.as(me.id, "select 1 from coin_transactions where user_id = $1", [other.id]),
    ).toEqual([]);
  });

  it("shows an admin every ledger", async () => {
    const admin = await citizen("commissar");
    const other = await citizen();
    await db.admin("update profiles set is_admin = true where id = $1", [admin.id]);

    expect(
      await db.as(admin.id, "select amount from coin_transactions where user_id = $1", [other.id]),
    ).toEqual([{ amount: 50 }]);
  });

  it.each([
    [
      "write themself a ledger entry",
      "insert into coin_transactions (user_id, amount, reason) values ($1, 1000, 'admin_grant')",
    ],
    ["record a play for themself", "insert into rng_sessions (user_id, score) values ($1, 9999)"],
    ["give themself rolls", "insert into daily_rolls (user_id, extra_rolls) values ($1, 99)"],
  ])("does not let a citizen %s", async (_what, sql) => {
    const { id } = await citizen();
    await expect(db.as(id, sql, [id])).rejects.toThrow(/row-level security/);
  });

  it("does not let a citizen edit their rolls or delete ledger entries", async () => {
    const { id } = await citizen();
    await db.as(id, "select buy_roll()");

    expect(
      await db.as(id, "update daily_rolls set extra_rolls = 99 where user_id = $1 returning id", [
        id,
      ]),
    ).toEqual([]);
    expect(
      await db.as(id, "delete from coin_transactions where user_id = $1 returning id", [id]),
    ).toEqual([]);
    expect((await db.profile(id)).coins).toBe(30);
  });
});

describe("friendships", () => {
  const request = (from: string, to: string, as = from) =>
    db.as<{ id: string }>(
      as,
      "insert into friendships (user_id, friend_id) values ($1, $2) returning id",
      [from, to],
    );
  const accept = (requestId: string, as: string) =>
    db.as(as, "update friendships set status = 'accepted' where id = $1 returning status", [
      requestId,
    ]);
  const play = (userId: string, score: number) =>
    db.admin("insert into rng_sessions (user_id, score) values ($1, $2)", [userId, score]);
  const scoresSeenBy = async (viewer: string, player: string) =>
    (
      await db.as<{ score: number }>(
        viewer,
        "select score from rng_sessions where user_id = $1 order by score",
        [player],
      )
    ).map((row) => row.score);

  it("starts as a pending request that only the recipient can accept", async () => {
    const a = await citizen();
    const b = await citizen();
    const [{ id }] = await request(a.id, b.id);

    expect(await accept(id, a.id)).toEqual([]);
    expect(await accept(id, b.id)).toEqual([{ status: "accepted" }]);
  });

  it("cannot be sent in someone else's name", async () => {
    const a = await citizen();
    const b = await citizen();
    const c = await citizen();
    await expect(request(b.id, c.id, a.id)).rejects.toThrow(/row-level security/);
  });

  it("cannot be sent to oneself or twice to the same citizen", async () => {
    const a = await citizen();
    const b = await citizen();
    await expect(request(a.id, a.id)).rejects.toThrow();
    await request(a.id, b.id);
    await expect(request(a.id, b.id)).rejects.toMatchObject({ code: "23505" });
  });

  it("is invisible to citizens who are not part of it", async () => {
    const a = await citizen();
    const b = await citizen();
    const outsider = await citizen();
    await request(a.id, b.id);

    expect(await db.as(outsider.id, "select 1 from friendships")).toEqual([]);
    expect(await db.as(b.id, "select 1 from friendships")).toHaveLength(1);
  });

  it("can be withdrawn by either side but not by an outsider", async () => {
    const a = await citizen();
    const b = await citizen();
    const outsider = await citizen();
    const [{ id }] = await request(a.id, b.id);
    const remove = (as: string) =>
      db.as(as, "delete from friendships where id = $1 returning id", [id]);

    expect(await remove(outsider.id)).toEqual([]);
    expect(await remove(b.id)).toEqual([{ id }]);
  });

  it("shares play history only once the request is accepted", async () => {
    const a = await citizen();
    const b = await citizen();
    const outsider = await citizen();
    await play(a.id, 12);
    await play(a.id, 40);

    expect(await scoresSeenBy(a.id, a.id)).toEqual([12, 40]);
    expect(await scoresSeenBy(b.id, a.id)).toEqual([]);

    const [{ id }] = await request(a.id, b.id);
    expect(await scoresSeenBy(b.id, a.id)).toEqual([]);

    await accept(id, b.id);
    expect(await scoresSeenBy(b.id, a.id)).toEqual([12, 40]);
    expect(await scoresSeenBy(outsider.id, a.id)).toEqual([]);
  });
});

describe("leaderboard", () => {
  it("lists each player's best score and number of plays, without coin balances", async () => {
    const player = await citizen("champion");
    const idle = await citizen("spectator");
    await db.admin(
      "insert into rng_sessions (user_id, score) values ($1, 30), ($1, 95), ($1, 60)",
      [player.id],
    );

    const rows = await db.as(idle.id, "select * from leaderboard where user_id = any($1)", [
      [player.id, idle.id],
    ]);

    // Citizens who never played are not listed.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: player.id,
      username: player.username,
      best_score: 95,
    });
    expect(Number(rows[0].plays)).toBe(3);
    expect(Object.keys(rows[0])).not.toContain("coins");
    expect(Object.keys(rows[0])).not.toContain("machine_code");
  });
});
