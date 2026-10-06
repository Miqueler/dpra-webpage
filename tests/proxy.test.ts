import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import proxy, { config } from "@/proxy";

const getUser = vi.hoisted(() => vi.fn(async () => ({ data: { user: null } })));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

function handledByProxy(path: string) {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));
}

beforeEach(() => {
  getUser.mockClear();
});

describe("proxy matcher", () => {
  it.each(["/", "/ca", "/es/profile", "/en/atzar/leaderboard", "/profile"])(
    "handles the page %s",
    (path) => {
      expect(handledByProxy(path)).toBe(true);
    },
  );

  it.each([
    "/api/machine/status",
    "/api/machine/submit",
    "/_next/static/chunk.js",
    "/favicon.ico",
  ])("leaves %s alone", (path) => {
    expect(handledByProxy(path)).toBe(false);
  });

  // The auth route handlers live outside /[locale]. If the proxy handled
  // them it would redirect to /ca/auth/…, which does not exist — breaking
  // Google login, email confirmation links, password resets and logout.
  it.each(["/auth/callback", "/auth/confirm", "/auth/signout"])(
    "leaves the auth route %s alone",
    (path) => {
      expect(handledByProxy(path)).toBe(false);
    },
  );
});

describe("proxy", () => {
  it("sends an unprefixed page to the default locale", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/profile"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/ca/profile");
  });

  it.each(["ca", "es", "en"])("serves /%s pages without redirecting", async (locale) => {
    const response = await proxy(
      new NextRequest(`http://localhost:3000/${locale}/profile`),
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("refreshes the Supabase session on every navigation", async () => {
    await proxy(new NextRequest("http://localhost:3000/en"));
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});
