"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteCitizenButton({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const t = useTranslations("admin.deleteForm");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_citizen", {
        target_user: userId,
      });
      if (error) {
        setError(error.message);
      } else {
        router.refresh();
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-display whitespace-nowrap border border-party-red px-3 py-1.5 text-xs uppercase tracking-widest text-party-red hover:bg-party-red hover:text-party-cream"
      >
        {t("button")}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-party-cream">{t("confirm", { username })}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="font-display whitespace-nowrap border border-party-red bg-party-red px-3 py-1.5 text-xs uppercase tracking-widest text-party-cream hover:bg-party-black hover:text-party-red disabled:opacity-50"
        >
          {pending ? t("pending") : t("confirmButton")}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={pending}
          className="font-display whitespace-nowrap border border-party-cream/40 px-3 py-1.5 text-xs uppercase tracking-widest text-party-cream/80 hover:bg-party-cream hover:text-party-black disabled:opacity-50"
        >
          {t("cancel")}
        </button>
      </div>
      {error && <p className="text-xs text-party-red">{error}</p>}
    </div>
  );
}
