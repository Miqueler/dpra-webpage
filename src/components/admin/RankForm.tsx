"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// Keep in sync with set_rank() in supabase/migrations/0004_admin_panel.sql.
const MAX_RANK_LENGTH = 40;

export function RankForm({
  userId,
  currentRank,
  suggestionsId,
}: {
  userId: string;
  currentRank: string;
  /** Id of a <datalist> holding the ranks already in use. */
  suggestionsId?: string;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [rank, setRank] = useState(currentRank);
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cleaned = rank.trim();
  const unchanged = cleaned === currentRank;

  function submit(e: React.FormEvent) {
    e.preventDefault();

    setStatus("idle");
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_rank", {
        target_user: userId,
        new_rank: cleaned,
      });

      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("done");
        setMessage(t("rankForm.success"));
        setRank(cleaned);
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <input
        type="text"
        value={rank}
        onChange={(e) => {
          setRank(e.target.value);
          setStatus("idle");
        }}
        maxLength={MAX_RANK_LENGTH}
        list={suggestionsId}
        aria-label={t("rankForm.label")}
        placeholder={t("rankForm.label")}
        className="min-w-0 border border-party-cream/30 bg-party-black px-2 py-1.5 text-sm text-party-cream placeholder:text-party-cream/40 focus:border-party-red focus:outline-none sm:w-52"
      />
      <button
        type="submit"
        disabled={pending || !cleaned || unchanged}
        className="font-display whitespace-nowrap border border-party-red px-3 py-1.5 text-xs uppercase tracking-widest text-party-red hover:bg-party-red hover:text-party-cream disabled:opacity-50"
      >
        {pending ? t("rankForm.pending") : t("rankForm.submit")}
      </button>
      {status === "done" && message && (
        <p className="text-xs text-atzar-gold">{message}</p>
      )}
      {status === "error" && message && (
        <p className="text-xs text-party-red">{message}</p>
      )}
    </form>
  );
}
