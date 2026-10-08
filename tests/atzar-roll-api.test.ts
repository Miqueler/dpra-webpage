import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as roll } from "@/app/api/atzar/roll/route";
import { MAX_ROLL } from "@/lib/atzar/badges";
import { evaluateRoll } from "@/lib/atzar/machine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fakeSupabase, type FakeSupabase } from "./helpers/supabase";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

let session: FakeSupabase;
let admin: FakeSupabase;

function post(body: unknown = { locale: "en" }) {
  return new NextRequest("https://dpra.example.com/api/atzar/roll", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  session = fakeSupabase();
  admin = fakeSupabase();
  session.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null } as never);
  admin.rpc.mockResolvedValue({ data: "free", error: null });
  vi.mocked(createClient).mockResolvedValue(session as never);
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
});

describe("POST /api/atzar/roll", () => {
  it("refuses a visitor without rolling anything", async () => {
    session.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await roll(post());
    expect(response.status).toBe(401);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("rolls a number, scores it and records it for the citizen", async () => {
    const response = await roll(post());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Number.isInteger(body.number)).toBe(true);
    expect(body.number).toBeGreaterThanOrEqual(0);
    expect(body.number).toBeLessThanOrEqual(MAX_ROLL);
    // The score sent back is the one the badges give that number.
    expect(body).toEqual({ ...evaluateRoll(body.number, "en"), roll_type: "free" });

    expect(admin.rpc).toHaveBeenCalledWith("record_online_play", {
      target_user: "u1",
      play_score: body.score,
      play_payload: {
        number: body.number,
        badges: body.badges
          .filter((badge: { counts: boolean }) => badge.counts)
          .map((badge: { id: string }) => badge.id),
      },
    });
  });

  it("says when a purchased roll was spent", async () => {
    admin.rpc.mockResolvedValue({ data: "paid", error: null });
    expect((await (await roll(post())).json()).roll_type).toBe("paid");
  });

  it.each([
    ["the machine is switched off", "disabled", 403],
    ["the citizen has no rolls left", "no_rolls", 409],
  ])("keeps the number to itself when %s", async (_case, outcome, status) => {
    admin.rpc.mockResolvedValue({ data: outcome, error: null });
    const response = await roll(post());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: outcome });
  });

  it("reports a failure to record the play without revealing the number", async () => {
    admin.rpc.mockResolvedValue({ data: null, error: { message: "disk full" } });
    const response = await roll(post());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
  });

  it.each([
    ["an unknown language", { locale: "xx" }],
    ["no body at all", undefined],
  ])("still rolls when sent %s", async (_case, body) => {
    const request =
      body === undefined
        ? new NextRequest("https://dpra.example.com/api/atzar/roll", { method: "POST" })
        : post(body);
    expect((await roll(request)).status).toBe(200);
  });
});
