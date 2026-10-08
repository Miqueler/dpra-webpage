import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BADGES,
  LOCALES,
  MAX_ROLL,
  badgeFingerprint,
  badgeRarity,
  earnedBadges,
  pointsFor,
  rollTier,
  scorePercentile,
  scoreRoll,
  type BadgeStats,
} from "@/lib/atzar/badges";
import { badgeStats, evaluateRoll } from "@/lib/atzar/machine";

const ids = (n: number) => earnedBadges(n).map((badge) => badge.id);

describe("every badge", () => {
  it("has its own id", () => {
    const all = BADGES.map((badge) => badge.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(BADGES.map((badge) => [badge.id, badge] as const))(
    "%s is earned by its examples and by nothing it rules out",
    (_id, badge) => {
      expect(badge.examples.yes.length).toBeGreaterThan(0);
      expect(badge.examples.no.length).toBeGreaterThan(0);
      for (const n of badge.examples.yes) {
        expect(ids(n), `${n} should earn ${badge.id}`).toContain(badge.id);
      }
      for (const n of badge.examples.no) {
        expect(ids(n), `${n} should not earn ${badge.id}`).not.toContain(badge.id);
      }
    },
  );

  it.each(BADGES.map((badge) => [badge.id, badge] as const))(
    "%s has a name and description in every language",
    (_id, badge) => {
      for (const text of [badge.name, badge.description]) {
        const versions = typeof text === "string" ? [text] : LOCALES.map((l) => text[l]);
        for (const version of versions) expect(version?.trim()).toBeTruthy();
      }
    },
  );
});

describe("badge-stats.json", () => {
  // If this fails, a badge was added, removed or edited without recalculating.
  it("is up to date with the badges — otherwise run `npm run atzar:stats`", () => {
    expect(badgeStats.fingerprint).toBe(badgeFingerprint());
    expect(Object.keys(badgeStats.counts).sort()).toEqual(BADGES.map((b) => b.id).sort());
  });

  it("gives every badge at least one number that earns it", () => {
    const never = BADGES.filter((badge) => !badgeStats.counts[badge.id]).map((b) => b.id);
    expect(never).toEqual([]);
  });

  it("keeps the best possible score within what the database column holds", () => {
    expect(badgeStats.maxScore).toBeLessThan(2 ** 31);
  });
});

describe("rngdle-badges.md", () => {
  // The file lists what each badge is worth on rngdle, where the roll goes up
  // to 1,000,000. Our counts stop at MAX_ROLL, so the numbers above it are
  // added back before comparing.
  const listed = new Map<string, number>();
  const file = readFileSync(join(process.cwd(), "rngdle-badges.md"), "utf8");
  for (const line of file.split("\n")) {
    const row = line.match(/^(.+?) \t([\d,]+) \t(?:Common|Uncommon|Rare|Epic|Anomaly|Mythic) \t/);
    if (row) listed.set(row[1].trim(), Number(row[2].replaceAll(",", "")));
  }
  const RNGDLE_MAX = 1_000_000;

  it("lists 233 badges", () => {
    expect(listed.size).toBe(233);
  });

  it("gives every badge of ours the same value our rules do", () => {
    const wrong: string[] = [];
    for (const badge of BADGES) {
      const expected = listed.get(String(badge.name));
      if (expected === undefined) continue;
      let count = badgeStats.counts[badge.id];
      for (let n = MAX_ROLL + 1; n <= RNGDLE_MAX; n++) {
        if (ids(n).includes(badge.id)) count += 1;
      }
      const ours = pointsFor(count, RNGDLE_MAX + 1);
      if (ours !== expected) wrong.push(`${badge.id}: ${ours} instead of ${expected}`);
    }
    expect(wrong).toEqual([]);
  });

  it("has every listed badge that can be rolled here", () => {
    const names = new Set(BADGES.map((badge) => badge.name));
    const missing = [...listed.keys()].filter((name) => !names.has(name));
    // "One Million" needs a roll of 1,000,000, above MAX_ROLL.
    expect(missing).toEqual(MAX_ROLL >= RNGDLE_MAX ? [] : ["One Million"]);
  });
});

describe("points and rarity", () => {
  it("is worth 100 points divided by the chance of rolling the badge", () => {
    expect(pointsFor(500_000, 1_000_000)).toBe(200);
    expect(pointsFor(1, 1_000_000)).toBe(100_000_000);
    expect(pointsFor(1_000_000, 1_000_000)).toBe(100);
    expect(pointsFor(3, 1_000_000)).toBe(33_333_333);
    expect(pointsFor(0, 1_000_000)).toBe(0);
  });

  it("names rarer badges accordingly", () => {
    expect([200, 1_000, 10_000, 100_000, 1_000_000, 10_000_000].map(badgeRarity)).toEqual([
      "common",
      "uncommon",
      "rare",
      "epic",
      "anomaly",
      "mythic",
    ]);
  });

  it("ranks a score against every possible roll", () => {
    const stats: BadgeStats = {
      fingerprint: "",
      rolls: 10,
      counts: {},
      scoreQuantiles: [1, 1, 5, 5, 5, 5, 5, 5, 9, 20],
      maxScore: 20,
    };
    expect(scorePercentile(1, stats)).toBe(0);
    expect(scorePercentile(5, stats)).toBe(20);
    expect(scorePercentile(20, stats)).toBe(90);
    expect(scorePercentile(21, stats)).toBe(100);
    expect([0, 1, 50, 75, 90, 95, 99].map(rollTier)).toEqual([
      "trash",
      "common",
      "uncommon",
      "rare",
      "epic",
      "anomaly",
      "mythic",
    ]);
  });
});

describe("scoring a roll", () => {
  const stats = (counts: Record<string, number>): BadgeStats => ({
    fingerprint: "",
    rolls: MAX_ROLL + 1,
    counts,
    scoreQuantiles: [0],
    maxScore: 0,
  });

  it("adds up the points of the badges earned", () => {
    const earned = ids(7);
    expect(earned.length).toBeGreaterThan(0);
    const roll = scoreRoll(7, badgeStats);
    expect(roll.score).toBe(
      roll.badges.filter((b) => b.counts).reduce((sum, b) => sum + b.points, 0),
    );
    expect(roll.badges.map((b) => b.badge.id).sort()).toEqual([...earned].sort());
  });

  it("counts only the best badge of a family", () => {
    const family = BADGES.filter((badge) => badge.family === "VOID_DEPTH").map((b) => b.id);
    const earned = ids(1000).filter((id) => family.includes(id));
    expect(earned.length).toBeGreaterThan(1);

    const roll = scoreRoll(1000, badgeStats);
    const inGroup = roll.badges.filter((b) => b.badge.family === "VOID_DEPTH");
    const counted = inGroup.filter((b) => b.counts);
    expect(counted).toHaveLength(1);
    expect(counted[0].points).toBe(Math.max(...inGroup.map((b) => b.points)));
  });

  it("reveals the cheapest badge first and the best one last", () => {
    const points = scoreRoll(1000, badgeStats).badges.map((b) => b.points);
    expect(points).toEqual([...points].sort((a, b) => a - b));
  });

  it("scores a roll with no badges as zero", () => {
    expect(scoreRoll(7, stats({})).score).toBe(0);
  });

  it("counts every badge that has no family", () => {
    const loose = scoreRoll(123456, badgeStats).badges.filter((b) => !b.badge.family);
    expect(loose.length).toBeGreaterThan(5);
    expect(loose.every((b) => b.counts)).toBe(true);
  });

  it("handles both ends of the range", () => {
    expect(scoreRoll(0, badgeStats).number).toBe(0);
    expect(scoreRoll(MAX_ROLL, badgeStats).number).toBe(MAX_ROLL);
  });
});

describe("evaluateRoll", () => {
  it.each(LOCALES)("describes the badges in %s", (locale) => {
    const result = evaluateRoll(1000, locale);
    expect(result.badges.length).toBeGreaterThan(0);
    for (const badge of result.badges) {
      expect(badge.name).toBeTruthy();
      expect(badge.description).toBeTruthy();
    }
  });

  it("falls back to English for a language it does not know", () => {
    expect(evaluateRoll(1000, "xx").badges.map((b) => b.name)).toEqual(
      evaluateRoll(1000, "en").badges.map((b) => b.name),
    );
  });
});
