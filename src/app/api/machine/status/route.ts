import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/machine/status?code=ABC123
 * Header: x-machine-secret: <MACHINE_API_SECRET>
 *
 * Called by the physical ATZAR machine before a play to check whether the
 * citizen has a free roll or purchased rolls available.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-machine-secret");
  if (!secret || secret !== process.env.MACHINE_API_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, coins")
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

  return NextResponse.json({
    username: profile.username,
    coins: profile.coins,
    free_roll_available: !roll || !roll.free_roll_used,
    extra_rolls: roll?.extra_rolls ?? 0,
  });
}
