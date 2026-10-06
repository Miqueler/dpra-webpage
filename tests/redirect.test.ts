import { describe, expect, it } from "vitest";
import { sameOriginPath } from "@/lib/redirect";

const ORIGIN = "https://dpra.example.com";
const FALLBACK = "/ca/profile";

describe("sameOriginPath", () => {
  it.each([
    ["/en/profile", "/en/profile"],
    ["/es/atzar?tab=friends", "/es/atzar?tab=friends"],
    [`${ORIGIN}/en/update-password`, "/en/update-password"],
    [`${ORIGIN}/ca/profile?welcome=1`, "/ca/profile?welcome=1"],
  ])("keeps the same-site target %s", (requested, expected) => {
    expect(sameOriginPath(requested, ORIGIN, FALLBACK)).toBe(expected);
  });

  it.each([
    ["another site", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example/steal"],
    ["a backslash-disguised host", "/\\evil.example/steal"],
    ["a userinfo trick", "@evil.example/steal"],
    ["a subdomain trick", ".evil.example/steal"],
    ["the same host over http", "http://dpra.example.com/en/profile"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a bare word", "profile"],
    ["an empty string", ""],
    ["nothing", null],
  ])("falls back for %s", (_reason, requested) => {
    expect(sameOriginPath(requested, ORIGIN, FALLBACK)).toBe(FALLBACK);
  });
});
