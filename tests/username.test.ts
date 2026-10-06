import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { USERNAME_MAX_LENGTH, USERNAME_PATTERN, isValidUsername } from "@/lib/username";

describe("isValidUsername", () => {
  it.each(["abc", "Abril", "great.abril", "comrade_1", "a-b-c", "x".repeat(20)])(
    "accepts %s",
    (name) => {
      expect(isValidUsername(name)).toBe(true);
    },
  );

  it.each([
    ["empty", ""],
    ["too short", "ab"],
    ["too long", "x".repeat(21)],
    ["a space", "great abril"],
    ["surrounding spaces", " abril "],
    ["an @", "abril@upc"],
    ["a plus", "abril+1"],
    ["accented letters", "abríl"],
    ["a line break", "abril\nabril"],
    ["markup", "<b>abril</b>"],
  ])("rejects %s", (_reason, name) => {
    expect(isValidUsername(name)).toBe(false);
  });

  it("allows names up to the advertised maximum length", () => {
    expect(isValidUsername("x".repeat(USERNAME_MAX_LENGTH))).toBe(true);
    expect(isValidUsername("x".repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
  });
});

describe("username rule in the database", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/0003_choose_username.sql"),
    "utf8",
  );

  it("uses the same pattern as the app, everywhere it checks one", () => {
    const patterns = [...sql.matchAll(/~\s*'([^']+)'/g)].map((m) => m[1]);
    // One check when a citizen renames themself, one at sign-up.
    expect(patterns).toHaveLength(2);
    for (const pattern of patterns) {
      expect(pattern).toBe(USERNAME_PATTERN.source);
    }
  });
});
