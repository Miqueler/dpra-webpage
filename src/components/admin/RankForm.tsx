"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { RANKS, type Rank } from "@/lib/ranks";
import { createClient } from "@/lib/supabase/client";

export function RankForm({
  userId,
  currentRank,
}: {
  userId: string;
  currentRank: Rank;
}) {
  const t = useTranslations("admin");
  const tRanks = useTranslations("common.ranks");
  const router = useRouter();
  const [rank, setRank] = useState(currentRank);
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unchanged = rank === currentRank;

  function submit(e: React.FormEvent) {
    e.preventDefault();

    setStatus("idle");
    setMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_rank", {
        target_user: userId,
        new_rank: rank,
      });

      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("done");
        setMessage(t("rankForm.success"));
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <select
        value={rank}
        onChange={(e) => {
          setRank(e.target.value as Rank);
          setStatus("idle");
        }}
        aria-label={t("rankForm.label")}
        className="min-w-0 border border-party-cream/30 bg-party-black px-2 py-1.5 text-sm text-party-cream focus:border-party-red focus:outline-none sm:w-52"
      >
        {RANKS.map((option) => (
          <option key={option} value={option}>
            {tRanks(option)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending || unchanged}
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
