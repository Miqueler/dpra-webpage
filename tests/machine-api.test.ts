import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createSession } from "@/app/api/machine/session/route";
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
// The routes' shared helpers are server-only; there is no server here.
vi.mock("server-only", () => ({}));

const SECRET = "machine-secret";
const BASE = "https://dpra.example.com/api/machine";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

let supabase: FakeSupabase;
let machineSessions: FakeQuery;
let profiles: FakeQuery;
let rolls: FakeQuery;
let sessions: FakeQuery;

type Session = {
  id: string;
  user_id: string | null;
  expires_at: string;
  used_at: string | null;
};

/** A code a citizen has claimed and not yet played with. */
function linkedSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    user_id: "u1",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    used_at: null,
    ...overrides,
  };
}

/**
 * Sets up what the database returns for the code's session, the citizen who
 * claimed it and their roll row for today.
 */
function database({
  session = linkedSession() as Session | null,
  profile = { id: "u1", username: "abril", coins: 70 } as object | null,
  roll = null as { free_roll_used: boolean; extra_rolls: number } | null,
  insertError = null as { message: string } | null,
} = {}) {
  machineSessions = fakeQuery({ data: session });
  profiles = fakeQuery(
    profile ? { data: profile } : { error: { message: "no rows" } },
  );
  rolls = fakeQuery({ data: roll });
  sessions = fakeQuery({ error: insertError });
  routeTables(supabase, {
    machine_sessions: machineSessions,
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

  it("requires a code", async () => {
    const response = await status(get(""));
    expect(response.status).toBe(400);
  });

  it("answers 404 for a code the machine never showed", async () => {
    database({ session: null });
    const response = await status(get("?code=NOPE99"));
    expect(response.status).toBe(404);
  });

  it.each([
    ["was already played", { used_at: "2026-05-01T10:00:00Z" }],
    ["has run out of time", { expires_at: "2020-01-01T00:00:00Z" }],
  ])("answers 410 for a code that %s", async (_case, overrides) => {
    database({ session: linkedSession(overrides) });
    const response = await status(get("?code=ABC123"));
    expect(response.status).toBe(410);
    expect(profiles.select).not.toHaveBeenCalled();
  });

  it("looks the code up trimmed and upper-cased", async () => {
    await status(get("?code=%20abc123%20"));
    expect(machineSessions.eq).toHaveBeenCalledWith("code", "ABC123");
  });

  it("says the code is not linked until a citizen claims it", async () => {
    database({ session: linkedSession({ user_id: null }) });
    const response = await status(get("?code=ABC123"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ linked: false });
    expect(profiles.select).not.toHaveBeenCalled();
  });

  it("offers the free roll to a citizen who has not played today", async () => {
    const response = await status(get("?code=ABC123"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      linked: true,
      username: "abril",
      coins: 70,
      free_roll_available: true,
      extra_rolls: 0,
    });
    expect(profiles.eq).toHaveBeenCalledWith("id", "u1");
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

  it("answers 404 for a code the machine never showed", async () => {
    database({ session: null });
    const response = await submit(post({ code: "NOPE99", score: 10 }));
    expect(response.status).toBe(404);
    expect(sessions.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["was already played", { used_at: "2026-05-01T10:00:00Z" }],
    ["has run out of time", { expires_at: "2020-01-01T00:00:00Z" }],
  ])("answers 410 for a code that %s", async (_case, overrides) => {
    database({ session: linkedSession(overrides) });
    const response = await submit(post({ code: "ABC123", score: 10 }));
    expect(response.status).toBe(410);
    expect(rolls.upsert).not.toHaveBeenCalled();
    expect(sessions.insert).not.toHaveBeenCalled();
  });

  it("refuses a play under a code no citizen has claimed", async () => {
    database({ session: linkedSession({ user_id: null }) });
    const response = await submit(post({ code: "ABC123", score: 10 }));
    expect(response.status).toBe(409);
    expect(rolls.upsert).not.toHaveBeenCalled();
    expect(sessions.insert).not.toHaveBeenCalled();
  });

  it("records a free roll, marks it as used and spends the code", async () => {
    const response = await submit(
      post({ code: " abc123 ", score: 42, payload: { dice: [4, 2] } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(machineSessions.eq).toHaveBeenCalledWith("code", "ABC123");
    expect(machineSessions.update).toHaveBeenCalledWith({
      used_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(machineSessions.eq).toHaveBeenCalledWith("id", "s1");
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
    // The code stays good, so the citizen can buy a roll and try again.
    expect(machineSessions.update).not.toHaveBeenCalled();
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

describe("POST /api/machine/session", () => {
  function post(secret: string | null = SECRET) {
    return new NextRequest(`${BASE}/session`, {
      method: "POST",
      headers: secret === null ? undefined : { "x-machine-secret": secret },
    });
  }

  it.each([
    ["is missing", null],
    ["is wrong", "nope"],
  ])("refuses the request when the secret %s", async (_case, secret) => {
    const response = await createSession(post(secret));
    expect(response.status).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("hands the machine a fresh code to show", async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ code: "XK42PM", expires_at: "2026-05-01T10:10:00Z" }],
      error: null,
    });
    const response = await createSession(post());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      code: "XK42PM",
      expires_at: "2026-05-01T10:10:00Z",
    });
    expect(supabase.rpc).toHaveBeenCalledWith("create_machine_session");
  });

  it("reports a failure to create a code", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "disk full" } });
    const response = await createSession(post());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "disk full" });
  });
});
