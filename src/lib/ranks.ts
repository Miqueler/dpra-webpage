/**
 * Every rank a citizen can hold, lowest first. The database stores these
 * keys; their names live in each locale's common.json under `ranks`.
 *
 * Keep in sync with profiles_rank_check in
 * supabase/migrations/0011_admin_rolls_ranks_deletion.sql.
 */
export const RANKS = [
  "citizen",
  "comrade",
  "militant",
  "party_cadre",
  "hero_of_labour",
  "supreme_leader",
] as const;

export type Rank = (typeof RANKS)[number];
