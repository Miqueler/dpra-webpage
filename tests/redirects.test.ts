import { describe, expect, it } from "vitest";
import { localeOfPath, safeNextPath } from "@/lib/redirects";

const ORIGIN = "https://dpra.example.com";
const DEFAULT = "/ca/profile";

/** Where the auth routes end up: they redirect to `${origin}${next}`. */
function destination(next: string | null) {
  return new URL(`${ORIGIN}${safeNextPath(next, ORIGIN)}`);
}

describe("safeNextPath", () => {
  it.each([
    ["/en/profile", "/en/profile"],
    ["/es/atzar?tab=friends", "/es/atzar?tab=friends"],
    [`${ORIGIN}/en/update-password`, "/en/update-password"],
    [`${ORIGIN}/ca/profile?welcome=1`, "/ca/profile?welcome=1"],
  ])("keeps the same-site target %s", (next, expected) => {
    expect(safeNextPath(next, ORIGIN)).toBe(expected);
  });

  it.each([
    ["nothing", null],
    ["an empty string", ""],
    ["another site", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example/steal"],
    ["a backslash-disguised host", "/\\evil.example/steal"],
    ["the same host over http", "http://dpra.example.com/en/profile"],
    ["a javascript: URL", "javascript:alert(1)"],
  ])("falls back to the default profile for %s", (_reason, next) => {
    expect(safeNextPath(next, ORIGIN)).toBe(DEFAULT);
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("https://evil.example", ORIGIN, "/en")).toBe("/en");
  });

  // Whatever comes in, the result must be a path, so that appending it to
  // the origin can never produce a URL on another host.
  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "\\\\evil.example/steal",
    "@evil.example/steal",
    ".evil.example/steal",
    ":80@evil.example",
    "javascript:alert(1)",
    "data:text/html,hi",
    " https://evil.example",
    "\thttps://evil.example",
  ])("never leaves the site for %j", (next) => {
    expect(safeNextPath(next, ORIGIN)).toMatch(/^\//);
    expect(destination(next).origin).toBe(ORIGIN);
  });
});

describe("localeOfPath", () => {
  it.each([
    ["/ca/profile", "ca"],
    ["/es", "es"],
    ["/en/atzar/friends?x=1", "en"],
  ])("reads the locale of %s", (path, locale) => {
    expect(localeOfPath(path)).toBe(locale);
  });

  it.each(["/", "/profile", "/english/profile", "/fr/profile", "/@evil.example"])(
    "defaults to Catalan for %s",
    (path) => {
      expect(localeOfPath(path)).toBe("ca");
    },
  );
});
