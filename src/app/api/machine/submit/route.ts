import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMachineSession, isMachine } from "@/lib/machine";

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
 * result here, under the code it showed for this play. This route only
 * records it for the citizen who claimed that code and decrements the roll
 * that was consumed — it never recomputes a score. The code is spent.
 */
export async function POST(request: NextRequest) {
  if (!isMachine(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as SubmitBody;
  const code = body.code?.trim().toUpperCase();
  const rollType = body.roll_type ?? "free";

  if (!code || typeof body.score !== "number") {
    return NextResponse.json({ error: "missing code or score" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { session, failure } = await findMachineSession(supabase, code);
  if (failure) {
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  if (!session.user_id) {
    return NextResponse.json({ error: "code not linked to a citizen yet" }, { status: 409 });
  }
  const userId = session.user_id;

  const today = new Date().toISOString().slice(0, 10);
  const { data: roll } = await supabase
    .from("daily_rolls")
    .select("free_roll_used, extra_rolls")
    .eq("user_id", userId)
    .eq("roll_date", today)
    .single();

  if (rollType === "free") {
    if (roll?.free_roll_used) {
      return NextResponse.json({ error: "free roll already used today" }, { status: 409 });
    }
    await supabase
      .from("daily_rolls")
      .upsert(
        { user_id: userId, roll_date: today, free_roll_used: true },
        { onConflict: "user_id,roll_date" }
      );
  } else {
    if (!roll || roll.extra_rolls < 1) {
      return NextResponse.json({ error: "no purchased rolls remaining" }, { status: 409 });
    }
    await supabase
      .from("daily_rolls")
      .update({ extra_rolls: roll.extra_rolls - 1 })
      .eq("user_id", userId)
      .eq("roll_date", today);
  }

  await supabase
    .from("machine_sessions")
    .update({ used_at: new Date().toISOString() })
    .eq("id", session.id);

  const { error: insertError } = await supabase.from("rng_sessions").insert({
    user_id: userId,
    score: body.score,
    payload: body.payload ?? null,
    source: "machine",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
