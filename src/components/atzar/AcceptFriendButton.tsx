"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function AcceptFriendButton({ requestId }: { requestId: string }) {
  const t = useTranslations("atzar.friends.pending");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", requestId);
      if (error) {
        setError(error.message);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={accept}
        disabled={pending}
        className="font-display border border-atzar-gold px-3 py-1 text-xs uppercase tracking-widest text-atzar-gold hover:bg-atzar-gold hover:text-atzar-black disabled:opacity-50"
      >
        {t("accept")}
      </button>
      {error && <p className="text-xs text-atzar-red">{error}</p>}
    </div>
  );
}
