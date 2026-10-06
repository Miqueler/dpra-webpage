import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as callback } from "@/app/auth/callback/route";
import { GET as confirm } from "@/app/auth/confirm/route";
import { POST as signout } from "@/app/auth/signout/route";
import { createClient } from "@/lib/supabase/server";
import { fakeSupabase, type FakeSupabase } from "./helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const ORIGIN = "https://dpra.example.com";
const EXTERNAL_TARGETS = [
  "https://evil.example/steal",
  "//evil.example/steal",
  "/\\evil.example/steal",
  "@evil.example/steal",
  ".evil.example/steal",
];

let supabase: FakeSupabase;

function get(path: string) {
  return new NextRequest(`${ORIGIN}${path}`);
}

function location(response: Response) {
  return response.headers.get("location");
}

function expectOnSite(response: Response) {
  expect(new URL(location(response)!).origin).toBe(ORIGIN);
}

beforeEach(() => {
  supabase = fakeSupabase();
  vi.mocked(createClient).mockResolvedValue(supabase as never);
});

describe("GET /auth/callback (Google login)", () => {
  it("exchanges the code and continues to the requested page", async () => {
    const response = await callback(get("/auth/callback?code=abc&next=%2Fen%2Fprofile"));
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(location(response)).toBe(`${ORIGIN}/en/profile`);
  });

  it("defaults to the Catalan profile when no target is given", async () => {
    const response = await callback(get("/auth/callback?code=abc"));
    expect(location(response)).toBe(`${ORIGIN}/ca/profile`);
  });

  it("returns to the login page when the code is missing", async () => {
    const response = await callback(get("/auth/callback"));
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location(response)).toBe(`${ORIGIN}/ca/login?error=auth`);
  });

  it.each(["ca", "es", "en"])(
    "returns to the %s login page when the code is rejected",
    async (locale) => {
      supabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: { message: "bad code" },
      });
      const response = await callback(
        get(`/auth/callback?code=abc&next=%2F${locale}%2Fprofile`),
      );
      expect(location(response)).toBe(`${ORIGIN}/${locale}/login?error=auth`);
    },
  );

  it.each(EXTERNAL_TARGETS)("never redirects off-site to %s", async (target) => {
    const response = await callback(
      get(`/auth/callback?code=abc&next=${encodeURIComponent(target)}`),
    );
    expectOnSite(response);
  });

  it.each(EXTERNAL_TARGETS)(
    "never redirects off-site to %s when the code is rejected",
    async (target) => {
      supabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: { message: "bad code" },
      });
      const response = await callback(
        get(`/auth/callback?code=abc&next=${encodeURIComponent(target)}`),
      );
      expectOnSite(response);
    },
  );
});

describe("GET /auth/confirm (email links)", () => {
  it("verifies the token and continues to the requested page", async () => {
    const next = encodeURIComponent(`${ORIGIN}/es/profile`);
    const response = await confirm(
      get(`/auth/confirm?token_hash=hash&type=email&next=${next}`),
    );
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: "email",
      token_hash: "hash",
    });
    expect(location(response)).toBe(`${ORIGIN}/es/profile`);
  });

  it("sends password recovery links to the update-password page", async () => {
    const next = encodeURIComponent(`${ORIGIN}/en/update-password`);
    const response = await confirm(
      get(`/auth/confirm?token_hash=hash&type=recovery&next=${next}`),
    );
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "hash",
    });
    expect(location(response)).toBe(`${ORIGIN}/en/update-password`);
  });

  it("defaults to the Catalan profile when no target is given", async () => {
    const response = await confirm(get("/auth/confirm?token_hash=hash&type=email"));
    expect(location(response)).toBe(`${ORIGIN}/ca/profile`);
  });

  it.each(EXTERNAL_TARGETS)("never redirects off-site to %s", async (target) => {
    const response = await confirm(
      get(`/auth/confirm?token_hash=hash&type=email&next=${encodeURIComponent(target)}`),
    );
    expectOnSite(response);
  });

  it.each(["ca", "es", "en"])(
    "shows the link error on the %s login page when the token is rejected",
    async (locale) => {
      supabase.auth.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
      const next = encodeURIComponent(`${ORIGIN}/${locale}/profile`);
      const response = await confirm(
        get(`/auth/confirm?token_hash=hash&type=email&next=${next}`),
      );
      expect(location(response)).toBe(`${ORIGIN}/${locale}/login?error=link`);
    },
  );

  it.each([
    ["the token", "/auth/confirm?type=email"],
    ["the type", "/auth/confirm?token_hash=hash"],
  ])("shows the link error without verifying when %s is missing", async (_what, path) => {
    const response = await confirm(get(path));
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(location(response)).toBe(`${ORIGIN}/ca/login?error=link`);
  });
});

describe("POST /auth/signout", () => {
  function post(referer?: string) {
    return new NextRequest(`${ORIGIN}/auth/signout`, {
      method: "POST",
      headers: referer ? { referer } : undefined,
    });
  }

  it("signs the citizen out", async () => {
    await signout(post());
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it.each(["ca", "es", "en"])("returns to the %s home page they came from", async (locale) => {
    const response = await signout(post(`${ORIGIN}/${locale}/profile`));
    expect(location(response)).toBe(`${ORIGIN}/${locale}`);
  });

  it("defaults to the Catalan home page", async () => {
    const response = await signout(post());
    expect(location(response)).toBe(`${ORIGIN}/ca`);
  });

  // 303 turns the form POST into a GET; a 307 would re-POST to the home page.
  it("redirects with 303", async () => {
    const response = await signout(post());
    expect(response.status).toBe(303);
  });
});
