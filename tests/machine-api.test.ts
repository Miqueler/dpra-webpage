import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as status } from "@/app/api/machine/status/route";
import { POST as submit } from "@/app/api/machine/submit/route";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fakeQuery,
  fakeSupabase,
  routeTables,
  type FakeQuery,
  type FakeSupabase,
} from "./helpers/supabase";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const SECRET = "machine-secret";
const BASE = "https://dpra.example.com/api/machine";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

let supabase: FakeSupabase;
let profiles: FakeQuery;
let rolls: FakeQuery;
let sessions: FakeQuery;

/** Sets up what the database returns for the profile and today's roll row. */
function database({
  profile = { id: "u1", username: "abril", coins: 70 } as object | null,
  roll = null as { free_roll_used: boolean; extra_rolls: number } | null,
  insertError = null as { message: string } | null,
} = {}) {
  profiles = fakeQuery(
    profile ? { data: profile } : { error: { message: "no rows" } },
  );
  rolls = fakeQuery({ data: roll });
  sessions = fakeQuery({ error: insertError });
  routeTables(supabase, {
    profiles,
    daily_rolls: rolls,
    rng_sessions: sessions,
  });
}

beforeEach(() => {
  vi.stubEnv("MACHINE_API_SECRET", SECRET);
  supabase = fakeSupabase();
  vi.mocked(createAdminClient).mockReturnValue(supabase as never);
  database();
});

describe("GET /api/machine/status", () => {
  function get(query: string, secret: string | null = SECRET) {
    return new NextRequest(`${BASE}/status${query}`, {
      headers: secret === null ? undefined : { "x-machine-secret": secret },
    });
  }

  it.each([
    ["is missing", null],
    ["is wrong", "nope"],
    ["is empty", ""],
  ])("refuses the request when the secret %s", async (_case, secret) => {
    const response = await status(get("?code=ABC123", secret));
    expect(response.status).toBe(401);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("refuses every request when no secret is configured", async () => {
    vi.stubEnv("MACHINE_API_SECRET", "");
    const response = await status(get("?code=ABC123", ""));
    expect(response.status).toBe(401);
  });

  it("requires a machine code", async () => {
    const response = await status(get(""));
    expect(response.status).toBe(400);
  });

  it("answers 404 for an unknown machine code", async () => {
    database({ profile: null });
    const response = await status(get("?code=NOPE99"));
    expect(response.status).toBe(404);
  });

  it("looks the code up trimmed and upper-cased", async () => {
    await status(get("?code=%20abc123%20"));
    expect(profiles.eq).toHaveBeenCalledWith("machine_code", "ABC123");
  });

  it("offers the free roll to a citizen who has not played today", async () => {
    const response = await status(get("?code=ABC123"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      username: "abril",
      coins: 70,
      free_roll_available: true,
      extra_rolls: 0,
    });
    expect(rolls.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(rolls.eq).toHaveBeenCalledWith("roll_date", expect.stringMatching(DATE));
  });

  it("reports a used free roll and the purchased rolls left", async () => {
    database({ roll: { free_roll_used: true, extra_rolls: 2 } });
    const response = await status(get("?code=ABC123"));
    expect(await response.json()).toMatchObject({
      free_roll_available: false,
      extra_rolls: 2,
    });
  });

  it("still offers the free roll when only purchased rolls were recorded today", async () => {
    database({ roll: { free_roll_used: false, extra_rolls: 1 } });
    const response = await status(get("?code=ABC123"));
    expect(await response.json()).toMatchObject({
      free_roll_available: true,
      extra_rolls: 1,
    });
  });
});

describe("POST /api/machine/submit", () => {
  function post(body: unknown, secret: string | null = SECRET) {
    return new NextRequest(`${BASE}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        ...(secret === null ? {} : { "x-machine-secret": secret }),
      },
    });
  }

  it.each([
    ["is missing", null],
    ["is wrong", "nope"],
  ])("refuses the request when the secret %s", async (_case, secret) => {
    const response = await submit(post({ code: "ABC123", score: 10 }, secret));
    expect(response.status).toBe(401);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it.each([
    ["no code", { score: 10 }],
    ["no score", { code: "ABC123" }],
    ["a non-numeric score", { code: "ABC123", score: "10" }],
  ])("rejects a body with %s", async (_case, body) => {
    const response = await submit(post(body));
    expect(response.status).toBe(400);
    expect(sessions.insert).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown machine code", async () => {
    database({ profile: null });
    const response = await submit(post({ code: "NOPE99", score: 10 }));
    expect(response.status).toBe(404);
    expect(sessions.insert).not.toHaveBeenCalled();
  });

  it("records a free roll and marks it as used", async () => {
    const response = await submit(
      post({ code: " abc123 ", score: 42, payload: { dice: [4, 2] } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(profiles.eq).toHaveBeenCalledWith("machine_code", "ABC123");
    expect(rolls.upsert).toHaveBeenCalledWith(
      {
        user_id: "u1",
        roll_date: expect.stringMatching(DATE),
        free_roll_used: true,
      },
      { onConflict: "user_id,roll_date" },
    );
    expect(sessions.insert).toHaveBeenCalledWith({
      user_id: "u1",
      score: 42,
      payload: { dice: [4, 2] },
      source: "machine",
    });
  });

  it("accepts a score of zero", async () => {
    const response = await submit(post({ code: "ABC123", score: 0 }));
    expect(response.status).toBe(200);
    expect(sessions.insert).toHaveBeenCalledWith(
      expect.objectContaining({ score: 0, payload: null }),
    );
  });

  it("refuses a second free roll on the same day", async () => {
    database({ roll: { free_roll_used: true, extra_rolls: 0 } });
    const response = await submit(post({ code: "ABC123", score: 42 }));
    expect(response.status).toBe(409);
    expect(rolls.upsert).not.toHaveBeenCalled();
    expect(sessions.insert).not.toHaveBeenCalled();
  });

  it("spends one purchased roll for a paid play", async () => {
    database({ roll: { free_roll_used: true, extra_rolls: 3 } });
    const response = await submit(
      post({ code: "ABC123", score: 42, roll_type: "paid" }),
    );
    expect(response.status).toBe(200);
    expect(rolls.update).toHaveBeenCalledWith({ extra_rolls: 2 });
    expect(rolls.upsert).not.toHaveBeenCalled();
    expect(sessions.insert).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["has no roll record today", null],
    ["has no purchased rolls left", { free_roll_used: true, extra_rolls: 0 }],
  ])("refuses a paid play when the citizen %s", async (_case, roll) => {
    database({ roll });
    const response = await submit(
      post({ code: "ABC123", score: 42, roll_type: "paid" }),
    );
    expect(response.status).toBe(409);
    expect(rolls.update).not.toHaveBeenCalled();
    expect(sessions.insert).not.toHaveBeenCalled();
  });

  it("reports a failure to record the play", async () => {
    database({ insertError: { message: "disk full" } });
    const response = await submit(post({ code: "ABC123", score: 42 }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "disk full" });
  });
});
