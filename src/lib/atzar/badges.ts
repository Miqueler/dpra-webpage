// The ATZAR badges, and every calculation the machine does with them.
//
// To add a badge, add an entry to BADGES below. To remove one, delete its
// entry. Then run `npm run atzar:stats` so the points are recalculated. The
// full walk-through is in guide/08-online-machine-and-badges.md.
//
// This file imports nothing and uses only plain TypeScript, because
// scripts/atzar-stats.mjs runs it directly with Node.

/** The machine rolls a whole number from 0 to MAX_ROLL, both included. */
export const MAX_ROLL = 1_000_000;

export const LOCALES = ["ca", "es", "en"] as const;
export type BadgeLocale = (typeof LOCALES)[number];

/** Either the same text in every language, or one text per language. */
export type Localized = string | Record<BadgeLocale, string>;

/** What a badge's `check` receives: the number, and the same number as text. */
export type Roll = {
  /** The number that was rolled, e.g. 4096. */
  n: number;
  /** Its digits as written, without leading zeros, e.g. "4096". */
  s: string;
};

export type Badge = {
  /** Permanent identifier, stored with every play. Never reuse or rename. */
  id: string;
  emoji: string;
  name: Localized;
  description: Localized;
  /**
   * Badges that share a group are steps of the same idea ("ends in 0",
   * "ends in 00"...). A roll may earn several of them, but only the one
   * worth the most points counts towards the score.
   */
  group?: string;
  /** Whether the roll earns this badge. */
  check: (roll: Roll) => boolean;
  /** Numbers that must and must not earn it. `npm test` verifies them. */
  examples: { yes: number[]; no: number[] };
};

// ---------------------------------------------------------------------------
// Helpers for writing checks
// ---------------------------------------------------------------------------

/** Each digit as a number: "4096" → [4, 0, 9, 6]. */
export function digits(s: string): number[] {
  return [...s].map(Number);
}

/** Sum of the digits: "4096" → 19. */
export function digitSum(s: string): number {
  return digits(s).reduce((sum, d) => sum + d, 0);
}

/** How many different digits appear: "4004" → 2. */
export function distinct(s: string): number {
  return new Set(s).size;
}

/** The change between each digit and the next: "4096" → [-4, 9, -3]. */
export function steps(s: string): number[] {
  const d = digits(s);
  return d.slice(1).map((digit, i) => digit - d[i]);
}

/** Whether the same digit appears `length` times in a row: ("4447", 3) → true. */
export function hasRun(s: string, length: number): boolean {
  return new RegExp(`(\\d)\\1{${length - 1}}`).test(s);
}

export function isPalindrome(s: string): boolean {
  return s === [...s].reverse().join("");
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) return false;
  }
  return true;
}

/** Whether n is some whole number raised to `exponent`: (64, 3) → true. */
export function isPower(n: number, exponent: number): boolean {
  const root = Math.round(n ** (1 / exponent));
  return root ** exponent === n;
}

// ---------------------------------------------------------------------------
// The badges
// ---------------------------------------------------------------------------

export const BADGES: Badge[] = [
  {
    id: "EVEN",
    emoji: "⚖️",
    name: { ca: "Parell", es: "Par", en: "Even" },
    description: {
      ca: "Divisible per 2.",
      es: "Divisible entre 2.",
      en: "Divisible by 2.",
    },
    check: ({ n }) => n % 2 === 0,
    examples: { yes: [0, 4, 1000], no: [1, 11, 999] },
  },
  {
    id: "ODD",
    emoji: "🌓",
    name: { ca: "Senar", es: "Impar", en: "Odd" },
    description: {
      ca: "No és divisible per 2.",
      es: "No es divisible entre 2.",
      en: "Not divisible by 2.",
    },
    check: ({ n }) => n % 2 === 1,
    examples: { yes: [1, 11, 999], no: [0, 4, 1000] },
  },
  {
    id: "PRIME",
    emoji: "💎",
    name: { ca: "Primer", es: "Primo", en: "Prime" },
    description: {
      ca: "Només és divisible per 1 i per ell mateix.",
      es: "Solo es divisible entre 1 y entre sí mismo.",
      en: "Divisible only by 1 and by itself.",
    },
    check: ({ n }) => isPrime(n),
    examples: { yes: [2, 97, 999983], no: [0, 1, 91, 1000000] },
  },
  {
    id: "PALINDROME",
    emoji: "🪞",
    name: { ca: "Capicua", es: "Capicúa", en: "Palindrome" },
    description: {
      ca: "Es llegeix igual del dret que del revés.",
      es: "Se lee igual del derecho que del revés.",
      en: "Reads the same forwards and backwards.",
    },
    check: ({ s }) => s.length >= 2 && isPalindrome(s),
    examples: { yes: [11, 121, 123321], no: [7, 10, 123421] },
  },
  {
    id: "SQUARE",
    emoji: "🟥",
    name: { ca: "Quadrat perfecte", es: "Cuadrado perfecto", en: "Perfect square" },
    description: {
      ca: "És un nombre enter multiplicat per ell mateix.",
      es: "Es un número entero multiplicado por sí mismo.",
      en: "A whole number multiplied by itself.",
    },
    group: "POWER",
    check: ({ n }) => isPower(n, 2),
    examples: { yes: [0, 16, 998001], no: [2, 50, 999999] },
  },
  {
    id: "CUBE",
    emoji: "🧊",
    name: { ca: "Cub perfecte", es: "Cubo perfecto", en: "Perfect cube" },
    description: {
      ca: "És un nombre enter elevat al cub.",
      es: "Es un número entero elevado al cubo.",
      en: "A whole number raised to the third power.",
    },
    group: "POWER",
    check: ({ n }) => isPower(n, 3),
    examples: { yes: [0, 27, 1000000], no: [2, 100, 999] },
  },
  {
    id: "ROUND_10",
    emoji: "🧹",
    name: { ca: "Rodó", es: "Redondo", en: "Round" },
    description: {
      ca: "Acaba en zero.",
      es: "Acaba en cero.",
      en: "Ends in a zero.",
    },
    group: "ROUND",
    check: ({ s }) => s.endsWith("0"),
    examples: { yes: [0, 10, 12340], no: [1, 101, 12345] },
  },
  {
    id: "ROUND_100",
    emoji: "💯",
    name: { ca: "Molt rodó", es: "Muy redondo", en: "Very round" },
    description: {
      ca: "Acaba en dos zeros.",
      es: "Acaba en dos ceros.",
      en: "Ends in two zeros.",
    },
    group: "ROUND",
    check: ({ s }) => s.endsWith("00"),
    examples: { yes: [100, 12300], no: [0, 10, 12340] },
  },
  {
    id: "ROUND_1000",
    emoji: "🗿",
    name: { ca: "Rodó del tot", es: "Redondo del todo", en: "Perfectly round" },
    description: {
      ca: "Acaba en tres zeros o més.",
      es: "Acaba en tres ceros o más.",
      en: "Ends in three or more zeros.",
    },
    group: "ROUND",
    check: ({ s }) => s.endsWith("000"),
    examples: { yes: [1000, 120000, 1000000], no: [100, 999, 10010] },
  },
  {
    id: "RUN_2",
    emoji: "👯",
    name: { ca: "Bessons", es: "Gemelos", en: "Twins" },
    description: {
      ca: "Té dues xifres iguals seguides.",
      es: "Tiene dos cifras iguales seguidas.",
      en: "Has the same digit twice in a row.",
    },
    group: "RUN",
    check: ({ s }) => hasRun(s, 2),
    examples: { yes: [11, 18827, 100], no: [121, 18287, 5] },
  },
  {
    id: "RUN_3",
    emoji: "🎰",
    name: { ca: "Trigèmins", es: "Trillizos", en: "Triplets" },
    description: {
      ca: "Té tres xifres iguals seguides.",
      es: "Tiene tres cifras iguales seguidas.",
      en: "Has the same digit three times in a row.",
    },
    group: "RUN",
    check: ({ s }) => hasRun(s, 3),
    examples: { yes: [111, 1000, 12223], no: [11, 1212, 22122] },
  },
  {
    id: "RUN_4",
    emoji: "🍀",
    name: { ca: "Pòquer", es: "Póquer", en: "Four in a row" },
    description: {
      ca: "Té quatre xifres iguals seguides o més.",
      es: "Tiene cuatro cifras iguales seguidas o más.",
      en: "Has the same digit four or more times in a row.",
    },
    group: "RUN",
    check: ({ s }) => hasRun(s, 4),
    examples: { yes: [7777, 10000, 122223], no: [777, 1000, 121212] },
  },
  {
    id: "UNIFORM",
    emoji: "🪖",
    name: { ca: "Uniforme", es: "Uniforme", en: "Uniform" },
    description: {
      ca: "Totes les xifres són iguals. Cap desviació.",
      es: "Todas las cifras son iguales. Ninguna desviación.",
      en: "Every digit is the same. No deviation.",
    },
    check: ({ s }) => s.length >= 2 && distinct(s) === 1,
    examples: { yes: [11, 7777, 999999], no: [7, 121, 1000000] },
  },
  {
    id: "ALL_DIFFERENT",
    emoji: "🥗",
    name: { ca: "Sense repeticions", es: "Sin repeticiones", en: "No repeats" },
    description: {
      ca: "Té tres xifres o més i cap es repeteix.",
      es: "Tiene tres cifras o más y ninguna se repite.",
      en: "Has three or more digits and none of them repeats.",
    },
    check: ({ s }) => s.length >= 3 && distinct(s) === s.length,
    examples: { yes: [123, 90817, 654321], no: [12, 1223, 12321] },
  },
  {
    id: "CLIMB",
    emoji: "📈",
    name: { ca: "Pla quinquennal", es: "Plan quinquenal", en: "Five-year plan" },
    description: {
      ca: "Cada xifra és més gran que l'anterior. La producció només puja.",
      es: "Cada cifra es mayor que la anterior. La producción solo sube.",
      en: "Every digit is larger than the one before. Production only goes up.",
    },
    check: ({ s }) => s.length >= 3 && steps(s).every((step) => step > 0),
    examples: { yes: [123, 13579, 24689], no: [12, 1223, 4321] },
  },
  {
    id: "DESCENT",
    emoji: "📉",
    name: { ca: "Sabotatge", es: "Sabotaje", en: "Sabotage" },
    description: {
      ca: "Cada xifra és més petita que l'anterior.",
      es: "Cada cifra es menor que la anterior.",
      en: "Every digit is smaller than the one before.",
    },
    check: ({ s }) => s.length >= 3 && steps(s).every((step) => step < 0),
    examples: { yes: [321, 97531, 9520], no: [21, 3221, 1234] },
  },
  {
    id: "LIGHT",
    emoji: "🪶",
    name: { ca: "Ració reduïda", es: "Ración reducida", en: "Reduced ration" },
    description: {
      ca: "Les xifres sumen menys de 10.",
      es: "Las cifras suman menos de 10.",
      en: "Its digits add up to less than 10.",
    },
    check: ({ s }) => digitSum(s) < 10,
    examples: { yes: [0, 9, 201303], no: [19, 505, 999999] },
  },
  {
    id: "DOUBLETHINK",
    emoji: "👁️",
    name: { ca: "Doblepensar", es: "Doblepensar", en: "Doublethink" },
    description: {
      ca: 'Conté "225". Dos i dos fan cinc.',
      es: 'Contiene "225". Dos y dos son cinco.',
      en: 'Contains "225". Two and two make five.',
    },
    check: ({ s }) => s.includes("225"),
    examples: { yes: [225, 12250, 922500], no: [22, 252, 220025] },
  },
];

// ---------------------------------------------------------------------------
// Points and rarity
// ---------------------------------------------------------------------------

/**
 * What scripts/atzar-stats.mjs works out by trying every possible roll, and
 * saves in badge-stats.json.
 */
export type BadgeStats = {
  /** Changes whenever a badge is added, removed or its check is edited. */
  fingerprint: string;
  /** For each badge id, how many of the possible rolls earn it. */
  counts: Record<string, number>;
  /**
   * Scores of all possible rolls, sampled from worst to best: entry i is the
   * score at i/1000 of the way through.
   */
  scoreQuantiles: number[];
  /** The best score any roll can reach. */
  maxScore: number;
};

export const BADGE_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type BadgeRarity = (typeof BADGE_RARITIES)[number];

export const ROLL_TIERS = ["poor", "common", "uncommon", "rare", "epic", "legendary"] as const;
export type RollTier = (typeof ROLL_TIERS)[number];

const POSSIBLE_ROLLS = MAX_ROLL + 1;

/**
 * A badge is worth the number of rolls it takes, on average, to see it once:
 * a badge half of all numbers earn is worth 2 points, one that a single
 * number earns is worth a million.
 */
export function pointsFor(count: number): number {
  return count > 0 ? Math.max(1, Math.round(POSSIBLE_ROLLS / count)) : 0;
}

/** Rarer than 1 in 10 is uncommon, 1 in 100 rare, and so on. */
export function badgeRarity(points: number): BadgeRarity {
  if (points < 10) return "common";
  if (points < 100) return "uncommon";
  if (points < 1_000) return "rare";
  if (points < 10_000) return "epic";
  return "legendary";
}

/** The share of all possible rolls, 0 to 100, that score lower than this. */
export function scorePercentile(score: number, stats: BadgeStats): number {
  const lower = stats.scoreQuantiles.filter((other) => other < score).length;
  return Math.min(100, (lower / stats.scoreQuantiles.length) * 100);
}

export function rollTier(percentile: number): RollTier {
  if (percentile < 10) return "poor";
  if (percentile < 50) return "common";
  if (percentile < 75) return "uncommon";
  if (percentile < 90) return "rare";
  if (percentile < 99) return "epic";
  return "legendary";
}

// ---------------------------------------------------------------------------
// Scoring a roll
// ---------------------------------------------------------------------------

/** Every badge the number earns, in the order they are listed above. */
export function earnedBadges(n: number): Badge[] {
  const roll: Roll = { n, s: String(n) };
  return BADGES.filter((badge) => badge.check(roll));
}

export type ScoredBadge = {
  badge: Badge;
  points: number;
  rarity: BadgeRarity;
  /** False when a better badge of the same group took its place in the score. */
  counts: boolean;
};

export type ScoredRoll = {
  number: number;
  /** Cheapest badge first, so the best one is revealed last. */
  badges: ScoredBadge[];
  score: number;
  percentile: number;
  tier: RollTier;
};

/** The score of a set of earned badges: within a group, only the best counts. */
function score(earned: Badge[], counts: Record<string, number>) {
  const best = new Map<string, Badge>();
  for (const badge of earned) {
    if (!badge.group) continue;
    const current = best.get(badge.group);
    if (!current || pointsFor(counts[badge.id]) > pointsFor(counts[current.id])) {
      best.set(badge.group, badge);
    }
  }

  const badges = earned.map((badge) => {
    const points = pointsFor(counts[badge.id] ?? 0);
    return {
      badge,
      points,
      rarity: badgeRarity(points),
      counts: !badge.group || best.get(badge.group) === badge,
    };
  });
  const total = badges.reduce((sum, b) => sum + (b.counts ? b.points : 0), 0);
  return { badges, total };
}

export function scoreRoll(n: number, stats: BadgeStats): ScoredRoll {
  const { badges, total } = score(earnedBadges(n), stats.counts);
  const percentile = scorePercentile(total, stats);
  return {
    number: n,
    badges: badges.sort((a, b) => a.points - b.points),
    score: total,
    percentile,
    tier: rollTier(percentile),
  };
}

export function localize(text: Localized, locale: string): string {
  if (typeof text === "string") return text;
  return text[locale as BadgeLocale] ?? text.en;
}

// ---------------------------------------------------------------------------
// Statistics over every possible roll (run by `npm run atzar:stats`)
// ---------------------------------------------------------------------------

/**
 * A short code that changes when the badges change. It is worked out from a
 * fixed sample of numbers, so it is quick enough to check in the tests.
 */
export function badgeFingerprint(): string {
  let hash = 0x811c9dc5;
  const mix = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };

  mix(BADGES.map((badge) => `${badge.id}:${badge.group ?? ""}`).join(","));
  for (let n = 0; n <= MAX_ROLL; n += n < 2_000 ? 1 : 499) {
    mix(earnedBadges(n).map((badge) => badge.id).join(",") + ";");
  }
  return hash.toString(16).padStart(8, "0");
}

/** Tries every possible roll. Takes a few seconds. */
export function computeStats(): BadgeStats {
  const counts: Record<string, number> = Object.fromEntries(
    BADGES.map((badge) => [badge.id, 0]),
  );
  const earnedByRoll: Badge[][] = [];
  for (let n = 0; n <= MAX_ROLL; n++) {
    const earned = earnedBadges(n);
    for (const badge of earned) counts[badge.id] += 1;
    earnedByRoll.push(earned);
  }

  const scores = earnedByRoll.map((earned) => score(earned, counts).total);
  scores.sort((a, b) => a - b);

  const scoreQuantiles: number[] = [];
  for (let i = 0; i < 1000; i++) {
    scoreQuantiles.push(scores[Math.floor((i / 1000) * scores.length)]);
  }

  return {
    fingerprint: badgeFingerprint(),
    counts,
    scoreQuantiles,
    maxScore: scores[scores.length - 1],
  };
}
