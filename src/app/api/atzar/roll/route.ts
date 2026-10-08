import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { MAX_ROLL } from "@/lib/atzar/badges";
import { evaluateRoll } from "@/lib/atzar/machine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/atzar/roll
 * Body: { locale }
 *
 * One roll on the online ATZAR machine for the logged-in citizen. The number
 * is rolled and scored here, never in the browser, and is only handed back
 * once the database has spent a roll for it.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const locale = routing.locales.find((known) => known === body?.locale) ?? routing.defaultLocale;

  const result = evaluateRoll(randomInt(MAX_ROLL + 1), locale);

  const { data: outcome, error } = await createAdminClient().rpc("record_online_play", {
    target_user: auth.user.id,
    play_score: result.score,
    play_payload: {
      number: result.number,
      badges: result.badges.filter((badge) => badge.counts).map((badge) => badge.id),
    },
  });

  if (error || !outcome) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  if (outcome === "disabled") {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }
  if (outcome === "no_rolls") {
    return NextResponse.json({ error: "no_rolls" }, { status: 409 });
  }

  return NextResponse.json({ ...result, roll_type: outcome });
}
