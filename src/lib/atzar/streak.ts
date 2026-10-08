const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * How many days in a row, ending today or yesterday, a citizen has a roll
 * recorded. `rollDates` are the `YYYY-MM-DD` days they rolled (in any order,
 * duplicates fine); `today` is today's date in the same format.
 *
 * A streak rolled today or yesterday still counts — the citizen has until
 * the end of today to extend it. Anything older than that breaks it.
 */
export function computeStreak(rollDates: string[], today: string): number {
  const days = new Set(rollDates);
  let cursor = parseDay(today);

  if (!days.has(formatDay(cursor))) {
    cursor -= DAY_MS;
    if (!days.has(formatDay(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(formatDay(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}
