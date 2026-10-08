// Recalculates what every ATZAR badge is worth by trying every possible roll,
// and saves the result where the site reads it. Run it with
// `npm run atzar:stats` after adding, removing or editing a badge.
import { writeFileSync } from "node:fs";
import { BADGES, computeStats, pointsFor } from "../src/lib/atzar/badges.ts";

console.log("Trying every possible roll. This takes about a minute...");
const stats = computeStats();
const target = new URL("../src/lib/atzar/badge-stats.json", import.meta.url);
writeFileSync(target, JSON.stringify(stats) + "\n");

const rows = BADGES.map((badge) => ({
  badge: badge.id,
  rolls: stats.counts[badge.id],
  points: pointsFor(stats.counts[badge.id], stats.rolls),
})).sort((a, b) => a.points - b.points);
console.table(rows);

const never = rows.filter((row) => row.rolls === 0).map((row) => row.badge);
if (never.length > 0) {
  console.warn(`No number earns: ${never.join(", ")}. Check their rules.`);
}
console.log(`Best possible score: ${stats.maxScore}. Saved badge-stats.json.`);
