import {
  localize,
  scoreRoll,
  type BadgeRarity,
  type BadgeStats,
  type RollTier,
} from "./badges";
import stats from "./badge-stats.json";

/** A scored roll, ready to be sent to the browser in the citizen's language. */
export type RollResult = {
  number: number;
  /** Cheapest badge first, so the best one is revealed last. */
  badges: {
    id: string;
    emoji: string;
    name: string;
    description: string;
    points: number;
    rarity: BadgeRarity;
    /** False when a better badge of the same group took its place in the score. */
    counts: boolean;
  }[];
  score: number;
  /** The share of all possible rolls, 0 to 100, that score lower. */
  percentile: number;
  tier: RollTier;
};

export const badgeStats: BadgeStats = stats;

/** Scores a number with the badges and points currently in force. */
export function evaluateRoll(number: number, locale: string): RollResult {
  const roll = scoreRoll(number, badgeStats);
  return {
    number: roll.number,
    badges: roll.badges.map(({ badge, points, rarity, counts }) => ({
      id: badge.id,
      emoji: badge.emoji,
      name: localize(badge.name, locale),
      description: localize(badge.description, locale),
      points,
      rarity,
      counts,
    })),
    score: roll.score,
    percentile: roll.percentile,
    tier: roll.tier,
  };
}
