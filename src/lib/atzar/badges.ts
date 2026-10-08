// The ATZAR badges, and every calculation the machine does with them.
//
// The badges, their families and what they are worth follow rngdle, as listed
// in rngdle-badges.md at the root of the repository.
//
// To add a badge, add an entry to BADGES below. To remove one, delete its
// entry. Then run `npm run atzar:stats` so the points are recalculated. The
// full walk-through is in guide/08-online-machine-and-badges.md.
//
// This file imports nothing and uses only plain TypeScript, because
// scripts/atzar-stats.mjs runs it directly with Node.

/** The machine rolls a whole number from 0 to MAX_ROLL, both included. */
export const MAX_ROLL = 999_999;

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
   * Badges that share a family are versions of the same idea ("ends in 0",
   * "ends in 00"...). A roll may earn several of them, but only the one
   * worth the most points counts towards the score.
   */
  family?: string;
  /** Whether the roll earns this badge. */
  check: (roll: Roll) => boolean;
  /** Numbers that must and must not earn it. `npm test` verifies them. */
  examples: { yes: number[]; no: number[] };
};

// ---------------------------------------------------------------------------
// Helpers for writing checks
// ---------------------------------------------------------------------------

/**
 * Remembers the answer for the last text asked about. Every badge is checked
 * against the same roll, so this saves working the same thing out 200 times.
 */
function remember<T>(work: (s: string) => T): (s: string) => T {
  let lastText: string | null = null;
  let lastAnswer: T;
  return (s) => {
    if (s !== lastText) {
      lastAnswer = work(s);
      lastText = s;
    }
    return lastAnswer;
  };
}

/** Each digit as a number: "4096" → [4, 0, 9, 6]. */
export function digits(s: string): number[] {
  return [...s].map(Number);
}

/** Sum of the digits: "4096" → 19. */
export function digitSum(s: string): number {
  let sum = 0;
  for (const d of s) sum += Number(d);
  return sum;
}

/** Product of the digits: "432" → 24. */
export function digitProduct(s: string): number {
  let product = 1;
  for (const d of s) product *= Number(d);
  return product;
}

/** The last digit, as text: "4096" → "6". */
export function last(s: string): string {
  return s[s.length - 1];
}

/** How many different digits appear: "4004" → 2. */
export function distinct(s: string): number {
  return tally(s).filter((c) => c > 0).length;
}

/** How many times each digit 0–9 appears: "4004" → [2, 0, 0, 0, 2, 0, ...]. */
export const tally = remember((s: string): number[] => {
  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const d of s) counts[Number(d)] += 1;
  return counts;
});

/** How many times one digit appears: ("4004", "0") → 2. */
export function count(s: string, digit: string): number {
  return tally(s)[Number(digit)];
}

/** The change between each digit and the next: "4096" → [-4, 9, -3]. */
export const steps = remember((s: string): number[] => {
  const changes: number[] = [];
  for (let i = 1; i < s.length; i++) changes.push(Number(s[i]) - Number(s[i - 1]));
  return changes;
});

/**
 * The ups and downs of the digits as letters: u (up), d (down), f (flat).
 * "1332" → "ufd". Handy with a regular expression: /^u+d+$/ is "rises, then
 * falls".
 */
export const shape = remember((s: string): string =>
  steps(s)
    .map((step) => (step > 0 ? "u" : step < 0 ? "d" : "f"))
    .join(""),
);

/** The digits grouped by repeats: "44477" → ["444", "77"]. */
export const runs = remember((s: string): string[] => s.match(/(\d)\1*/g) ?? []);

/** Whether the same digit appears `length` times in a row: ("4447", 3) → true. */
export function hasRun(s: string, length: number): boolean {
  return runs(s).some((run) => run.length >= length);
}

/** Whether it has `length` digits in a row counting up or down: ("9876", 3) → true. */
export function hasSequence(s: string, length: number): boolean {
  return substrings(s, length, length).some((part) => {
    const changes = steps(part);
    return changes.every((c) => c === 1) || changes.every((c) => c === -1);
  });
}

/** Every stretch of the digits at least `min` (and at most `max`) long. */
export function substrings(s: string, min: number, max = s.length): string[] {
  const parts: string[] = [];
  for (let length = min; length <= Math.min(max, s.length); length++) {
    for (let start = 0; start + length <= s.length; start++) {
      parts.push(s.slice(start, start + length));
    }
  }
  return parts;
}

export function isPalindrome(s: string): boolean {
  for (let i = 0; i < s.length / 2; i++) {
    if (s[i] !== s[s.length - 1 - i]) return false;
  }
  return true;
}

/** Whether the digits, once sorted, count up one by one: "3124" → true. */
export function isShuffledRun(s: string): boolean {
  const sorted = digits(s).sort((a, b) => a - b);
  return sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
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

/** Whether n is `base` raised to some whole number: (81, 3) → true. */
export function isPowerOf(n: number, base: number): boolean {
  let power = 1;
  while (power < n) power *= base;
  return power === n;
}

const FIBONACCI = new Set<number>();
for (let a = 0, b = 1; a <= 10_000_000; [a, b] = [b, a + b]) FIBONACCI.add(a);

const FACTORIALS = new Set<number>();
for (let n = 1, f = 1; f <= 10_000_000; n++, f *= n) FACTORIALS.add(f);

function hasLeadingZero(part: string): boolean {
  return part.length > 1 && part[0] === "0";
}

/**
 * Every way of cutting the digits into `parts` numbers, none written with a
 * leading zero: ("1234", 2) → [[1, 234], [12, 34], [123, 4]].
 */
export function splits(s: string, parts: number): number[][] {
  // Several badges cut the same roll the same way; keep the answers.
  if (s !== splitsOf.text) splitsOf = { text: s, byParts: new Map() };
  let found = splitsOf.byParts.get(parts);
  if (!found) {
    found = cutInto(s, parts);
    splitsOf.byParts.set(parts, found);
  }
  return found;
}

let splitsOf = { text: "", byParts: new Map<number, number[][]>() };

function cutInto(s: string, parts: number): number[][] {
  if (parts === 1) return hasLeadingZero(s) || s === "" ? [] : [[Number(s)]];
  const found: number[][] = [];
  for (let cut = 1; cut <= s.length - (parts - 1); cut++) {
    const head = s.slice(0, cut);
    if (hasLeadingZero(head)) continue;
    for (const rest of cutInto(s.slice(cut), parts - 1)) {
      found.push([Number(head), ...rest]);
    }
  }
  return found;
}

/** Whether the values only go up, or only go down. */
function isOrdered(values: number[]): boolean {
  const up = values.every((v, i) => i === 0 || v > values[i - 1]);
  const down = values.every((v, i) => i === 0 || v < values[i - 1]);
  return up || down;
}

/**
 * The whole number cut into `parts` consecutive integers in any order, at
 * least one of them with two or more digits: ("605961", 3) → [60, 59, 61].
 */
function consecutiveSplit(s: string, parts: number): number[] | null {
  for (const values of splits(s, parts)) {
    if (!values.some((v) => v >= 10)) continue;
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)) return values;
  }
  return null;
}

/**
 * Where `howMany` consecutive integers written back to back end, if they
 * start at `start` with a number `firstLength` digits long and count in
 * `direction` (+1 or -1). At least one must have two or more digits.
 * Answers -1 when they are not there.
 */
function consecutiveRunEnd(
  s: string,
  start: number,
  firstLength: number,
  direction: number,
  howMany: number,
): number {
  const first = s.slice(start, start + firstLength);
  if (hasLeadingZero(first)) return -1;

  let end = start;
  let twoDigits = false;
  for (let k = 0; k < howMany; k++) {
    const value = Number(first) + k * direction;
    if (value < 0) return -1;
    const text = String(value);
    if (!s.startsWith(text, end)) return -1;
    end += text.length;
    if (text.length >= 2) twoDigits = true;
  }
  return twoDigits ? end : -1;
}

/** Contains two consecutive integers back to back, without being just that. */
function containsConsecutivePair(s: string): boolean {
  for (let start = 0; start < s.length; start++) {
    for (let length = 1; length <= s.length - start - 1; length++) {
      for (const direction of [1, -1]) {
        const end = consecutiveRunEnd(s, start, length, direction, 2);
        if (end >= 0 && !(start === 0 && end === s.length)) return true;
      }
    }
  }
  return false;
}

/** Contains `howMany` (3 or more) consecutive integers back to back, without being just that. */
function containsConsecutive(s: string, howMany: number): boolean {
  for (let start = 0; start < s.length; start++) {
    let end = -1;
    search: for (let length = 1; length <= s.length - start - (howMany - 1); length++) {
      for (const direction of [1, -1]) {
        end = consecutiveRunEnd(s, start, length, direction, howMany);
        if (end >= 0) break search;
      }
    }
    if (end >= 0 && !(start === 0 && end === s.length)) return true;
  }
  return false;
}

/** Contains two consecutive integers with at least one digit between them. */
function containsConsecutiveApart(s: string): boolean {
  const parts: { value: number; start: number; end: number }[] = [];
  for (let start = 0; start < s.length; start++) {
    for (let end = start + 1; end <= s.length; end++) {
      const text = s.slice(start, end);
      if (!hasLeadingZero(text)) parts.push({ value: Number(text), start, end });
    }
  }
  return parts.some((a) =>
    parts.some(
      (b) =>
        a.end < b.start &&
        Math.abs(a.value - b.value) === 1 &&
        (a.value >= 10 || b.value >= 10),
    ),
  );
}

/** Splits into three or more numbers that keep the same difference (not 0 or ±1). */
function isArithmetic(s: string): boolean {
  for (let parts = 3; parts <= s.length; parts++) {
    for (const values of splits(s, parts)) {
      const difference = values[1] - values[0];
      if (Math.abs(difference) <= 1) continue;
      if (values.every((v, i) => i === 0 || v - values[i - 1] === difference)) return true;
    }
  }
  return false;
}

/** Splits into three or more positive numbers that keep the same ratio (not 1). */
function isGeometric(s: string): boolean {
  for (let parts = 3; parts <= s.length; parts++) {
    for (const values of splits(s, parts)) {
      if (values.some((v) => v <= 0) || values[0] === values[1]) continue;
      if (values.every((v, i) => i < 2 || values[i - 1] ** 2 === values[i - 2] * v)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Shortcuts for the most common kinds of badge
// ---------------------------------------------------------------------------

/** One text per language. */
function tr(en: string, es: string, ca: string): Localized {
  return { en, es, ca };
}

function withNote(text: Localized, note?: Localized): Localized {
  if (!note) return text;
  const pick = (value: Localized, locale: BadgeLocale) =>
    typeof value === "string" ? value : value[locale];
  return {
    en: `${pick(text, "en")} ${pick(note, "en")}`,
    es: `${pick(text, "es")} ${pick(note, "es")}`,
    ca: `${pick(text, "ca")} ${pick(note, "ca")}`,
  };
}

type Extra = { family?: string; note?: Localized };

/** A badge for numbers that contain these digits somewhere. */
function contains(id: string, emoji: string, name: string, text: string, extra: Extra = {}): Badge {
  const padded = Number(`1${text}`);
  return {
    id,
    emoji,
    name,
    description: withNote(
      tr(`Contains "${text}".`, `Contiene "${text}".`, `Conté "${text}".`),
      extra.note,
    ),
    family: extra.family,
    check: ({ s }) => s.includes(text),
    examples: {
      yes: text[0] === "0" || padded > MAX_ROLL ? [padded > MAX_ROLL ? Number(text) : padded] : [Number(text), padded],
      no: [Number(text) + 1],
    },
  };
}

/** A badge for one exact number (or one of a few). */
function exactly(id: string, emoji: string, name: string, values: number[], extra: Extra = {}): Badge {
  const list = (or: string) => values.join(` ${or} `);
  return {
    id,
    emoji,
    name,
    description: withNote(
      tr(`Exactly ${list("or")}.`, `Exactamente ${list("o")}.`, `Exactament ${list("o")}.`),
      extra.note,
    ),
    family: extra.family,
    check: ({ n }) => values.includes(n),
    examples: {
      yes: values,
      no: [values[0] + 1, values[0] * 10 + 1].filter((n) => !values.includes(n)),
    },
  };
}

/** A badge for numbers that end in these digits. */
function endsWith(id: string, emoji: string, name: string, text: string, extra: Extra = {}): Badge {
  return {
    id,
    emoji,
    name,
    description: withNote(
      tr(`Ends in "${text}".`, `Acaba en "${text}".`, `Acaba en "${text}".`),
      extra.note,
    ),
    family: extra.family,
    check: ({ s }) => s.endsWith(text),
    examples: { yes: [Number(`1${text}`)], no: [Number(`1${text}`) + 1] },
  };
}

/** A badge for perfect powers: squares, cubes and so on. */
function power(id: string, emoji: string, exponent: number): Badge {
  const ordinal = exponent === 2 ? "2nd" : exponent === 3 ? "3rd" : `${exponent}th`;
  return {
    id,
    emoji,
    name: `${ordinal} Power`,
    description: tr(
      `A whole number raised to the power of ${exponent}.`,
      `Un número entero elevado a ${exponent}.`,
      `Un nombre enter elevat a ${exponent}.`,
    ),
    family: "POWER",
    check: ({ n }) => isPower(n, exponent),
    examples: { yes: [0, 2 ** exponent], no: [2 ** exponent + 1, 7] },
  };
}

/** A badge for numbers with exactly one of a digit. */
function exactlyOne(id: string, emoji: string, name: string, digit: string): Badge {
  const other = digit === "3" ? "4" : "3";
  return {
    id,
    emoji,
    name,
    description: tr(
      `Contains exactly one "${digit}".`,
      `Contiene exactamente un "${digit}".`,
      `Conté exactament un "${digit}".`,
    ),
    check: ({ s }) => count(s, digit) === 1,
    examples: {
      yes: [Number(digit), Number(`${other}${digit}`)],
      no: [Number(`${other}${digit}${digit}`), Number(other)],
    },
  };
}

/** A badge for numbers with exactly this many digits. */
function digitCount(id: string, emoji: string, name: string, length: number): Badge {
  return {
    id,
    emoji,
    name,
    description: tr(
      `Has exactly ${length} digits.`,
      `Tiene exactamente ${length} cifras.`,
      `Té exactament ${length} xifres.`,
    ),
    check: ({ s }) => s.length === length,
    examples: { yes: [10 ** (length - 1), 10 ** length - 1], no: [10 ** (length - 1) - 1, 7] },
  };
}

// ---------------------------------------------------------------------------
// The badges
// ---------------------------------------------------------------------------

const UPSIDE_DOWN = (word: string) =>
  tr(
    `It spells ${word} upside down.`,
    `Del revés se lee ${word}.`,
    `Cap per avall s'hi llegeix ${word}.`,
  );

export const BADGES: Badge[] = [
  // --- Whole-number properties -------------------------------------------
  {
    id: "PRIME",
    emoji: "💎",
    name: "Prime Number",
    description: tr("Divisible only by 1 and itself.", "Solo es divisible entre 1 y entre sí mismo.", "Només és divisible per 1 i per ell mateix."),
    check: ({ n }) => isPrime(n),
    examples: { yes: [2, 97, 997], no: [0, 1, 100] },
  },
  {
    id: "EVEN",
    emoji: "⚖️",
    name: "Even",
    description: tr("Divisible by 2.", "Divisible entre 2.", "Divisible per 2."),
    check: ({ n }) => n % 2 === 0,
    examples: { yes: [0, 4, 1000], no: [1, 11, 999] },
  },
  {
    id: "ODD",
    emoji: "🦄",
    name: "Odd",
    description: tr("Not divisible by 2.", "No es divisible entre 2.", "No és divisible per 2."),
    check: ({ n }) => n % 2 === 1,
    examples: { yes: [1, 11, 999], no: [0, 4, 1000] },
  },
  {
    id: "DOZEN",
    emoji: "🍩",
    name: "Dozen",
    description: tr("Divisible by 12.", "Divisible entre 12.", "Divisible per 12."),
    check: ({ n }) => n > 0 && n % 12 === 0,
    examples: { yes: [12, 144, 1200], no: [0, 13, 100] },
  },
  {
    id: "LUCKY_SEVEN_DIV",
    emoji: "🎰",
    name: "Lucky Seven (Divisible)",
    description: tr("Divisible by 7.", "Divisible entre 7.", "Divisible per 7."),
    check: ({ n }) => n > 0 && n % 7 === 0,
    examples: { yes: [7, 49, 700], no: [0, 8, 100] },
  },
  {
    id: "ELEVEN",
    emoji: "🕚",
    name: "Eleven",
    description: tr("Divisible by 11.", "Divisible entre 11.", "Divisible per 11."),
    check: ({ n }) => n > 0 && n % 11 === 0,
    examples: { yes: [11, 121, 1100], no: [0, 12, 100] },
  },
  {
    id: "HARSHAD",
    emoji: "🤝",
    name: "Harshad Number",
    description: tr("Divisible by the sum of its own digits.", "Divisible entre la suma de sus cifras.", "Divisible per la suma de les seves xifres."),
    check: ({ n, s }) => n > 0 && n % digitSum(s) === 0,
    examples: { yes: [1, 18, 108], no: [0, 11, 103] },
  },
  {
    id: "SPY",
    emoji: "🕵️",
    name: "Spy Number",
    description: tr("The sum of its digits equals their product.", "La suma de sus cifras es igual a su producto.", "La suma de les seves xifres és igual al seu producte."),
    check: ({ n, s }) => n !== 1 && n !== 2 && digitSum(s) === digitProduct(s),
    examples: { yes: [0, 22, 123], no: [1, 23, 999] },
  },
  {
    id: "PRONIC",
    emoji: "🧮",
    name: "Pronic Number",
    description: tr("The product of two consecutive whole numbers.", "El producto de dos números enteros consecutivos.", "El producte de dos nombres enters consecutius."),
    check: ({ n }) => Number.isInteger((Math.sqrt(4 * n + 1) - 1) / 2),
    examples: { yes: [0, 6, 42], no: [1, 15, 100] },
  },
  {
    id: "FIBONACCI",
    emoji: "🐚",
    name: "Fibonacci Number",
    description: tr("Part of the Fibonacci sequence.", "Forma parte de la sucesión de Fibonacci.", "Forma part de la successió de Fibonacci."),
    check: ({ n }) => FIBONACCI.has(n),
    examples: { yes: [0, 13, 144], no: [4, 100, 1000] },
  },
  {
    id: "FACTORIAL",
    emoji: "❗",
    name: "Factorial",
    description: tr("A factorial (n!).", "Un factorial (n!).", "Un factorial (n!)."),
    check: ({ n }) => FACTORIALS.has(n),
    examples: { yes: [1, 24, 362880], no: [0, 3, 1000] },
  },
  {
    id: "POWER_OF_TWO",
    emoji: "💾",
    name: "Power of Two",
    description: tr("A power of 2.", "Una potencia de 2.", "Una potència de 2."),
    check: ({ n }) => isPowerOf(n, 2),
    examples: { yes: [1, 64, 1024], no: [0, 6, 1000] },
  },
  {
    id: "POWER_OF_THREE",
    emoji: "🔺",
    name: "Power of Three",
    description: tr("A power of 3.", "Una potencia de 3.", "Una potència de 3."),
    check: ({ n }) => isPowerOf(n, 3),
    examples: { yes: [1, 81, 59049], no: [0, 6, 1000] },
  },
  {
    id: "POWER_OF_FIVE",
    emoji: "🖐️",
    name: "Power of Five",
    description: tr("A power of 5.", "Una potencia de 5.", "Una potència de 5."),
    check: ({ n }) => isPowerOf(n, 5),
    examples: { yes: [1, 625, 390625], no: [0, 50, 625000] },
  },
  {
    id: "POWER_OF_SEVEN",
    emoji: "🌈",
    name: "Power of Seven",
    description: tr("A power of 7.", "Una potencia de 7.", "Una potència de 7."),
    check: ({ n }) => isPowerOf(n, 7),
    examples: { yes: [1, 343, 823543], no: [0, 70, 49000] },
  },
  {
    id: "EQUATION",
    emoji: "🟰",
    name: "Equation",
    description: tr(
      "Insert one of + − × ÷ and an equals sign to make a true equation.",
      "Añade uno de + − × ÷ y un signo igual y sale una ecuación cierta.",
      "Afegeix-hi un de + − × ÷ i un signe igual i surt una equació certa.",
    ),
    check: ({ s }) =>
      splits(s, 3).some(
        ([a, b, c]) =>
          a > 0 && b > 0 && c > 0 && (a + b === c || a - b === c || a * b === c || a / b === c),
      ),
    examples: { yes: [112, 933, 213455], no: [124, 999, 55] },
  },
  {
    id: "COLOSSAL",
    emoji: "🪨",
    name: "Colossal",
    description: tr("Greater than 999,000.", "Mayor que 999.000.", "Més gran que 999.000."),
    check: ({ n }) => n > 999_000,
    examples: { yes: [999001, 999999], no: [999000, 500000] },
  },

  // --- Perfect powers ------------------------------------------------------
  power("SQUARE", "🟦", 2),
  power("CUBE", "🧊", 3),
  power("FOURTH_POWER", "📦", 4),
  power("FIFTH_POWER", "🖐️", 5),
  power("SIXTH_POWER", "🎲", 6),
  power("SEVENTH_POWER", "🌈", 7),
  power("EIGHTH_POWER", "🎱", 8),
  power("NINTH_POWER", "☁️", 9),
  power("TENTH_POWER", "🔟", 10),
  power("ELEVENTH_POWER", "🕚", 11),
  power("THIRTEENTH_POWER", "💀", 13),
  power("SEVENTEENTH_POWER", "🧙", 17),
  power("NINETEENTH_POWER", "🌑", 19),
  {
    id: "OUROBOROS",
    emoji: "🐍",
    name: "Ouroboros",
    description: tr("A number raised to itself (1¹, 2², 3³...).", "Un número elevado a sí mismo (1¹, 2², 3³...).", "Un nombre elevat a si mateix (1¹, 2², 3³...)."),
    family: "POWER",
    check: ({ n }) => [1, 4, 27, 256, 3125, 46656, 823543].includes(n),
    examples: { yes: [4, 3125, 823543], no: [8, 64, 46655] },
  },

  // --- Digit sums ----------------------------------------------------------
  {
    id: "HEAVY",
    emoji: "🧱",
    name: "Heavy",
    description: tr("Its digits add up to more than 45.", "Sus cifras suman más de 45.", "Les seves xifres sumen més de 45."),
    check: ({ s }) => digitSum(s) > 45,
    examples: { yes: [999999, 888888, 799999], no: [0, 1000, 99999] },
  },
  {
    id: "FEATHER",
    emoji: "🪶",
    name: "Feather",
    description: tr("Its digits add up to less than 15.", "Sus cifras suman menos de 15.", "Les seves xifres sumen menys de 15."),
    check: ({ s }) => digitSum(s) < 15,
    examples: { yes: [0, 100, 10000], no: [99, 9999, 888888] },
  },
  {
    id: "BLACKJACK",
    emoji: "♠️",
    name: "Blackjack",
    description: tr("Its digits add up to exactly 21.", "Sus cifras suman exactamente 21.", "Les seves xifres sumen exactament 21."),
    check: ({ s }) => digitSum(s) === 21,
    examples: { yes: [993, 777, 489], no: [0, 999, 12345] },
  },
  {
    id: "BALANCED",
    emoji: "⚖️",
    name: "Balanced",
    description: tr(
      "The first half of its digits adds up to the same as the second half.",
      "La primera mitad de sus cifras suma lo mismo que la segunda.",
      "La primera meitat de les xifres suma el mateix que la segona.",
    ),
    check: ({ s }) =>
      s.length % 2 === 0 && digitSum(s.slice(0, s.length / 2)) === digitSum(s.slice(s.length / 2)),
    examples: { yes: [1230, 99, 123033], no: [12, 123, 5500] },
  },

  // --- Which digits it uses ------------------------------------------------
  {
    id: "VOID",
    emoji: "🕳️",
    name: "Void",
    description: tr("Contains no zeros.", "No contiene ningún cero.", "No conté cap zero."),
    check: ({ s }) => !s.includes("0"),
    examples: { yes: [1, 123, 987654], no: [0, 100, 10203] },
  },
  {
    id: "BINARY_SOUL",
    emoji: "🤖",
    name: "Binary Soul",
    description: tr("Only 0s and 1s.", "Solo ceros y unos.", "Només zeros i uns."),
    check: ({ s }) => /^[01]+$/.test(s),
    examples: { yes: [0, 11, 1011], no: [2, 102, 1012] },
  },
  {
    id: "DUALITY",
    emoji: "☯️",
    name: "Duality",
    description: tr("Uses exactly two different digits.", "Usa exactamente dos cifras distintas.", "Fa servir exactament dues xifres diferents."),
    family: "DUALITY",
    check: ({ s }) => distinct(s) === 2,
    examples: { yes: [12, 1212, 112211], no: [1, 123, 111] },
  },
  {
    id: "FIREFLY",
    emoji: "🪲",
    name: "Firefly",
    description: tr("One lone digit among identical others.", "Una cifra solitaria entre otras idénticas.", "Una xifra solitària entre altres d'idèntiques."),
    family: "DUALITY",
    check: ({ s }) => s.length >= 4 && distinct(s) === 2 && tally(s).includes(1),
    examples: { yes: [1112, 111151, 33383], no: [1122, 1111, 112] },
  },
  {
    id: "TRINITY",
    emoji: "⚜️",
    name: "Trinity",
    description: tr("Uses exactly three different digits.", "Usa exactamente tres cifras distintas.", "Fa servir exactament tres xifres diferents."),
    check: ({ s }) => distinct(s) === 3,
    examples: { yes: [123, 112233, 789], no: [11, 1234, 111] },
  },
  {
    id: "QUARTET",
    emoji: "🎻",
    name: "Quartet",
    description: tr("Uses exactly four different digits.", "Usa exactamente cuatro cifras distintas.", "Fa servir exactament quatre xifres diferents."),
    check: ({ s }) => distinct(s) === 4,
    examples: { yes: [1234, 4321, 112234], no: [123, 12345, 1111] },
  },
  {
    id: "HETEROGENEOUS",
    emoji: "🥗",
    name: "Heterogeneous",
    description: tr("No digit is repeated.", "No se repite ninguna cifra.", "No es repeteix cap xifra."),
    check: ({ s }) => distinct(s) === s.length,
    examples: { yes: [1, 123, 12345], no: [11, 1223, 12321] },
  },
  {
    id: "HOMOGENEOUS",
    emoji: "🥛",
    name: "Homogeneous",
    description: tr("Every digit is the same.", "Todas las cifras son iguales.", "Totes les xifres són iguals."),
    check: ({ s }) => s.length >= 2 && distinct(s) === 1,
    examples: { yes: [11, 7777, 999999], no: [0, 1, 121] },
  },
  {
    id: "FLUSH",
    emoji: "🎨",
    name: "Flush",
    description: tr("Its digits are all even or all odd.", "Sus cifras son todas pares o todas impares.", "Les seves xifres són totes parelles o totes senars."),
    check: ({ s }) => /^([02468]+|[13579]+)$/.test(s),
    examples: { yes: [0, 468, 1357], no: [12, 123, 1234] },
  },
  {
    id: "LOW_BALL",
    emoji: "📉",
    name: "Low Ball",
    description: tr("Only digits from 0 to 4.", "Solo cifras del 0 al 4.", "Només xifres del 0 al 4."),
    check: ({ s }) => /^[0-4]+$/.test(s),
    examples: { yes: [0, 1234, 4444], no: [5, 567, 9999] },
  },
  {
    id: "HIGH_ROLLER",
    emoji: "🤑",
    name: "High Roller",
    description: tr("Only digits from 5 to 9.", "Solo cifras del 5 al 9.", "Només xifres del 5 al 9."),
    check: ({ s }) => /^[5-9]+$/.test(s),
    examples: { yes: [5, 789, 56789], no: [4, 45, 12345] },
  },
  {
    id: "DIVISIBLE_BY_THREE",
    emoji: "🔱",
    name: "Divisible by Three",
    description: tr("Every digit is divisible by 3.", "Todas las cifras son divisibles entre 3.", "Totes les xifres són divisibles per 3."),
    check: ({ s }) => /^[0369]+$/.test(s),
    examples: { yes: [0, 369, 33639], no: [1, 13, 123] },
  },
  {
    id: "STROBOGRAMMATIC",
    emoji: "🙃",
    name: "Strobogrammatic",
    description: tr("Looks the same when turned upside down.", "Se ve igual al girarlo del revés.", "Es veu igual quan es gira cap per avall."),
    check: ({ s }) => {
      const turned: Record<string, string> = { 0: "0", 1: "1", 6: "9", 8: "8", 9: "6" };
      return [...s].reverse().map((d) => turned[d] ?? "x").join("") === s;
    },
    examples: { yes: [0, 69, 818, 6009], no: [2, 12, 89, 100] },
  },
  exactlyOne("GHOST", "👻", "Ghost", "0"),
  exactlyOne("HYDROGEN", "💧", "Hydrogen (1)", "1"),
  exactlyOne("HELIUM", "🎈", "Helium (2)", "2"),
  exactlyOne("LITHIUM", "🔋", "Lithium (3)", "3"),
  exactlyOne("BERYLLIUM", "💚", "Beryllium (4)", "4"),
  exactlyOne("BORON", "🧼", "Boron (5)", "5"),
  exactlyOne("CARBON", "✏️", "Carbon (6)", "6"),
  exactlyOne("NITROGEN", "❄️", "Nitrogen (7)", "7"),
  exactlyOne("OXYGEN", "💨", "Oxygen (8)", "8"),
  exactlyOne("FLUORINE", "🦷", "Fluorine (9)", "9"),
  contains("LUCKY_7", "7️⃣", "Lucky Seven", "7"),

  // --- How long it is --------------------------------------------------------
  {
    id: "ONE_DIGIT",
    emoji: "☝️",
    name: "Single Digit",
    description: tr("Has exactly one digit.", "Tiene exactamente una cifra.", "Té exactament una xifra."),
    family: "SINGLE_DIGIT",
    check: ({ s }) => s.length === 1,
    examples: { yes: [0, 5, 9], no: [10, 123] },
  },
  exactly("DIGIT_ZERO", "0️⃣", "Zero", [0], { family: "SINGLE_DIGIT" }),
  exactly("DIGIT_ONE", "1️⃣", "One", [1], { family: "SINGLE_DIGIT" }),
  exactly("DIGIT_TWO", "2️⃣", "Two", [2], { family: "SINGLE_DIGIT" }),
  exactly("DIGIT_THREE", "3️⃣", "Three", [3], { family: "SINGLE_DIGIT" }),
  exactly("DIGIT_FOUR", "4️⃣", "Four", [4], { family: "SINGLE_DIGIT" }),
  exactly("DIGIT_FIVE", "5️⃣", "Five", [5], { family: "SINGLE_DIGIT" }),
  exactly("DIGIT_SIX", "6️⃣", "Six", [6], { family: "SINGLE_DIGIT" }),
  exactly("DIGIT_SEVEN", "7️⃣", "Seven", [7], { family: "SINGLE_DIGIT" }),
  exactly("DIGIT_EIGHT", "8️⃣", "Eight", [8], { family: "SINGLE_DIGIT" }),
  exactly("DIGIT_NINE", "9️⃣", "Nine", [9], { family: "SINGLE_DIGIT" }),
  digitCount("TWO_DIGITS", "✌️", "Two Digits", 2),
  digitCount("THREE_DIGITS", "🤟", "Three Digits", 3),
  digitCount("FOUR_DIGITS", "🍀", "Four Digits", 4),
  digitCount("FIVE_DIGITS", "🖐️", "Five Digits", 5),
  digitCount("SIX_DIGITS", "🐝", "Six Digits", 6),

  // --- First and last digits -------------------------------------------------
  {
    id: "GROUNDED",
    emoji: "⚓",
    name: "Grounded",
    description: tr("The first digit is smaller than the last.", "La primera cifra es menor que la última.", "La primera xifra és més petita que l'última."),
    check: ({ s }) => s.length >= 2 && s[0] < last(s),
    examples: { yes: [12, 102, 15678], no: [21, 201, 7] },
  },
  {
    id: "LIFTOFF",
    emoji: "🚀",
    name: "Liftoff",
    description: tr("The first digit is larger than the last.", "La primera cifra es mayor que la última.", "La primera xifra és més gran que l'última."),
    check: ({ s }) => s.length >= 2 && s[0] > last(s),
    examples: { yes: [21, 201, 87654], no: [12, 102, 7] },
  },
  {
    id: "GAP_ONE",
    emoji: "↕️",
    name: "Gap One",
    description: tr("The first and last digits differ by exactly 1.", "La primera y la última cifra se diferencian en exactamente 1.", "La primera i l'última xifra es diferencien exactament en 1."),
    check: ({ s }) => s.length >= 2 && Math.abs(Number(s[0]) - Number(last(s))) === 1,
    examples: { yes: [12, 21, 819], no: [0, 13, 84] },
  },
  {
    id: "EQUILIBRIUM",
    emoji: "🧘",
    name: "Equilibrium",
    description: tr("The first and last digits are the same.", "La primera y la última cifra son iguales.", "La primera i l'última xifra són iguals."),
    family: "EQUILIBRIUM",
    check: ({ s }) => s.length >= 2 && s[0] === last(s),
    examples: { yes: [11, 1221, 989], no: [10, 1234, 7] },
  },
  {
    id: "SANDWICH",
    emoji: "🥪",
    name: "Sandwich",
    description: tr(
      "The first and last digits match, with at least one different digit between them.",
      "La primera y la última cifra coinciden, con al menos una cifra distinta entre ellas.",
      "La primera i l'última xifra coincideixen, amb almenys una xifra diferent entremig.",
    ),
    family: "EQUILIBRIUM",
    check: ({ s }) => s.length >= 3 && s[0] === last(s) && [...s].some((d) => d !== s[0]),
    examples: { yes: [101, 12321, 90109], no: [111, 11, 1234] },
  },
  {
    id: "BOOKENDS",
    emoji: "📚",
    name: "Bookends",
    description: tr("The first two digits are the same as the last two.", "Las dos primeras cifras son iguales a las dos últimas.", "Les dues primeres xifres són iguals a les dues últimes."),
    family: "BOOKENDS",
    check: ({ s }) => s.length >= 4 && s.slice(0, 2) === s.slice(-2),
    examples: { yes: [1212, 123412, 999999], no: [123, 1234, 121] },
  },
  {
    id: "MIRROR_BOOKENDS",
    emoji: "📖",
    name: "Mirror Bookends",
    description: tr("The last two digits are the first two reversed.", "Las dos últimas cifras son las dos primeras al revés.", "Les dues últimes xifres són les dues primeres al revés."),
    family: "BOOKENDS",
    check: ({ s }) => s.length >= 4 && s[0] === last(s) && s[1] === s[s.length - 2],
    examples: { yes: [1221, 129821, 345543], no: [129812, 1234, 123] },
  },
  {
    id: "PAIRED_BOOKENDS",
    emoji: "👐",
    name: "Paired Bookends",
    description: tr("Starts with a pair and ends with a different pair.", "Empieza con una pareja y acaba con otra distinta.", "Comença amb una parella i acaba amb una altra de diferent."),
    family: "BOOKENDS",
    check: ({ s }) =>
      s.length >= 4 && s[0] === s[1] && s[s.length - 2] === last(s) && s[0] !== last(s),
    examples: { yes: [1144, 779044, 998877], no: [1234, 1111, 123] },
  },

  // --- How it ends -----------------------------------------------------------
  endsWith("CLEAN", "🧼", "Clean", "0", { family: "VOID_DEPTH" }),
  endsWith("CENTURY", "💯", "Century", "00", { family: "VOID_DEPTH" }),
  endsWith("MILLENNIUM", "🗓️", "Millennium", "000", { family: "VOID_DEPTH" }),
  endsWith("EPOCH", "🏛️", "Epoch", "0000", { family: "VOID_DEPTH" }),
  endsWith("EON", "🗿", "Eon", "00000", { family: "VOID_DEPTH" }),
  endsWith("SEMI_CENTURY", "🌗", "Semi-Century", "50", { family: "VOID_DEPTH" }),
  endsWith("SEMI_MILLENNIUM", "📜", "Semi-Millennium", "500", { family: "VOID_DEPTH" }),
  endsWith("SEMI_EPOCH", "⌛", "Semi-Epoch", "5000", { family: "VOID_DEPTH" }),
  endsWith("SEMI_EON", "🦴", "Semi-Eon", "50000", { family: "VOID_DEPTH" }),
  contains("DEEP_VOID", "🌫️", "Deep Void", "00", { family: "VOID_DEPTH" }),
  contains("DEEP_VOID_THREE", "🌑", "Deep Void (3)", "000", { family: "VOID_DEPTH" }),
  contains("DEEP_VOID_FOUR", "🌌", "Deep Void (4)", "0000", { family: "VOID_DEPTH" }),
  contains("DEEP_VOID_FIVE", "⚫", "Deep Void (5)", "00000", { family: "VOID_DEPTH" }),
  endsWith("SEMI_CLEAN", "🧹", "Semi-Clean", "5"),
  endsWith("QUARTER_CENTURY", "🪙", "Quarter-Century", "25"),
  endsWith("THREE_QUARTER_CENTURY", "🕰️", "Three-Quarter Century", "75"),
  endsWith("DOUBLE_NINE", "🎈", "Double Nine", "99", { family: "NINE_ENDING" }),
  endsWith("TRIPLE_NINE", "🎉", "Triple Nine", "999", { family: "NINE_ENDING" }),
  endsWith("QUAD_NINE", "🎊", "Quad Nine", "9999", { family: "NINE_ENDING" }),
  endsWith("QUINT_NINE", "🥳", "Quint Nine", "99999", { family: "NINE_ENDING" }),

  // --- Rising and falling ----------------------------------------------------
  {
    id: "ASCENSION",
    emoji: "📈",
    name: "Ascension",
    description: tr("Every digit is larger than the one before.", "Cada cifra es mayor que la anterior.", "Cada xifra és més gran que l'anterior."),
    family: "MONOTONIC",
    check: ({ s }) => /^u+$/.test(shape(s)),
    examples: { yes: [12, 13579, 12389], no: [11, 1232, 4321] },
  },
  {
    id: "DECAY",
    emoji: "🥀",
    name: "Decay",
    description: tr("Every digit is smaller than the one before.", "Cada cifra es menor que la anterior.", "Cada xifra és més petita que l'anterior."),
    family: "MONOTONIC",
    check: ({ s }) => /^d+$/.test(shape(s)),
    examples: { yes: [21, 97531, 98210], no: [11, 1232, 1234] },
  },
  {
    id: "STEPS",
    emoji: "🪜",
    name: "Steps",
    description: tr("Its digits never go down.", "Sus cifras nunca bajan.", "Les seves xifres no baixen mai."),
    family: "MONOTONIC",
    check: ({ s }) => /^[uf]*u[uf]*$/.test(shape(s)),
    examples: { yes: [347788, 1123, 25579], no: [111111, 344321, 7] },
  },
  {
    id: "SLOPES",
    emoji: "🛝",
    name: "Slopes",
    description: tr("Its digits never go up.", "Sus cifras nunca suben.", "Les seves xifres no pugen mai."),
    family: "MONOTONIC",
    check: ({ s }) => /^[df]*d[df]*$/.test(shape(s)),
    examples: { yes: [744422, 9800, 887210], no: [222222, 776789, 7] },
  },
  {
    id: "MOUNTAIN",
    emoji: "🏔️",
    name: "Mountain",
    description: tr("Its digits climb to a peak and then come down.", "Sus cifras suben hasta un pico y luego bajan.", "Les seves xifres pugen fins a un cim i després baixen."),
    family: "PEAK",
    check: ({ s }) => /^u+d+$/.test(shape(s)),
    examples: { yes: [131, 12391, 1354], no: [1239, 931, 1212] },
  },
  {
    id: "VALLEY",
    emoji: "🏜️",
    name: "Valley",
    description: tr("Its digits come down to a low point and then climb.", "Sus cifras bajan hasta un valle y luego suben.", "Les seves xifres baixen fins a una vall i després pugen."),
    family: "PEAK",
    check: ({ s }) => /^d+u+$/.test(shape(s)),
    examples: { yes: [313, 93129, 5014], no: [931, 123, 1212] },
  },
  {
    id: "MESA",
    emoji: "🗻",
    name: "Mesa",
    description: tr("Its digits rise and then fall, flat stretches allowed.", "Sus cifras suben y luego bajan, con tramos llanos permitidos.", "Les seves xifres pugen i després baixen, amb trams plans permesos."),
    family: "PEAK",
    check: ({ s }) => /^[uf]*u[uf]*d[df]*$/.test(shape(s)),
    examples: { yes: [134420, 17882, 466431], no: [347788, 3129, 111] },
  },
  {
    id: "CANYON",
    emoji: "🌄",
    name: "Canyon",
    description: tr("Its digits fall and then rise, flat stretches allowed.", "Sus cifras bajan y luego suben, con tramos llanos permitidos.", "Les seves xifres baixen i després pugen, amb trams plans permesos."),
    family: "PEAK",
    check: ({ s }) => /^[df]*d[df]*u[uf]*$/.test(shape(s)),
    examples: { yes: [421135, 76679, 5014], no: [744422, 131, 222] },
  },
  {
    id: "HILLS",
    emoji: "🏞️",
    name: "Hills",
    description: tr("Its digits keep alternating between rising and falling.", "Sus cifras alternan sin parar entre subir y bajar.", "Les seves xifres alternen sense parar entre pujar i baixar."),
    family: "HILLS",
    check: ({ s }) => s.length >= 4 && /^u?(du)*d?$/.test(shape(s)),
    examples: { yes: [3728, 19281, 291837], no: [1234, 1111, 131] },
  },
  {
    id: "DUNES",
    emoji: "🐫",
    name: "Dunes",
    description: tr("Rises and falls keep alternating, flat stretches allowed.", "Las subidas y bajadas se alternan, con tramos llanos permitidos.", "Les pujades i baixades s'alternen, amb trams plans permesos."),
    family: "HILLS",
    check: ({ s }) => {
      const moves = shape(s).replaceAll("f", "");
      return moves.length >= 3 && /^u?(du)*d?$/.test(moves);
    },
    examples: { yes: [377288, 522903, 3728], no: [118822, 344567, 123] },
  },
  {
    id: "NEIGHBORS",
    emoji: "🏘️",
    name: "Neighbors",
    description: tr("Has two digits side by side that differ by 1.", "Tiene dos cifras seguidas que se diferencian en 1.", "Té dues xifres seguides que es diferencien en 1."),
    check: ({ s }) => steps(s).some((step) => Math.abs(step) === 1),
    examples: { yes: [12, 89, 456], no: [0, 13, 35] },
  },
  {
    id: "ALTERNATOR",
    emoji: "⚡",
    name: "Alternator",
    description: tr("Its digits alternate between even and odd.", "Sus cifras alternan entre pares e impares.", "Les seves xifres alternen entre parelles i senars."),
    check: ({ s }) => s.length >= 2 && steps(s).every((step) => Math.abs(step) % 2 === 1),
    examples: { yes: [12, 3456, 8989], no: [11, 1, 1213] },
  },
  {
    id: "ZIPPER",
    emoji: "🤐",
    name: "Zipper",
    description: tr("Two digits taking turns.", "Dos cifras que se van turnando.", "Dues xifres que es van alternant."),
    check: ({ s }) => distinct(s) === 2 && !hasRun(s, 2),
    examples: { yes: [12, 5757, 1010], no: [11, 123, 1231] },
  },
  {
    id: "HOPSCOTCH",
    emoji: "🦘",
    name: "Hopscotch",
    description: tr("A digit shows up again two places later.", "Una cifra vuelve a aparecer dos posiciones después.", "Una xifra torna a aparèixer dues posicions després."),
    family: "HOPSCOTCH",
    check: ({ s }) =>
      distinct(s) >= 2 &&
      [...s].some((d, i) => s[i + 2] === d && s[i + 4] !== d && s[i - 2] !== d),
    examples: { yes: [1213, 3141, 533121], no: [1234, 121212, 12131] },
  },
  {
    id: "DOUBLE_HOP",
    emoji: "🦘🦘",
    name: "Double Hop",
    description: tr("A digit shows up three times, every other place.", "Una cifra aparece tres veces, cada dos posiciones.", "Una xifra apareix tres vegades, cada dues posicions."),
    family: "HOPSCOTCH",
    check: ({ s }) =>
      distinct(s) >= 2 && [...s].some((d, i) => s[i + 2] === d && s[i + 4] === d),
    examples: { yes: [12131, 934303, 515253], no: [1213, 12345, 11111] },
  },

  // --- Sequences -------------------------------------------------------------
  {
    id: "SEQUENCE_3",
    emoji: "🔢",
    name: "Sequence (3)",
    description: tr("Contains three digits in a row counting up or down.", "Contiene tres cifras seguidas en orden, subiendo o bajando.", "Conté tres xifres seguides en ordre, pujant o baixant."),
    family: "PROGRESSION",
    check: ({ s }) => hasSequence(s, 3),
    examples: { yes: [123, 654, 12345], no: [12, 135, 2468] },
  },
  {
    id: "SEQUENCE_4",
    emoji: "🔢",
    name: "Sequence (4)",
    description: tr("Contains four digits in a row counting up or down.", "Contiene cuatro cifras seguidas en orden, subiendo o bajando.", "Conté quatre xifres seguides en ordre, pujant o baixant."),
    family: "PROGRESSION",
    check: ({ s }) => hasSequence(s, 4),
    examples: { yes: [1234, 8765, 123456], no: [123, 1357, 2468] },
  },
  {
    id: "SEQUENCE_6",
    emoji: "🔢",
    name: "Sequence (6)",
    description: tr("Six digits in a row counting up or down.", "Seis cifras seguidas en orden, subiendo o bajando.", "Sis xifres seguides en ordre, pujant o baixant."),
    family: "PROGRESSION",
    check: ({ s }) => hasSequence(s, 6),
    examples: { yes: [123456, 654321, 765432], no: [12345, 54321, 1357] },
  },
  {
    id: "STRAIGHT",
    emoji: "📏",
    name: "Straight",
    description: tr("Contains five digits in a row counting up or down.", "Contiene cinco cifras seguidas en orden, subiendo o bajando.", "Conté cinc xifres seguides en ordre, pujant o baixant."),
    family: "STRAIGHT",
    check: ({ s }) => hasSequence(s, 5),
    examples: { yes: [12345, 98765, 198765], no: [1234, 12346, 13579] },
  },
  {
    id: "STRAIGHT_FLUSH",
    emoji: "🃏",
    name: "Straight Flush",
    description: tr("Contains 02468, 13579, or one of them backwards.", "Contiene 02468, 13579 o uno de ellos al revés.", "Conté 02468, 13579 o un d'ells al revés."),
    family: "STRAIGHT",
    check: ({ s }) => ["02468", "13579", "86420", "97531"].some((run) => s.includes(run)),
    examples: { yes: [13579, 102468, 197531], no: [12345, 1357, 2468] },
  },
  contains("ROYAL_FLUSH", "👑", "Royal Flush", "56789", {
    family: "STRAIGHT",
    note: tr("The highest straight there is.", "La escalera más alta que existe.", "L'escala més alta que hi ha."),
  }),
  {
    id: "CASCADE",
    emoji: "🌊",
    name: "Cascade",
    description: tr("Every digit is exactly 1 more than the one before.", "Cada cifra es exactamente 1 más que la anterior.", "Cada xifra és exactament 1 més que l'anterior."),
    family: "PROGRESSION",
    check: ({ s }) => s.length >= 2 && steps(s).every((step) => step === 1),
    examples: { yes: [12, 1234, 23456], no: [13, 1357, 11] },
  },
  {
    id: "WATERFALL",
    emoji: "🚿",
    name: "Waterfall",
    description: tr("Every digit is exactly 1 less than the one before.", "Cada cifra es exactamente 1 menos que la anterior.", "Cada xifra és exactament 1 menys que l'anterior."),
    family: "PROGRESSION",
    check: ({ s }) => s.length >= 2 && steps(s).every((step) => step === -1),
    examples: { yes: [21, 4321, 98765], no: [31, 9753, 11] },
  },
  {
    id: "TURTLE",
    emoji: "🐢",
    name: "Turtle",
    description: tr("No digit differs from the one before by more than 1.", "Ninguna cifra se aleja más de 1 de la anterior.", "Cap xifra s'allunya més d'1 de l'anterior."),
    family: "PROGRESSION",
    check: ({ s }) => s.length >= 2 && steps(s).every((step) => Math.abs(step) <= 1),
    examples: { yes: [11, 112233, 12321], no: [13, 2468, 192] },
  },
  {
    id: "EVEN_SPACING",
    emoji: "📐",
    name: "Even Spacing",
    description: tr("Every digit differs from the one before by the same amount.", "Cada cifra se diferencia de la anterior en la misma cantidad.", "Cada xifra es diferencia de l'anterior en la mateixa quantitat."),
    family: "PROGRESSION",
    check: ({ s }) => s.length >= 3 && new Set(steps(s)).size === 1,
    examples: { yes: [1234, 2468, 369], no: [1245, 3696, 12] },
  },
  {
    id: "EVEN_SPACING_ABS",
    emoji: "📏",
    name: "Even Spacing (Absolute)",
    description: tr("Every digit is the same distance from the one before, up or down.", "Cada cifra está a la misma distancia de la anterior, hacia arriba o hacia abajo.", "Cada xifra és a la mateixa distància de l'anterior, amunt o avall."),
    family: "PROGRESSION",
    check: ({ s }) => s.length >= 3 && new Set(steps(s).map(Math.abs)).size === 1,
    examples: { yes: [1357, 135797, 8642], no: [1245, 12456, 12] },
  },
  {
    id: "SCRAMBLE",
    emoji: "🔀",
    name: "Scramble",
    description: tr("Sorted, its digits count up one by one.", "Ordenadas, sus cifras forman una secuencia perfecta.", "Ordenades, les seves xifres formen una seqüència perfecta."),
    family: "PROGRESSION",
    check: ({ s }) => s.length >= 2 && isShuffledRun(s),
    examples: { yes: [21, 132, 613254], no: [1, 11, 124] },
  },
  {
    id: "MINI_SCRAMBLE",
    emoji: "🧩",
    name: "Mini Scramble",
    description: tr("Contains three or more digits in a row that, sorted, count up one by one.", "Contiene tres o más cifras seguidas que, ordenadas, forman una secuencia perfecta.", "Conté tres o més xifres seguides que, ordenades, formen una seqüència perfecta."),
    family: "PROGRESSION",
    check: ({ s }) => substrings(s, 3).some(isShuffledRun),
    examples: { yes: [143294, 132, 100234], no: [1357, 148259, 110022] },
  },
  {
    id: "ARITHMETIC",
    emoji: "🎼",
    name: "Metronome",
    description: tr("Splits into three or more numbers with a constant difference.", "Se divide en tres o más números con una diferencia constante.", "Es divideix en tres o més nombres amb una diferència constant."),
    family: "PROGRESSION",
    check: ({ s }) => isArithmetic(s),
    examples: { yes: [1086, 36912, 135], no: [111, 217, 100001] },
  },
  {
    id: "GEOMETRIC",
    emoji: "🔊",
    name: "Crescendo",
    description: tr("Splits into three or more numbers with a constant ratio.", "Se divide en tres o más números con una razón constante.", "Es divideix en tres o més nombres amb una raó constant."),
    family: "PROGRESSION",
    check: ({ s }) => isGeometric(s),
    examples: { yes: [1248, 139, 252016], no: [111, 123, 1249] },
  },

  // --- Consecutive numbers ---------------------------------------------------
  {
    id: "CONSEC_QUAD_EXACT",
    emoji: "⛓️",
    name: "4 Consecutive Numbers",
    description: tr("The whole number is four consecutive numbers in order.", "El número entero son cuatro números consecutivos en orden.", "Tot el nombre són quatre nombres consecutius en ordre."),
    family: "CONSECUTIVE",
    check: ({ s }) => isOrdered(consecutiveSplit(s, 4) ?? [0, 0]),
    examples: { yes: [78910, 891011, 111098], no: [1234, 5960, 810911] },
  },
  {
    id: "CONSEC_QUAD_SCRAMBLED",
    emoji: "🔀",
    name: "4 Consecutive Numbers (Scrambled)",
    description: tr("The whole number is four consecutive numbers, out of order.", "El número entero son cuatro números consecutivos, desordenados.", "Tot el nombre són quatre nombres consecutius, desordenats."),
    family: "CONSECUTIVE",
    check: ({ s }) => !isOrdered(consecutiveSplit(s, 4) ?? [0, 1]),
    examples: { yes: [810911, 108911, 911108], no: [891011, 111098, 1234] },
  },
  {
    id: "CONSEC_QUAD_CONTAINS",
    emoji: "🔗",
    name: "4 Consecutive Numbers (Contains)",
    description: tr("Contains four consecutive numbers back to back.", "Contiene cuatro números consecutivos seguidos.", "Conté quatre nombres consecutius seguits."),
    family: "CONSECUTIVE",
    check: ({ s }) => containsConsecutive(s, 4),
    examples: { yes: [178910, 278910, 109870], no: [891011, 78910, 5960] },
  },
  {
    id: "CONSEC_TRIPLE_EXACT",
    emoji: "⛓️",
    name: "3 Consecutive Numbers",
    description: tr("The whole number is three consecutive numbers in order.", "El número entero son tres números consecutivos en orden.", "Tot el nombre són tres nombres consecutius en ordre."),
    family: "CONSECUTIVE",
    check: ({ s }) => isOrdered(consecutiveSplit(s, 3) ?? [0, 0]),
    examples: { yes: [596061, 222120, 8910], no: [5960, 605961, 123] },
  },
  {
    id: "CONSEC_TRIPLE_SCRAMBLED",
    emoji: "🔀",
    name: "3 Consecutive Numbers (Scrambled)",
    description: tr("The whole number is three consecutive numbers, out of order.", "El número entero son tres números consecutivos, desordenados.", "Tot el nombre són tres nombres consecutius, desordenats."),
    family: "CONSECUTIVE",
    check: ({ s }) => !isOrdered(consecutiveSplit(s, 3) ?? [0, 1]),
    examples: { yes: [605961, 615960, 606159], no: [596061, 222120, 5960] },
  },
  {
    id: "CONSEC_TRIPLE_CONTAINS",
    emoji: "🔗",
    name: "3 Consecutive Numbers (Contains)",
    description: tr("Contains three consecutive numbers back to back.", "Contiene tres números consecutivos seguidos.", "Conté tres nombres consecutius seguits."),
    family: "CONSECUTIVE",
    check: ({ s }) => containsConsecutive(s, 3),
    examples: { yes: [189100, 891000, 189101], no: [596061, 8910, 75960] },
  },
  {
    id: "CONSEC_PAIR_EXACT",
    emoji: "🔗",
    name: "2 Consecutive Numbers",
    description: tr("The whole number is two consecutive numbers.", "El número entero son dos números consecutivos.", "Tot el nombre són dos nombres consecutius."),
    family: "CONSECUTIVE",
    check: ({ s }) => consecutiveSplit(s, 2) !== null,
    examples: { yes: [5960, 6059, 99100], no: [12, 1234, 100200] },
  },
  {
    id: "CONSEC_PAIR_ADJACENT",
    emoji: "🔗",
    name: "2 Consecutive Numbers (Contains)",
    description: tr("Contains two consecutive numbers back to back.", "Contiene dos números consecutivos seguidos.", "Conté dos nombres consecutius seguits."),
    family: "CONSECUTIVE",
    check: ({ s }) => containsConsecutivePair(s),
    examples: { yes: [75960, 759601, 159600], no: [5960, 6059, 12] },
  },
  {
    id: "CONSEC_PAIR_NEARBY",
    emoji: "🔗",
    name: "2 Consecutive Numbers (Nearby)",
    description: tr("Contains two consecutive numbers with other digits between them.", "Contiene dos números consecutivos con otras cifras entre ellos.", "Conté dos nombres consecutius amb altres xifres entremig."),
    family: "CONSECUTIVE",
    check: ({ s }) => containsConsecutiveApart(s),
    examples: { yes: [759060, 310430, 590060], no: [5960, 75960, 123] },
  },

  // --- Repeats and mirrors ---------------------------------------------------
  {
    id: "PALINDROME",
    emoji: "🪞",
    name: "Palindrome",
    description: tr("Reads the same forwards and backwards.", "Se lee igual del derecho que del revés.", "Es llegeix igual del dret que del revés."),
    family: "PALINDROME",
    check: ({ s }) => isPalindrome(s),
    examples: { yes: [0, 121, 123321], no: [10, 1234, 100000] },
  },
  {
    id: "POCKET_MIRROR",
    emoji: "🪞",
    name: "Pocket Mirror",
    description: tr("Contains a palindrome four or more digits long.", "Contiene un capicúa de cuatro o más cifras.", "Conté un capicua de quatre xifres o més."),
    family: "PALINDROME",
    check: ({ s }) => substrings(s, 4).some(isPalindrome),
    examples: { yes: [411439, 512213, 1221], no: [123456, 121, 987654] },
  },
  {
    id: "ECHO",
    emoji: "📣",
    name: "Echo",
    description: tr("The first half repeats as the second half.", "La primera mitad se repite como segunda mitad.", "La primera meitat es repeteix com a segona meitat."),
    check: ({ s }) => s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2),
    examples: { yes: [11, 1212, 123123], no: [1, 1234, 12345] },
  },
  {
    id: "MINI_ECHO",
    emoji: "🔂",
    name: "Mini Echo",
    description: tr("Contains two digits immediately repeated.", "Contiene dos cifras repetidas justo a continuación.", "Conté dues xifres repetides just a continuació."),
    family: "REPEAT",
    check: ({ s }) => /(\d\d)\1/.test(s),
    examples: { yes: [1212, 515192, 996767], no: [1234, 917717, 1213] },
  },
  {
    id: "RHYME",
    emoji: "🎶",
    name: "Rhyme",
    description: tr("Contains the same two or more digits twice.", "Contiene las mismas dos o más cifras dos veces.", "Conté les mateixes dues o més xifres dues vegades."),
    family: "REPEAT",
    check: ({ s }) => /(\d\d).*\1/.test(s),
    examples: { yes: [917717, 123412, 112112], no: [1234, 123456, 1023] },
  },

  // --- Pairs and sets --------------------------------------------------------
  {
    id: "PAIR",
    emoji: "👯",
    name: "Pair",
    description: tr("Has two of the same digit.", "Tiene dos cifras iguales.", "Té dues xifres iguals."),
    family: "PAIRS",
    check: ({ s }) => tally(s).some((c) => c >= 2),
    examples: { yes: [11, 1223, 1111], no: [1, 123, 123456] },
  },
  {
    id: "CONTIGUOUS_PAIR",
    emoji: "🫂",
    name: "Contiguous Pair",
    description: tr("Has the same digit twice in a row.", "Tiene la misma cifra dos veces seguidas.", "Té la mateixa xifra dues vegades seguides."),
    family: "PAIRS",
    check: ({ s }) => hasRun(s, 2),
    examples: { yes: [11, 18827, 1112], no: [121, 18287, 123] },
  },
  {
    id: "TWO_PAIR",
    emoji: "👯‍♀️",
    name: "Two Pair",
    description: tr("Has two different pairs.", "Tiene dos parejas distintas.", "Té dues parelles diferents."),
    family: "PAIRS",
    check: ({ s }) => tally(s).filter((c) => c >= 2).length >= 2,
    examples: { yes: [1122, 1212, 111222], no: [11, 111, 1112] },
  },
  {
    id: "CONTIGUOUS_TWO_PAIR",
    emoji: "👨‍👩‍👧‍👦",
    name: "Contiguous Two Pair",
    description: tr("Has two different pairs side by side.", "Tiene dos parejas distintas una junto a la otra.", "Té dues parelles diferents l'una al costat de l'altra."),
    family: "PAIRS",
    check: ({ s }) => /(\d)\1(?!\1)(\d)\2/.test(s),
    examples: { yes: [1122, 312233, 111222], no: [1212, 1221, 1111] },
  },
  {
    id: "THREE_PAIR",
    emoji: "🎎",
    name: "Three Pair",
    description: tr("Has three different pairs.", "Tiene tres parejas distintas.", "Té tres parelles diferents."),
    family: "PAIRS",
    check: ({ s }) => tally(s).filter((c) => c === 2).length >= 3,
    examples: { yes: [112233, 115335, 123123], no: [1122, 111222, 123] },
  },
  {
    id: "CONTIGUOUS_THREE_PAIR",
    emoji: "🚂",
    name: "Contiguous Three Pair",
    description: tr("Three different pairs side by side.", "Tres parejas distintas una junto a la otra.", "Tres parelles diferents l'una al costat de l'altra."),
    family: "PAIRS",
    check: ({ s }) => /(\d)\1(\d)\2(\d)\3/.test(s) && tally(s).filter((c) => c === 2).length >= 3,
    examples: { yes: [112233, 114455, 335566], no: [115335, 123123, 1122] },
  },
  {
    id: "FRAMED_PAIR",
    emoji: "🖼️",
    name: "Framed Pair",
    description: tr("Four digits: a pair in the middle, with a different digit on each side.", "Cuatro cifras: una pareja en medio, con una cifra distinta a cada lado.", "Quatre xifres: una parella al mig, amb una xifra diferent a cada costat."),
    family: "PAIRS",
    check: ({ s }) => /^(\d)(?!\1)(\d)\2(?!\2)\d$/.test(s),
    examples: { yes: [1221, 5665, 1223], no: [1111, 2211, 12345] },
  },
  {
    id: "FRAMED_DOUBLE",
    emoji: "🖼️🖼️",
    name: "Framed Double",
    description: tr("Six digits: two pairs in the middle, with a different digit on each side.", "Seis cifras: dos parejas en medio, con una cifra distinta a cada lado.", "Sis xifres: dues parelles al mig, amb una xifra diferent a cada costat."),
    family: "PAIRS",
    check: ({ s }) => /^(\d)(?!\1)(\d)\2(?!\2)(\d)\3(?!\3)\d$/.test(s),
    examples: { yes: [522009, 133447, 122334], no: [111111, 112233, 122244] },
  },
  {
    id: "TRIPS",
    emoji: "🎰",
    name: "Three of a Kind",
    description: tr("Has exactly three of the same digit.", "Tiene exactamente tres cifras iguales.", "Té exactament tres xifres iguals."),
    family: "OF_A_KIND",
    check: ({ s }) => tally(s).includes(3),
    examples: { yes: [111, 7773, 12211], no: [11, 1122, 1234] },
  },
  {
    id: "QUADS",
    emoji: "🍀",
    name: "Four of a Kind",
    description: tr("Has four of the same digit.", "Tiene cuatro cifras iguales.", "Té quatre xifres iguals."),
    family: "OF_A_KIND",
    check: ({ s }) => tally(s).some((c) => c >= 4),
    examples: { yes: [1111, 77779, 888889], no: [111, 11223, 12345] },
  },
  {
    id: "FIVE_OF_A_KIND",
    emoji: "🃏",
    name: "Five of a Kind",
    description: tr("Has five of the same digit.", "Tiene cinco cifras iguales.", "Té cinc xifres iguals."),
    family: "OF_A_KIND",
    check: ({ s }) => tally(s).some((c) => c >= 5),
    examples: { yes: [919999, 555555, 220222], no: [122223, 987654, 44441] },
  },
  {
    id: "FRAMED_TRIPLE",
    emoji: "🪟",
    name: "Framed Triple",
    description: tr("Five digits: three of a kind in the middle, with a different digit on each side.", "Cinco cifras: un trío en medio, con una cifra distinta a cada lado.", "Cinc xifres: un trio al mig, amb una xifra diferent a cada costat."),
    family: "OF_A_KIND",
    check: ({ s }) => /^(\d)(?!\1)(\d)\2\2(?!\2)\d$/.test(s),
    examples: { yes: [12221, 90009, 12223], no: [11111, 12211, 122221] },
  },
  {
    id: "FRAMED_QUAD",
    emoji: "🪟🪟",
    name: "Framed Quad",
    description: tr("Six digits: four of a kind in the middle, with a different digit on each side.", "Seis cifras: un póquer en medio, con una cifra distinta a cada lado.", "Sis xifres: un pòquer al mig, amb una xifra diferent a cada costat."),
    family: "OF_A_KIND",
    check: ({ s }) => /^(\d)(?!\1)(\d)\2{3}(?!\2)\d$/.test(s),
    examples: { yes: [155551, 900007, 244442], no: [555555, 155555, 15551] },
  },
  {
    id: "BOAT",
    emoji: "🏠",
    name: "Full House",
    description: tr("Has three of one digit and two of another.", "Tiene tres cifras iguales y otras dos iguales entre sí.", "Té tres xifres iguals i dues més d'iguals entre elles."),
    family: "BOAT",
    check: ({ s }) => tally(s).some((c) => c >= 3) && tally(s).filter((c) => c >= 2).length >= 2,
    examples: { yes: [11222, 33322, 777755], no: [111, 1122, 11111] },
  },
  {
    id: "CONTIGUOUS_BOAT",
    emoji: "🏰",
    name: "Contiguous Full House",
    description: tr("Three of one digit in a row, right next to two of another.", "Tres cifras iguales seguidas, justo al lado de otras dos iguales.", "Tres xifres iguals seguides, just al costat de dues més d'iguals."),
    family: "BOAT",
    check: ({ s }) =>
      runs(s).some(
        (run, i, all) =>
          i > 0 &&
          Math.max(run.length, all[i - 1].length) >= 3 &&
          Math.min(run.length, all[i - 1].length) >= 2,
      ),
    examples: { yes: [11222, 844400, 222888], no: [840044, 11322, 888177] },
  },
  {
    id: "CONTIGUOUS_TRIPS",
    emoji: "➖",
    name: "Contiguous Trips",
    description: tr("The same digit three times in a row.", "La misma cifra tres veces seguidas.", "La mateixa xifra tres vegades seguides."),
    family: "CONTIGUOUS_RUN",
    check: ({ s }) => hasRun(s, 3),
    examples: { yes: [111, 1000, 12223], no: [11, 1212, 0] },
  },
  {
    id: "CONTIGUOUS_QUADS",
    emoji: "➖➖",
    name: "Contiguous Quads",
    description: tr("The same digit four times in a row.", "La misma cifra cuatro veces seguidas.", "La mateixa xifra quatre vegades seguides."),
    family: "CONTIGUOUS_RUN",
    check: ({ s }) => hasRun(s, 4),
    examples: { yes: [1111, 10000, 122223], no: [111, 1000, 1212] },
  },
  {
    id: "CONTIGUOUS_FIVES",
    emoji: "➖➖➖",
    name: "Contiguous Fives",
    description: tr("The same digit five times in a row.", "La misma cifra cinco veces seguidas.", "La mateixa xifra cinc vegades seguides."),
    family: "CONTIGUOUS_RUN",
    check: ({ s }) => hasRun(s, 5),
    examples: { yes: [11111, 100000, 122222], no: [1111, 10000, 1212] },
  },
  {
    id: "CONTIGUOUS_SIXES",
    emoji: "➖➖➖➖",
    name: "Contiguous Sixes",
    description: tr("The same digit six times in a row.", "La misma cifra seis veces seguidas.", "La mateixa xifra sis vegades seguides."),
    family: "CONTIGUOUS_RUN",
    check: ({ s }) => hasRun(s, 6),
    examples: { yes: [111111, 999999], no: [11111, 100000, 1212] },
  },
  {
    id: "SNAKE_EYES",
    emoji: "🎲",
    name: "Snake Eyes",
    description: tr("Exactly two 1s, and no other digit repeated.", "Exactamente dos unos, y ninguna otra cifra repetida.", "Exactament dos uns, i cap altra xifra repetida."),
    check: ({ s }) => count(s, "1") === 2 && tally(s).filter((c) => c >= 2).length === 1,
    examples: { yes: [11, 211, 3011], no: [1, 1122, 111] },
  },

  // --- Famous numbers --------------------------------------------------------
  contains("NICE", "😏", "Nice", "69", { family: "NICE" }),
  exactly("NICE_EXACT", "😏", "Exact Nice", [69], { family: "NICE" }),
  contains("VERY_NICE", "🥵", "Very Nice", "6969", { family: "NICE" }),
  exactly("VERY_VERY_NICE", "🫦", "Very Very Nice", [696969], { family: "NICE" }),
  contains("BOTANIST", "🌿", "Botanist", "420", { family: "BOTANIST" }),
  exactly("BOTANIST_EXACT", "🌿", "Exact Botanist", [420], { family: "BOTANIST" }),
  exactly("HOTBOX", "🌿", "Hotbox", [420420], { family: "BOTANIST" }),
  contains("MEANING", "🌌", "Meaning of Life", "42", {
    family: "BOTANIST",
    note: tr(
      "The answer to life, the universe and everything.",
      "La respuesta a la vida, el universo y todo lo demás.",
      "La resposta a la vida, l'univers i tota la resta.",
    ),
  }),
  exactly("MEANING_EXACT", "🌌", "Exact Meaning", [42], { family: "BOTANIST" }),
  contains("DEEPER_MEANING", "🌌", "Deeper Meaning", "4242", { family: "MEANING" }),
  exactly("UNIVERSAL_ANSWER", "🌌", "Universal Answer", [424242], { family: "MEANING" }),
  contains("DEVIL", "😈", "Devil", "666", { family: "DEVIL" }),
  exactly("DEVIL_EXACT", "😈", "Exact Devil", [666], { family: "DEVIL" }),
  exactly("INFERNAL", "🔱", "Infernal", [666666], { family: "DEVIL" }),
  contains("LEET", "💻", "Leet", "1337", { family: "LEET" }),
  exactly("LEET_EXACT", "💻", "Exact Leet", [1337], { family: "LEET" }),
  contains("HELL", "🔥", "Hell", "7734", { family: "HELL", note: UPSIDE_DOWN("HELL") }),
  exactly("EXACT_HELL", "👹", "Exact Hell", [7734], { family: "HELL" }),
  contains("HELLO", "👋", "Hello", "07734", { note: UPSIDE_DOWN("HELLO") }),
  contains("BOOB_8008", "🔢", "8008", "8008", { family: "BOOB" }),
  contains("BOOB_58008", "🔠", "58008", "58008", { family: "BOOB" }),
  contains("BOOB_80085", "🅱️", "80085", "80085", { family: "BOOB" }),
  exactly("EXACT_BOOB", "🍈", "Exact Boob", [8008, 58008], { family: "BOOB" }),
  exactly("EXACT_BOOB_80085", "🍈", "Exact 80085", [80085], { family: "BOOB" }),
  contains("EMERGENCY", "🚑", "Emergency", "911", { family: "EMERGENCY" }),
  exactly("EMERGENCY_EXACT", "🚑", "Exact Emergency", [911], { family: "EMERGENCY" }),
  exactly("MAYDAY", "🚨", "Mayday", [911911], { family: "EMERGENCY" }),
  contains("ERROR", "🚫", "Error 404", "404", { family: "ERROR" }),
  exactly("ERROR_EXACT", "🚫", "Not Found", [404], { family: "ERROR" }),
  contains("SECRET_AGENT", "🕶️", "Secret Agent", "007", { family: "BIG_BROTHER" }),
  contains("BIG_BROTHER", "👁️", "Big Brother", "1984", { family: "BIG_BROTHER" }),
  exactly("BIG_BROTHER_EXACT", "👁️", "Orwellian", [1984], { family: "BIG_BROTHER" }),
  contains("SIXTY_SEVEN", "🫠", "Six-Seven", "67", { family: "SIXTY_SEVEN" }),
  exactly("SIXTY_SEVEN_EXACT", "🫠", "Exact Six-Seven", [67], { family: "SIXTY_SEVEN" }),
  contains("SIXTY_SEVEN_DOUBLE", "🫠", "6767", "6767", { family: "SIXTY_SEVEN" }),
  exactly("BRAINROT", "🧠", "Brainrot", [676767], { family: "SIXTY_SEVEN" }),
  contains("EIGHTY_SIX", "🍽️", "Eighty-Six", "86", { family: "EIGHTY_SIX" }),
  exactly("EIGHTY_SIX_EXACT", "🍽️", "Exact Eighty-Six", [86], { family: "EIGHTY_SIX" }),
  contains("ORIENTATION", "🧭", "Orientation", "101", { family: "ORIENTATION" }),
  exactly("ORIENTATION_EXACT", "🧭", "Exact Orientation", [101], { family: "ORIENTATION" }),
  contains("CALENDAR", "📅", "Calendar", "365", { family: "CALENDAR" }),
  exactly("CALENDAR_EXACT", "📅", "Exact Calendar", [365], { family: "CALENDAR" }),
  exactly("GROUNDHOG_DAY", "📅", "Groundhog Day", [365365], { family: "CALENDAR" }),
  exactly("ALWAYS", "♾️", "Always", [247365, 365247], {
    family: "CALENDAR",
    note: tr("24/7, 365.", "24/7, 365.", "24/7, 365."),
  }),
  exactly("FULL_DAY", "⏳", "Full Day", [86400], {
    note: tr("The seconds in a day.", "Los segundos que tiene un día.", "Els segons que té un dia."),
  }),
  exactly("FOOTBALL_17776", "🏈", "17776", [17776]),
  {
    id: "ULTIMEME",
    emoji: "😂",
    name: "Funny Numbers",
    description: tr('Contains both "69" and "420".', 'Contiene "69" y "420".', 'Conté "69" i "420".'),
    family: "ULTIMEME",
    check: ({ s }) => s.includes("69") && s.includes("420"),
    examples: { yes: [69420, 42069, 142069], no: [69000, 420000, 6942] },
  },
  exactly("ULTIMEME_EXACT", "😂", "Funny Number", [69420, 42069], { family: "ULTIMEME" }),
  contains("JACKPOT", "💰", "Jackpot", "777", { family: "JACKPOT" }),
  exactly("JACKPOT_EXACT", "💰", "Exact Jackpot", [777], { family: "JACKPOT" }),
  contains("JACKPOT_FOUR", "💰💰", "Jackpot Four", "7777", { family: "JACKPOT" }),
  contains("JACKPOT_FIVE", "💰💰💰", "Jackpot Five", "77777", { family: "JACKPOT" }),
  contains("JACKPOT_SIX", "🏦", "Jackpot Six", "777777", { family: "JACKPOT" }),

  // --- Famous constants ------------------------------------------------------
  contains("PI_CONTAINS_3", "🥧", "Pi Slice (3)", "314", { family: "PI" }),
  contains("PI_CONTAINS_4", "🥧", "Pi Slice (4)", "3141", { family: "PI" }),
  contains("PI_CONTAINS_5", "🥧", "Pi Slice (5)", "31415", { family: "PI" }),
  exactly("PI", "🥧", "Pi", [314, 3141, 31415, 314159], {
    family: "PI",
    note: tr("The first digits of π.", "Las primeras cifras de π.", "Les primeres xifres de π."),
  }),
  contains("E_CONTAINS_3", "📈", "E Slice (3)", "271", { family: "E" }),
  contains("E_CONTAINS_4", "📈", "E Slice (4)", "2718", { family: "E" }),
  contains("E_CONTAINS_5", "📈", "E Slice (5)", "27182", { family: "E" }),
  exactly("E", "📈", "Euler's Number", [271, 2718, 27182, 271828], {
    family: "E",
    note: tr("The first digits of e.", "Las primeras cifras de e.", "Les primeres xifres d'e."),
  }),
  contains("TAU_SLICE_4", "🌀", "Tau Slice (4)", "6283", { family: "TAU" }),
  contains("TAU_SLICE_5", "🌀", "Tau Slice (5)", "62831", { family: "TAU" }),
  exactly("TAU", "🌀", "Tau", [6283, 62831, 628318], {
    family: "TAU",
    note: tr("The first digits of τ.", "Las primeras cifras de τ.", "Les primeres xifres de τ."),
  }),
  exactly("GOLDEN_RATIO", "🐚", "Golden Ratio", [1618, 16180, 161803], {
    note: tr("The first digits of φ.", "Las primeras cifras de φ.", "Les primeres xifres de φ."),
  }),
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
  /** How many different numbers the machine can roll. */
  rolls: number;
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

export const BADGE_RARITIES = ["common", "uncommon", "rare", "epic", "anomaly", "mythic"] as const;
export type BadgeRarity = (typeof BADGE_RARITIES)[number];

export const ROLL_TIERS = ["trash", "common", "uncommon", "rare", "epic", "anomaly", "mythic"] as const;
export type RollTier = (typeof ROLL_TIERS)[number];

/**
 * A badge is worth 100 points divided by the chance of rolling it: a badge
 * half of all numbers earn is worth 200, one that a single number earns is
 * worth a hundred million.
 */
export function pointsFor(count: number, rolls: number): number {
  return count > 0 ? Math.round((100 * rolls) / count) : 0;
}

/** Common above a 10% chance, then one step rarer for every ten times less likely. */
export function badgeRarity(points: number): BadgeRarity {
  if (points < 1_000) return "common";
  if (points < 10_000) return "uncommon";
  if (points < 100_000) return "rare";
  if (points < 1_000_000) return "epic";
  if (points < 10_000_000) return "anomaly";
  return "mythic";
}

/** The share of all possible rolls, 0 to 100, that score lower than this. */
export function scorePercentile(score: number, stats: BadgeStats): number {
  const lower = stats.scoreQuantiles.filter((other) => other < score).length;
  return Math.min(100, (lower / stats.scoreQuantiles.length) * 100);
}

export function rollTier(percentile: number): RollTier {
  if (percentile < 1) return "trash";
  if (percentile < 50) return "common";
  if (percentile < 75) return "uncommon";
  if (percentile < 90) return "rare";
  if (percentile < 95) return "epic";
  if (percentile < 99) return "anomaly";
  return "mythic";
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
  /** False when a better badge of the same family took its place in the score. */
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

/** The score of a set of earned badges: within a family, only the best counts. */
function score(earned: Badge[], stats: Pick<BadgeStats, "counts" | "rolls">) {
  const points = (badge: Badge) => pointsFor(stats.counts[badge.id] ?? 0, stats.rolls);

  const best = new Map<string, Badge>();
  for (const badge of earned) {
    if (!badge.family) continue;
    const current = best.get(badge.family);
    if (!current || points(badge) > points(current)) best.set(badge.family, badge);
  }

  const badges = earned.map((badge) => ({
    badge,
    points: points(badge),
    rarity: badgeRarity(points(badge)),
    counts: !badge.family || best.get(badge.family) === badge,
  }));
  const total = badges.reduce((sum, b) => sum + (b.counts ? b.points : 0), 0);
  return { badges, total };
}

export function scoreRoll(n: number, stats: BadgeStats): ScoredRoll {
  const { badges, total } = score(earnedBadges(n), stats);
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

  mix(`${MAX_ROLL};`);
  mix(BADGES.map((badge) => `${badge.id}:${badge.family ?? ""}`).join(","));
  for (let n = 0; n <= MAX_ROLL; n += n < 2_000 ? 1 : 499) {
    mix(earnedBadges(n).map((badge) => badge.id).join(",") + ";");
  }
  return hash.toString(16).padStart(8, "0");
}

/** Tries every possible roll. Takes a while. */
export function computeStats(maxRoll = MAX_ROLL): BadgeStats {
  const rolls = maxRoll + 1;
  const counts: Record<string, number> = Object.fromEntries(
    BADGES.map((badge) => [badge.id, 0]),
  );
  const earnedByRoll: Badge[][] = [];
  for (let n = 0; n <= maxRoll; n++) {
    const earned = earnedBadges(n);
    for (const badge of earned) counts[badge.id] += 1;
    earnedByRoll.push(earned);
  }

  const scores = earnedByRoll.map((earned) => score(earned, { counts, rolls }).total);
  scores.sort((a, b) => a - b);

  const scoreQuantiles: number[] = [];
  for (let i = 0; i < 1000; i++) {
    scoreQuantiles.push(scores[Math.floor((i / 1000) * scores.length)]);
  }

  return {
    fingerprint: badgeFingerprint(),
    rolls,
    counts,
    scoreQuantiles,
    maxScore: scores[scores.length - 1],
  };
}
