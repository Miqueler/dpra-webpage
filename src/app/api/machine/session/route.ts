import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMachine } from "@/lib/machine";

/**
 * POST /api/machine/session
 * Header: x-machine-secret: <MACHINE_API_SECRET>
 *
 * Called by the physical ATZAR machine when someone presses play. Returns a
 * short-lived code for the machine to show; the citizen types it into /atzar
 * to link the play to their account.
 */
export async function POST(request: NextRequest) {
  if (!isMachine(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_machine_session");
  const session = data?.[0];

  if (error || !session) {
    return NextResponse.json(
      { error: error?.message ?? "could not create a code" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { code: session.code, expires_at: session.expires_at },
    { status: 201 }
  );
}
