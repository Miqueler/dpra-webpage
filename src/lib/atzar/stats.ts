import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { computeStreak } from "./streak";

// Plenty for any streak worth showing; keeps the query bounded.
const STREAK_LOOKBACK_DAYS = 400;

export type PlayerStats = {
  streak: number;
  personalBest: number | null;
};

/** The citizen's current daily-roll streak and best score so far. */
export async function fetchPlayerStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string,
): Promise<PlayerStats> {
  const [{ data: rollDays }, { data: bestRow }] = await Promise.all([
    supabase
      .from("daily_rolls")
      .select("roll_date")
      .eq("user_id", userId)
      .eq("free_roll_used", true)
      .order("roll_date", { ascending: false })
      .limit(STREAK_LOOKBACK_DAYS),
    supabase
      .from("rng_sessions")
      .select("score")
      .eq("user_id", userId)
      .not("score", "is", null)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    streak: computeStreak((rollDays ?? []).map((row) => row.roll_date), today),
    personalBest: bestRow?.score ?? null,
  };
}
