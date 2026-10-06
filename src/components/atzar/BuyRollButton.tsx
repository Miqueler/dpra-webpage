"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const ROLL_COST = 20;

export function BuyRollButton({ coins }: { coins: number }) {
  const t = useTranslations("atzar.dashboard.buy");
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const insufficientFunds = coins < ROLL_COST;

  function buy() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("buy_roll");
      if (error) {
        setError(error.message || t("genericError"));
      } else {
        setStatus("done");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <button
        onClick={buy}
        disabled={pending || insufficientFunds}
        className="font-display border border-atzar-gold px-5 py-2 text-xs uppercase tracking-widest text-atzar-gold hover:bg-atzar-gold hover:text-atzar-black disabled:opacity-50"
      >
        {t("button", { cost: ROLL_COST })}
      </button>
      {status === "done" && (
        <p className="mt-2 text-xs uppercase tracking-widest text-atzar-gold-bright">
          {t("success")}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-atzar-red">{error}</p>}
    </div>
  );
}
