import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RANKS } from "@/lib/ranks";
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

/** A citizen promoted to admin, the way the guide says to do it by hand. */
async function commissar() {
  const admin = await citizen("commissar");
  await db.admin("update profiles set is_admin = true where id = $1", [admin.id]);
  return admin;
}

beforeAll(async () => {
  db = await createDatabase();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("the functions the site calls", () => {
  // Supabase rejects an UPDATE or DELETE with no WHERE clause at run time
  // ("UPDATE requires a WHERE clause"). The in-memory Postgres does not, so
  // this reads the functions as they stand after every migration.
  it("never update or delete without a WHERE clause", async () => {
    const functions = await db.admin<{ name: string; body: string }>(
      `select p.proname as name, p.prosrc as body
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'`,
    );
    expect(functions.length).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const { name, body } of functions) {
      const code = body.replace(/--.*$/gm, "");
      for (const statement of code.split(";")) {
        const write = /\b(update\s+[\w.]+\s+set|delete\s+from)\b/i.test(statement);
        const upsert = /\bdo\s+update\s+set\b/i.test(statement);
        if (write && !upsert && !/\bwhere\b/i.test(statement)) offenders.push(name);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("signing up", () => {
  it("creates a profile with a machine code and the sign-up bonus", async () => {
    const id = await db.signUp({ email: "newcomer@upc.edu" });
    const profile = await db.profile(id);

    expect(profile).toMatchObject({
      username: "newcomer",
      coins: 50,
      rank: "citizen",
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

describe("set_rank", () => {
  it.each(RANKS)("lets an admin assign the rank %j", async (rank) => {
    const admin = await commissar();
    const target = await citizen();

    await db.as(admin.id, "select set_rank($1, $2)", [target.id, rank]);

    expect((await db.profile(target.id)).rank).toBe(rank);
  });

  it("knows exactly the ranks the site translates", async () => {
    const [{ definition }] = await db.admin<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition
       from pg_constraint where conname = 'profiles_rank_check'`,
    );
    const allowed = [...definition.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(allowed.sort()).toEqual([...RANKS].sort());
  });

  it("refuses a citizen who is not an admin", async () => {
    const me = await citizen();
    await expect(db.as(me.id, "select set_rank($1, 'supreme_leader')", [me.id])).rejects.toThrow(
      /Only the Commissariat/,
    );
    expect((await db.profile(me.id)).rank).toBe("citizen");
  });

  it("refuses a visitor", async () => {
    const target = await citizen();
    await expect(db.as(null, "select set_rank($1, 'supreme_leader')", [target.id])).rejects.toThrow();
    expect((await db.profile(target.id)).rank).toBe("citizen");
  });

  it.each(["", "Citizen", "Hero of Labour", "emperor", null])(
    "refuses the rank %j",
    async (rank) => {
      const admin = await commissar();
      const target = await citizen();
      await expect(
        db.as(admin.id, "select set_rank($1, $2)", [target.id, rank]),
      ).rejects.toThrow(/Unknown rank/);
      expect((await db.profile(target.id)).rank).toBe("citizen");
    },
  );

  it("refuses a citizen who does not exist", async () => {
    const admin = await commissar();
    await expect(
      db.as(admin.id, "select set_rank('00000000-0000-0000-0000-000000000000', 'comrade')"),
    ).rejects.toThrow(/Unknown citizen/);
  });
});

describe("delete_citizen", () => {
  const exists = async (id: string) =>
    (await db.admin("select 1 from auth.users where id = $1", [id])).length === 1;

  it("removes the citizen and everything attached to them", async () => {
    const admin = await commissar();
    const target = await citizen("doomed");
    const friend = await citizen("friend");
    await db.as(friend.id, "select redeem_invite($1)", [target.username]);
    await db.admin(
      "insert into friendships (user_id, friend_id, status) values ($1, $2, 'accepted')",
      [target.id, friend.id],
    );
    await db.admin("insert into rng_sessions (user_id, score) values ($1, 7)", [target.id]);

    await db.as(admin.id, "select delete_citizen($1)", [target.id]);

    expect(await exists(target.id)).toBe(false);
    expect(await db.profile(target.id)).toBeUndefined();
    for (const table of ["coin_transactions", "rng_sessions"]) {
      expect(await db.admin(`select 1 from ${table} where user_id = $1`, [target.id])).toEqual([]);
    }
    expect(
      await db.admin("select 1 from friendships where user_id = $1 or friend_id = $1", [target.id]),
    ).toEqual([]);
    // The people they knew stay, without a sponsor.
    expect(await db.profile(friend.id)).toMatchObject({ invited_by: null, coins: 75 });
  });

  it("keeps the coins a deleted former admin granted", async () => {
    const admin = await commissar();
    const former = await commissar();
    const target = await citizen();
    await db.as(former.id, "select grant_coins($1, 10, 'admin_grant')", [target.id]);
    await db.admin("update profiles set is_admin = false where id = $1", [former.id]);

    await db.as(admin.id, "select delete_citizen($1)", [former.id]);

    expect(await exists(former.id)).toBe(false);
    expect(
      await db.admin(
        "select created_by from coin_transactions where user_id = $1 and reason = 'admin_grant'",
        [target.id],
      ),
    ).toEqual([{ created_by: null }]);
    expect((await db.profile(target.id)).coins).toBe(60);
  });

  it("refuses to delete an admin, including oneself", async () => {
    const admin = await commissar();
    const other = await commissar();
    for (const id of [admin.id, other.id]) {
      await expect(db.as(admin.id, "select delete_citizen($1)", [id])).rejects.toThrow(
        /commissar cannot be deleted/,
      );
      expect(await exists(id)).toBe(true);
    }
  });

  it("refuses a citizen who is not an admin", async () => {
    const me = await citizen();
    const target = await citizen();
    await expect(db.as(me.id, "select delete_citizen($1)", [target.id])).rejects.toThrow(
      /Only the Commissariat/,
    );
    expect(await exists(target.id)).toBe(true);
  });

  it("refuses a visitor", async () => {
    const target = await citizen();
    await expect(db.as(null, "select delete_citizen($1)", [target.id])).rejects.toThrow();
    expect(await exists(target.id)).toBe(true);
  });

  it("refuses a citizen who does not exist", async () => {
    const admin = await commissar();
    await expect(
      db.as(admin.id, "select delete_citizen('00000000-0000-0000-0000-000000000000')"),
    ).rejects.toThrow(/Unknown citizen/);
  });
});

describe("admin_citizens", () => {
  it("shows an admin each citizen's file", async () => {
    const admin = await commissar();
    const sponsor = await citizen("sponsor");
    const local = unique("recruit");
    const recruit = await db.signUp({ email: `${local}@upc.edu`, confirmed: false });
    await db.confirmEmail(recruit);
    await db.as(recruit, "select redeem_invite($1)", [sponsor.username]);
    await db.admin(
      "insert into friendships (user_id, friend_id, status) values ($1, $2, 'accepted')",
      [recruit, sponsor.id],
    );
    await db.admin("insert into rng_sessions (user_id, score) values ($1, 7), ($1, 42)", [recruit]);
    await db.admin("update auth.users set last_sign_in_at = '2026-05-01T10:00:00Z' where id = $1", [
      recruit,
    ]);

    const rows = await db.as(admin.id, "select * from admin_citizens()");
    const file = (id: string) => rows.find((row) => row.id === id);

    expect(file(recruit)).toMatchObject({
      username: local,
      rank: "citizen",
      coins: 75,
      is_admin: false,
      email: `${local}@upc.edu`,
      email_confirmed: true,
      invited_by_username: sponsor.username,
      invited_count: 0,
      friend_count: 1,
      plays: 2,
      best_score: 42,
    });
    expect(file(recruit)!.last_sign_in_at).toEqual(new Date("2026-05-01T10:00:00Z"));
    expect(file(recruit)!.last_played_at).not.toBeNull();
    expect(file(sponsor.id)).toMatchObject({
      invited_by_username: null,
      invited_count: 1,
      friend_count: 1,
      plays: 0,
      best_score: null,
      last_played_at: null,
    });
    expect(file(admin.id)).toMatchObject({ is_admin: true });
  });

  it("marks an email that has not been confirmed", async () => {
    const admin = await commissar();
    const pending = await db.signUp({ confirmed: false });

    const [row] = await db.as(admin.id, "select * from admin_citizens() where id = $1", [pending]);
    expect(row).toMatchObject({ email_confirmed: false, coins: 0 });
  });

  it("lists citizens by username", async () => {
    const admin = await commissar();
    const rows = await db.as<{ username: string }>(
      admin.id,
      "select username from admin_citizens()",
    );
    const names = rows.map((row) => row.username);
    expect(names).toEqual([...names].sort());
  });

  it("refuses a citizen who is not an admin", async () => {
    const me = await citizen();
    await expect(db.as(me.id, "select * from admin_citizens()")).rejects.toThrow(
      /Only the Commissariat/,
    );
  });

  it("refuses a visitor", async () => {
    await expect(db.as(null, "select * from admin_citizens()")).rejects.toThrow();
  });
});

describe("linking a play to the machine", () => {
  /** What the machine route does when someone presses play. */
  async function pressPlay() {
    const [session] = await db.admin<{ code: string; expires_at: Date }>(
      "select * from create_machine_session()",
    );
    return session;
  }

  async function session(code: string) {
    const [row] = await db.admin<{
      user_id: string | null;
      claimed_at: Date | null;
      expires_at: Date;
    }>("select user_id, claimed_at, expires_at from machine_sessions where code = $1", [code]);
    return row;
  }

  it("gives the machine a different, typeable code for each play", async () => {
    const first = await pressPlay();
    const second = await pressPlay();

    expect(first.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(second.code).not.toBe(first.code);
    expect(first.expires_at.getTime()).toBeGreaterThan(Date.now());
    expect((await session(first.code)).user_id).toBeNull();
  });

  it("links the code to the citizen who types it in, however they type it", async () => {
    const me = await citizen();
    const { code } = await pressPlay();

    await db.as(me.id, "select claim_machine_session($1)", [` ${code.toLowerCase()} `]);

    const linked = await session(code);
    expect(linked.user_id).toBe(me.id);
    expect(linked.claimed_at).not.toBeNull();
  });

  it("lets the same citizen enter their code twice", async () => {
    const me = await citizen();
    const { code } = await pressPlay();
    await db.as(me.id, "select claim_machine_session($1)", [code]);
    await db.as(me.id, "select claim_machine_session($1)", [code]);
    expect((await session(code)).user_id).toBe(me.id);
  });

  it("does not let a second citizen take over a claimed code", async () => {
    const me = await citizen();
    const other = await citizen();
    const { code } = await pressPlay();
    await db.as(me.id, "select claim_machine_session($1)", [code]);

    await expect(db.as(other.id, "select claim_machine_session($1)", [code])).rejects.toThrow(
      /already been claimed/,
    );
    expect((await session(code)).user_id).toBe(me.id);
  });

  it("refuses a code the machine never showed", async () => {
    const me = await citizen();
    await expect(db.as(me.id, "select claim_machine_session('NOPE99')")).rejects.toThrow(
      /unknown or has expired/,
    );
  });

  it("refuses a code that has run out of time", async () => {
    const me = await citizen();
    const { code } = await pressPlay();
    await db.admin("update machine_sessions set expires_at = now() - interval '1 second' where code = $1", [
      code,
    ]);

    await expect(db.as(me.id, "select claim_machine_session($1)", [code])).rejects.toThrow(
      /unknown or has expired/,
    );
    expect((await session(code)).user_id).toBeNull();
  });

  it("refuses a code that was already played", async () => {
    const me = await citizen();
    const { code } = await pressPlay();
    await db.admin("update machine_sessions set used_at = now() where code = $1", [code]);

    await expect(db.as(me.id, "select claim_machine_session($1)", [code])).rejects.toThrow(
      /unknown or has expired/,
    );
  });

  it("refuses a visitor", async () => {
    const { code } = await pressPlay();
    await expect(db.as(null, "select claim_machine_session($1)", [code])).rejects.toThrow();
    expect((await session(code)).user_id).toBeNull();
  });

  it("keeps codes out of citizens' reach", async () => {
    const me = await citizen();
    await pressPlay();

    await expect(db.as(me.id, "select * from machine_sessions")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.as(me.id, "select * from create_machine_session()")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("clears out codes that expired more than a day ago", async () => {
    const stale = await pressPlay();
    const recent = await pressPlay();
    await db.admin("update machine_sessions set expires_at = now() - interval '2 days' where code = $1", [
      stale.code,
    ]);
    await db.admin("update machine_sessions set expires_at = now() - interval '1 hour' where code = $1", [
      recent.code,
    ]);

    await pressPlay();

    expect(await session(stale.code)).toBeUndefined();
    expect(await session(recent.code)).toBeDefined();
  });
});

describe("the online machine", () => {
  async function switchMachine(on: boolean) {
    await db.admin("update atzar_settings set online_enabled = $1 where id", [on]);
  }

  /** What the roll route does once it has rolled and scored a number. */
  async function play(userId: string, score = 123) {
    const [{ outcome }] = await db.admin<{ outcome: string }>(
      "select record_online_play($1, $2, $3) as outcome",
      [userId, score, JSON.stringify({ number: 4096 })],
    );
    return outcome;
  }

  async function plays(userId: string) {
    return db.admin<{ score: number; source: string; payload: unknown }>(
      "select score, source, payload from rng_sessions where user_id = $1 order by played_at",
      [userId],
    );
  }

  it("starts switched off, and only an admin can switch it", async () => {
    await switchMachine(false);
    const admin = await commissar();
    const me = await citizen();

    await expect(db.as(me.id, "select set_online_machine(true)")).rejects.toThrow(
      /Only the Commissariat/,
    );
    await expect(db.as(null, "select set_online_machine(true)")).rejects.toThrow();
    await expect(
      db.as(me.id, "update atzar_settings set online_enabled = true returning id"),
    ).resolves.toEqual([]);
    expect(await db.as(me.id, "select online_enabled from atzar_settings")).toEqual([
      { online_enabled: false },
    ]);

    await db.as(admin.id, "select set_online_machine(true)");
    const [settings] = await db.admin("select online_enabled, updated_by from atzar_settings");
    expect(settings).toEqual({ online_enabled: true, updated_by: admin.id });

    await db.as(admin.id, "select set_online_machine(false)");
    expect(await db.as(me.id, "select online_enabled from atzar_settings")).toEqual([
      { online_enabled: false },
    ]);
  });

  it("never holds more than one row of settings", async () => {
    await expect(db.admin("insert into atzar_settings (id) values (false)")).rejects.toThrow();
    await expect(db.admin("insert into atzar_settings default values")).rejects.toThrow();
  });

  it("records nothing and spends nothing while switched off", async () => {
    await switchMachine(false);
    const me = await citizen();

    expect(await play(me.id)).toBe("disabled");
    expect(await plays(me.id)).toEqual([]);
    expect(await db.admin("select * from daily_rolls where user_id = $1", [me.id])).toEqual([]);
  });

  it("spends the free roll first, then purchased rolls, then refuses", async () => {
    await switchMachine(true);
    const me = await citizen();
    await db.as(me.id, "select buy_roll()");

    expect(await play(me.id, 10)).toBe("free");
    expect(await play(me.id, 20)).toBe("paid");
    expect(await play(me.id, 30)).toBe("no_rolls");

    expect(await plays(me.id)).toEqual([
      { score: 10, source: "online", payload: { number: 4096 } },
      { score: 20, source: "online", payload: { number: 4096 } },
    ]);
    const [roll] = await db.admin(
      "select free_roll_used, extra_rolls from daily_rolls where user_id = $1",
      [me.id],
    );
    expect(roll).toEqual({ free_roll_used: true, extra_rolls: 0 });
  });

  it("shares the daily roll with the physical machine", async () => {
    await switchMachine(true);
    const me = await citizen();
    await db.admin("insert into daily_rolls (user_id, free_roll_used) values ($1, true)", [me.id]);
    expect(await play(me.id)).toBe("no_rolls");
  });

  it("puts online plays on the leaderboard", async () => {
    await switchMachine(true);
    const me = await citizen("online_player");
    await play(me.id, 777);

    const [row] = await db.as(me.id, "select best_score from leaderboard where user_id = $1", [
      me.id,
    ]);
    expect(row).toEqual({ best_score: 777 });
  });

  it("cannot be called by citizens to record a score of their choosing", async () => {
    await switchMachine(true);
    const me = await citizen();
    await expect(
      db.as(me.id, "select record_online_play($1, 999999, '{}')", [me.id]),
    ).rejects.toThrow(/permission denied/);
    expect(await plays(me.id)).toEqual([]);
  });
});

describe("email login toggle", () => {
  it("starts on, and only an admin can switch it", async () => {
    const admin = await commissar();
    const me = await citizen();

    expect(await db.as(null, "select email_login_enabled from auth_settings")).toEqual([
      { email_login_enabled: true },
    ]);

    await expect(db.as(me.id, "select set_email_login(false)")).rejects.toThrow(
      /Only the Commissariat/,
    );
    await expect(db.as(null, "select set_email_login(false)")).rejects.toThrow();
    await expect(
      db.as(me.id, "update auth_settings set email_login_enabled = false returning id"),
    ).resolves.toEqual([]);

    await db.as(admin.id, "select set_email_login(false)");
    const [settings] = await db.admin(
      "select email_login_enabled, updated_by from auth_settings",
    );
    expect(settings).toEqual({ email_login_enabled: false, updated_by: admin.id });
    expect(await db.as(null, "select email_login_enabled from auth_settings")).toEqual([
      { email_login_enabled: false },
    ]);

    await db.as(admin.id, "select set_email_login(true)");
    expect(await db.as(null, "select email_login_enabled from auth_settings")).toEqual([
      { email_login_enabled: true },
    ]);
  });

  it("never holds more than one row of settings", async () => {
    await expect(db.admin("insert into auth_settings (id) values (false)")).rejects.toThrow();
    await expect(db.admin("insert into auth_settings default values")).rejects.toThrow();
  });
});

describe("accepting the privacy policy", () => {
  async function acceptedAt(userId: string) {
    const [row] = await db.admin<{ privacy_accepted_at: Date | null }>(
      "select privacy_accepted_at from profiles where id = $1",
      [userId],
    );
    return row.privacy_accepted_at;
  }

  it("has not happened yet for a new citizen", async () => {
    const me = await citizen();
    expect(await acceptedAt(me.id)).toBeNull();
  });

  it("is recorded for the citizen who accepts, and nobody else", async () => {
    const me = await citizen();
    const other = await citizen();

    await db.as(me.id, "select accept_privacy_policy()");

    expect(await acceptedAt(me.id)).toBeInstanceOf(Date);
    expect(await acceptedAt(other.id)).toBeNull();
  });

  it("keeps the first date when accepted again", async () => {
    const me = await citizen();
    await db.admin("update profiles set privacy_accepted_at = '2026-01-01T00:00:00Z' where id = $1", [
      me.id,
    ]);

    await db.as(me.id, "select accept_privacy_policy()");

    expect(await acceptedAt(me.id)).toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("refuses a visitor", async () => {
    await expect(db.as(null, "select accept_privacy_policy()")).rejects.toThrow();
  });

  it("was granted in advance to everyone who already had an account", async () => {
    // The migration's own statement, run again over citizens who signed up
    // "before" it.
    const veteran = await citizen("veteran");
    expect(await acceptedAt(veteran.id)).toBeNull();

    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/0009_privacy_acceptance.sql"),
      "utf8",
    );
    const backfill = migration.match(/update public\.profiles[^;]+;/)?.[0];
    expect(backfill).toBeDefined();
    await db.admin(backfill!);

    expect(await acceptedAt(veteran.id)).toBeInstanceOf(Date);
  });
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

  it("runs with the caller's privileges, not its creator's", async () => {
    const [view] = await db.admin<{ reloptions: string[] | null }>(
      "select reloptions from pg_class where oid = 'public.leaderboard'::regclass",
    );
    expect(view.reloptions).toContain("security_invoker=true");
  });

  it("shows visitors nothing", async () => {
    const player = await citizen("champion");
    await db.admin("insert into rng_sessions (user_id, score) values ($1, 80)", [player.id]);

    await expect(db.as(null, "select * from leaderboard")).rejects.toThrow(/permission denied/);
    await expect(db.as(null, "select * from leaderboard_rows()")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("does not open up the play history behind it", async () => {
    const player = await citizen("champion");
    const stranger = await citizen("stranger");
    await db.admin("insert into rng_sessions (user_id, score) values ($1, 80)", [player.id]);

    expect(
      await db.as(stranger.id, "select * from rng_sessions where user_id = $1", [player.id]),
    ).toEqual([]);
  });
});

describe("the rolls an admin sees", () => {
  it("are everyone's", async () => {
    const admin = await commissar();
    const player = await citizen("roller");
    await db.admin("insert into rng_sessions (user_id, score) values ($1, 80)", [player.id]);

    expect(
      await db.as(admin.id, "select score from rng_sessions where user_id = $1", [player.id]),
    ).toEqual([{ score: 80 }]);
  });

  it("cannot be changed by them", async () => {
    const admin = await commissar();
    const player = await citizen("roller");
    await db.admin("insert into rng_sessions (user_id, score) values ($1, 80)", [player.id]);

    await db.as(admin.id, "update rng_sessions set score = 1 where user_id = $1", [player.id]);
    await db.as(admin.id, "delete from rng_sessions where user_id = $1", [player.id]);

    expect(await db.admin("select score from rng_sessions where user_id = $1", [player.id])).toEqual(
      [{ score: 80 }],
    );
  });
});
