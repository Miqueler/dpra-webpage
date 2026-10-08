"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Shown over every page to a logged-in citizen who has not accepted the
 * privacy policy yet. It steps aside on /privacy so the policy can be read.
 */
export function PrivacyConsent() {
  const t = useTranslations("privacy.consent");
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (pathname === "/privacy") return null;

  function accept() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("accept_privacy_policy");
      if (error) {
        setError(t("error"));
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-party-black/90 px-4"
    >
      <div className="w-full max-w-md border border-party-red bg-party-black-soft p-6 text-center sm:p-8">
        <p className="font-display mb-2 text-xs uppercase tracking-[0.3em] text-party-red">
          {t("eyebrow")}
        </p>
        <h2
          id="privacy-consent-title"
          className="font-display mb-4 text-2xl uppercase tracking-wide text-party-cream"
        >
          {t("title")}
        </h2>
        <p className="mb-2 text-sm text-party-cream/80">{t("body")}</p>
        <p className="mb-6 text-xs text-party-cream/50">{t("voluntary")}</p>

        <Link
          href="/privacy"
          className="font-display mb-6 inline-block text-xs uppercase tracking-widest text-party-cream underline underline-offset-4 hover:text-party-red"
        >
          {t("read")}
        </Link>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={accept}
            disabled={pending}
            className="font-display border border-party-red bg-party-red px-6 py-3 text-sm uppercase tracking-widest text-party-cream hover:bg-party-red-dark disabled:opacity-50"
          >
            {pending ? t("pending") : t("accept")}
          </button>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs uppercase tracking-widest text-party-cream/50 underline underline-offset-4 hover:text-party-cream"
            >
              {t("decline")}
            </button>
          </form>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-xs text-party-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
