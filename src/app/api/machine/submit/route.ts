import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SubmitBody = {
  code?: string;
  score?: number;
  payload?: Record<string, unknown>;
  roll_type?: "free" | "paid";
};

/**
 * POST /api/machine/submit
 * Header: x-machine-secret: <MACHINE_API_SECRET>
 * Body: { code, score, payload, roll_type }
 *
 * The physical machine performs the RNG/scoring itself and reports the
 * result here. This route only records it and decrements the roll that was
 * consumed — it never recomputes a score.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-machine-secret");
  if (!secret || secret !== process.env.MACHINE_API_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as SubmitBody;
  const code = body.code?.trim().toUpperCase();
  const rollType = body.roll_type ?? "free";

  if (!code || typeof body.score !== "number") {
    return NextResponse.json({ error: "missing code or score" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("machine_code", code)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "unknown machine code" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: roll } = await supabase
    .from("daily_rolls")
    .select("free_roll_used, extra_rolls")
    .eq("user_id", profile.id)
    .eq("roll_date", today)
    .single();

  if (rollType === "free") {
    if (roll?.free_roll_used) {
      return NextResponse.json({ error: "free roll already used today" }, { status: 409 });
    }
    await supabase
      .from("daily_rolls")
      .upsert(
        { user_id: profile.id, roll_date: today, free_roll_used: true },
        { onConflict: "user_id,roll_date" }
      );
  } else {
    if (!roll || roll.extra_rolls < 1) {
      return NextResponse.json({ error: "no purchased rolls remaining" }, { status: 409 });
    }
    await supabase
      .from("daily_rolls")
      .update({ extra_rolls: roll.extra_rolls - 1 })
      .eq("user_id", profile.id)
      .eq("roll_date", today);
  }

  const { error: insertError } = await supabase.from("rng_sessions").insert({
    user_id: profile.id,
    score: body.score,
    payload: body.payload ?? null,
    source: "machine",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
