"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { RngSession } from "@/types/database";
import { RollsTable } from "./RollsTable";

const ROLLS_LIMIT = 20;

/** One citizen's latest rolls, fetched when the admin asks for them. */
export function CitizenRolls({ userId }: { userId: string }) {
  const t = useTranslations("admin.rolls");
  const [rolls, setRolls] = useState<RngSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function load() {
    setFailed(false);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("rng_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(ROLLS_LIMIT);

      if (error) {
        setFailed(true);
      } else {
        setRolls(data ?? []);
      }
    });
  }

  if (rolls === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={load}
          disabled={pending}
          className="font-display whitespace-nowrap border border-party-cream/40 px-3 py-1.5 text-xs uppercase tracking-widest text-party-cream/80 hover:bg-party-cream hover:text-party-black disabled:opacity-50"
        >
          {pending ? t("loading") : t("show")}
        </button>
        {failed && <p className="text-xs text-party-red">{t("loadError")}</p>}
      </div>
    );
  }

  if (rolls.length === 0) {
    return <p className="text-sm text-party-cream/50">{t("citizenEmpty")}</p>;
  }

  return <RollsTable rolls={rolls} />;
}
