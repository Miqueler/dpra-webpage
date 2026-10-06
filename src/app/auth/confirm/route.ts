import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sameOriginPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

// Landing point for the links in Supabase's auth emails (signup confirmation
// and password recovery). `next` is the redirect target the email was
// requested with, so it arrives as a full URL; only same-origin paths are
// honoured.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const next = sameOriginPath(searchParams.get("next"), origin, "/ca/profile");

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const locale = next.match(/^\/(ca|es|en)(\/|$)/)?.[1] ?? "ca";
  return NextResponse.redirect(`${origin}/${locale}/login?error=link`);
}
