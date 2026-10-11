"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Rank } from "@/types/database";

type ListedRank = Rank & {
  /** How many citizens hold the rank. */
  holders: number;
};

const INPUT =
  "min-w-0 border border-party-cream/30 bg-party-black px-2 py-1.5 text-sm text-party-cream focus:border-party-red focus:outline-none sm:w-52";
const BUTTON =
  "font-display whitespace-nowrap border border-party-red px-3 py-1.5 text-xs uppercase tracking-widest text-party-red hover:bg-party-red hover:text-party-cream disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-party-red";

/** Runs one of the rank functions, then reloads the lists rendered on the server. */
function useRankAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: (supabase: ReturnType<typeof createClient>) => PromiseLike<{
      error: { message: string } | null;
    }>,
    onDone?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const { error } = await action(createClient());
      if (error) {
        setError(error.message);
      } else {
        onDone?.();
        router.refresh();
      }
    });
  }

  return { run, error, pending };
}

function RankRow({ rank }: { rank: ListedRank }) {
  const t = useTranslations("admin.ranks");
  const [name, setName] = useState(rank.name);
  const { run, error, pending } = useRankAction();

  const cleaned = name.trim();
  const blocked = rank.is_default
    ? t("deleteDefault")
    : rank.holders > 0
      ? t("deleteInUse")
      : undefined;

  return (
    <li className="border-t border-party-cream/10 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <form
          className="flex flex-1 flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run((supabase) =>
              supabase.rpc("rename_rank", { rank_id: rank.id, new_name: cleaned }),
            );
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            aria-label={t("nameLabel")}
            className={INPUT}
          />
          <button
            type="submit"
            disabled={pending || cleaned === "" || cleaned === rank.name}
            className={BUTTON}
          >
            {t("rename")}
          </button>
          <span className="text-xs text-party-cream/50">
            {t("holders", { count: rank.holders })}
          </span>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {rank.is_default ? (
            <span className="border border-atzar-gold px-2 py-1 text-[10px] uppercase tracking-widest text-atzar-gold">
              {t("default")}
            </span>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run((supabase) => supabase.rpc("set_default_rank", { rank_id: rank.id }))
              }
              className={BUTTON}
            >
              {t("makeDefault")}
            </button>
          )}
          <button
            type="button"
            disabled={pending || blocked !== undefined}
            title={blocked}
            onClick={() =>
              run((supabase) => supabase.rpc("delete_rank", { rank_id: rank.id }))
            }
            className={BUTTON}
          >
            {t("delete")}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-party-red">{error}</p>}
    </li>
  );
}

export function RankManager({ ranks }: { ranks: ListedRank[] }) {
  const t = useTranslations("admin.ranks");
  const [name, setName] = useState("");
  const { run, error, pending } = useRankAction();

  return (
    <div>
      {ranks.length === 0 ? (
        <p className="py-4 text-sm text-party-cream/50">{t("empty")}</p>
      ) : (
        <ul>
          {/* Keyed by name too, so a renamed rank starts again from its new name. */}
          {ranks.map((rank) => (
            <RankRow key={`${rank.id}-${rank.name}`} rank={rank} />
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-center gap-2 border-t border-party-cream/10 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            (supabase) => supabase.rpc("create_rank", { new_name: name.trim() }),
            () => setName(""),
          );
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder={t("newPlaceholder")}
          aria-label={t("newPlaceholder")}
          className={INPUT}
        />
        <button type="submit" disabled={pending || name.trim() === ""} className={BUTTON}>
          {pending ? t("pending") : t("create")}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-party-red">{error}</p>}
    </div>
  );
}
