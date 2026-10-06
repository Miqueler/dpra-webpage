"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function DailyBonusButton({ alreadyClaimed }: { alreadyClaimed: boolean }) {
  const t = useTranslations("auth.profile");
  const router = useRouter();
  const [claimed, setClaimed] = useState(alreadyClaimed);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function claim() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("claim_daily_bonus");
      if (error) {
        setError(error.message);
      } else {
        setClaimed(true);
        router.refresh();
      }
    });
  }

  if (claimed) {
    return (
      <p className="text-xs uppercase tracking-widest text-atzar-gold">
        {t("dailyBonusClaimed")}
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={claim}
        disabled={pending}
        className="font-display border border-atzar-gold px-5 py-2 text-xs uppercase tracking-widest text-atzar-gold hover:bg-atzar-gold hover:text-party-black disabled:opacity-50"
      >
        {t("dailyBonusButton")}
      </button>
      {error && <p className="mt-2 text-xs text-party-red">{error}</p>}
    </div>
  );
}
