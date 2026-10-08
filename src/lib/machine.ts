import "server-only";
import type { NextRequest } from "next/server";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Whether the request carries the shared secret the ATZAR machine holds. */
export function isMachine(request: NextRequest) {
  const secret = request.headers.get("x-machine-secret");
  return Boolean(secret) && secret === process.env.MACHINE_API_SECRET;
}

type SessionLookup =
  | { session: { id: string; user_id: string | null }; failure?: undefined }
  | { session?: undefined; failure: { error: string; status: 404 | 410 } };

/**
 * Finds the live session for a code the machine showed. A code stops being
 * live once a play was recorded with it or its time ran out.
 */
export async function findMachineSession(
  supabase: AdminClient,
  code: string
): Promise<SessionLookup> {
  const { data: session } = await supabase
    .from("machine_sessions")
    .select("id, user_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  if (!session) {
    return { failure: { error: "unknown code", status: 404 } };
  }
  if (session.used_at) {
    return { failure: { error: "code already used", status: 410 } };
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return { failure: { error: "code expired", status: 410 } };
  }

  return { session: { id: session.id, user_id: session.user_id } };
}
