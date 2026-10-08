"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function OnlineMachineToggle({ enabled }: { enabled: boolean }) {
  const t = useTranslations("admin.onlineMachine");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_online_machine", {
        enabled: !enabled,
      });
      if (error) {
        setError(error.message);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-party-cream/70">
        <span
          className={
            enabled
              ? "font-display mr-2 uppercase tracking-widest text-atzar-gold"
              : "font-display mr-2 uppercase tracking-widest text-party-red"
          }
        >
          {enabled ? t("on") : t("off")}
        </span>
        {enabled ? t("onHint") : t("offHint")}
      </p>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="font-display whitespace-nowrap border border-atzar-gold px-4 py-2 text-xs uppercase tracking-widest text-atzar-gold hover:bg-atzar-gold hover:text-party-black disabled:opacity-50"
        >
          {pending ? t("pending") : enabled ? t("switchOff") : t("switchOn")}
        </button>
        {error && <p className="text-xs text-party-red">{error}</p>}
      </div>
    </div>
  );
}
