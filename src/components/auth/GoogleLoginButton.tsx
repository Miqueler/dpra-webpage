"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export function GoogleLoginButton() {
  const t = useTranslations("auth.login");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const supabase = createClient();
    const next = encodeURIComponent(`/${locale}/profile`);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
  }

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="font-display flex w-full items-center justify-center gap-3 border border-party-cream bg-party-cream px-6 py-3 text-sm uppercase tracking-widest text-party-black transition-colors hover:bg-party-cream-dim disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.58-5.17 3.58-8.84z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.02c-1.08.73-2.46 1.16-4.06 1.16-3.12 0-5.76-2.1-6.7-4.93H1.3v3.1A11.998 11.998 0 0 0 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.3 14.3A7.2 7.2 0 0 1 4.92 12c0-.8.14-1.57.38-2.3V6.6H1.3A12 12 0 0 0 0 12c0 1.93.46 3.76 1.3 5.4z"
        />
        <path
          fill="#EA4335"
          d="M12 4.77c1.76 0 3.34.6 4.58 1.78l3.44-3.44A11.6 11.6 0 0 0 12 0 11.998 11.998 0 0 0 1.3 6.6l4 3.1C6.24 6.87 8.88 4.77 12 4.77z"
        />
      </svg>
      {t("button")}
    </button>
  );
}
