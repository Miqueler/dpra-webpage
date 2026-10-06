import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const referer = request.headers.get("referer");
  const supabase = await createClient();
  await supabase.auth.signOut();

  let redirectTo = `${origin}/ca`;
  if (referer) {
    const match = referer.match(/\/(ca|es|en)(\/|$)/);
    if (match) redirectTo = `${origin}/${match[1]}`;
  }

  return NextResponse.redirect(redirectTo, { status: 303 });
}
