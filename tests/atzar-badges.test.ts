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

describe("points and rarity", () => {
  it("is worth the number of rolls it takes to see the badge once", () => {
    expect(pointsFor((MAX_ROLL + 1) / 2)).toBe(2);
    expect(pointsFor(1)).toBe(MAX_ROLL + 1);
    expect(pointsFor(MAX_ROLL + 1)).toBe(1);
    expect(pointsFor(0)).toBe(0);
  });

  it("names rarer badges accordingly", () => {
    expect([2, 10, 100, 1_000, 10_000].map(badgeRarity)).toEqual([
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
    ]);
  });

  it("ranks a score against every possible roll", () => {
    const stats: BadgeStats = {
      fingerprint: "",
      counts: {},
      scoreQuantiles: [1, 1, 5, 5, 5, 5, 5, 5, 9, 20],
      maxScore: 20,
    };
    expect(scorePercentile(1, stats)).toBe(0);
    expect(scorePercentile(5, stats)).toBe(20);
    expect(scorePercentile(20, stats)).toBe(90);
    expect(scorePercentile(21, stats)).toBe(100);
    expect([0, 10, 50, 75, 90, 99].map(rollTier)).toEqual([
      "poor",
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
    ]);
  });
});

describe("scoring a roll", () => {
  const stats = (counts: Record<string, number>): BadgeStats => ({
    fingerprint: "",
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

  it("counts only the best badge of a group", () => {
    const grouped = BADGES.filter((badge) => badge.group === "ROUND").map((b) => b.id);
    const earned = ids(1000).filter((id) => grouped.includes(id));
    expect(earned.length).toBeGreaterThan(1);

    const roll = scoreRoll(1000, badgeStats);
    const inGroup = roll.badges.filter((b) => b.badge.group === "ROUND");
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
