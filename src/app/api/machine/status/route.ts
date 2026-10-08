import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMachineSession, isMachine } from "@/lib/machine";

/**
 * GET /api/machine/status?code=ABC123
 * Header: x-machine-secret: <MACHINE_API_SECRET>
 *
 * Polled by the physical ATZAR machine while it shows a code. Answers
 * `{ linked: false }` until a citizen has typed the code into /atzar, then
 * says who they are and whether they have a free roll or purchased rolls
 * available.
 */
export async function GET(request: NextRequest) {
  if (!isMachine(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { session, failure } = await findMachineSession(supabase, code);
  if (failure) {
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  if (!session.user_id) {
    return NextResponse.json({ linked: false });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, coins")
    .eq("id", session.user_id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "unknown citizen" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: roll } = await supabase
    .from("daily_rolls")
    .select("free_roll_used, extra_rolls")
    .eq("user_id", profile.id)
    .eq("roll_date", today)
    .single();

  return NextResponse.json({
    linked: true,
    username: profile.username,
    coins: profile.coins,
    free_roll_available: !roll || !roll.free_roll_used,
    extra_rolls: roll?.extra_rolls ?? 0,
  });
}
