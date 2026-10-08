"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { RollResult } from "@/lib/atzar/machine";

// The reveal runs on a single clock: the reels stop one by one from the most
// significant digit to the least, then the badges appear one by one.
const TICK_MS = 70;
const TICKS_PER_REEL = 7;
const TICKS_BEFORE_BADGES = 6;
const TICKS_PER_BADGE = 5;
const IDLE_REELS = 6;

type RollError = "unauthorized" | "disabled" | "no_rolls" | "failed";

const RARITY_STYLE: Record<RollResult["badges"][number]["rarity"], string> = {
  common: "border-party-cream/20 text-party-cream/70",
  uncommon: "border-party-cream/50 text-party-cream",
  rare: "border-atzar-gold/60 text-atzar-gold",
  epic: "border-atzar-gold-bright text-atzar-gold-bright",
  anomaly: "border-atzar-red text-atzar-gold-bright",
  mythic: "border-atzar-red bg-atzar-red/25 text-atzar-gold-bright",
};

function randomDigits(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

function lastTick(result: RollResult) {
  return (
    String(result.number).length * TICKS_PER_REEL +
    TICKS_BEFORE_BADGES +
    result.badges.length * TICKS_PER_BADGE
  );
}

export function OnlineMachine({
  freeRollAvailable,
  extraRolls,
}: {
  freeRollAvailable: boolean;
  extraRolls: number;
}) {
  const t = useTranslations("atzar.play");
  const locale = useLocale();
  const router = useRouter();
  // `from` is the tick the reveal starts at: 0 for the full show.
  const [run, setRun] = useState<{ result: RollResult; from: number } | null>(null);
  const [frame, setFrame] = useState({ tick: 0, spin: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RollError | null>(null);

  const result = run?.result ?? null;
  const digits = result ? String(result.number) : "";
  const end = result ? lastTick(result) : 0;
  const revealing = result !== null && frame.tick < end;
  const done = result !== null && !revealing;
  const lockedReels = Math.min(digits.length, Math.floor(frame.tick / TICKS_PER_REEL));
  const shownBadges = result
    ? Math.max(
        0,
        Math.min(
          result.badges.length,
          Math.floor(
            (frame.tick - digits.length * TICKS_PER_REEL - TICKS_BEFORE_BADGES) /
              TICKS_PER_BADGE,
          ) + 1,
        ),
      )
    : 0;

  useEffect(() => {
    if (!run) return;
    const length = String(run.result.number).length;
    const final = lastTick(run.result);
    let tick = run.from;
    const clock = setInterval(() => {
      tick += 1;
      setFrame({ tick, spin: randomDigits(length) });
      if (tick >= final) {
        clearInterval(clock);
        // The roll counts and the play history are rendered on the server.
        router.refresh();
      }
    }, TICK_MS);
    return () => clearInterval(clock);
  }, [run, router]);

  async function roll() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/atzar/roll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          (["unauthorized", "disabled", "no_rolls"] as const).find(
            (known) => known === body.error,
          ) ?? "failed",
        );
        return;
      }

      const rolled = body as RollResult;
      // Citizens who asked their device for less motion get the result at once.
      const still =
        typeof window.matchMedia !== "function" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const from = still ? lastTick(rolled) - 1 : 0;
      setFrame({ tick: from, spin: randomDigits(String(rolled.number).length) });
      setRun({ result: rolled, from });
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  }

  const canRoll = freeRollAvailable || extraRolls > 0;
  const reels = result
    ? [...digits].map((digit, i) => (i < lockedReels ? digit : frame.spin[i] ?? "0"))
    : Array.from({ length: IDLE_REELS }, () => "–");

  return (
    <div>
      <div
        aria-hidden="true"
        className="mb-6 flex justify-center gap-1.5 sm:gap-2"
      >
        {reels.map((digit, i) => (
          <span
            key={i}
            className={clsx(
              "font-display flex h-16 w-11 items-center justify-center border text-4xl tabular-nums sm:h-24 sm:w-16 sm:text-6xl",
              result && i < lockedReels
                ? "border-atzar-gold bg-atzar-black text-atzar-gold-bright"
                : "border-atzar-gold/30 bg-atzar-black/60 text-atzar-gold/40",
              busy && "animate-pulse",
            )}
          >
            {digit}
          </span>
        ))}
      </div>

      <p className="sr-only" role="status">
        {done && result
          ? t("announce", { number: result.number, score: result.score })
          : ""}
      </p>

      <div className="mb-8 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={roll}
          disabled={busy || revealing || !canRoll}
          className="font-display border border-atzar-gold bg-atzar-gold px-10 py-3 text-sm uppercase tracking-[0.3em] text-atzar-black hover:bg-atzar-gold-bright disabled:cursor-not-allowed disabled:bg-transparent disabled:text-atzar-gold/50"
        >
          {busy || revealing ? t("rolling") : result ? t("rollAgain") : t("roll")}
        </button>
        <p className="text-xs uppercase tracking-widest text-party-cream/50">
          {freeRollAvailable
            ? t("freeRoll")
            : extraRolls > 0
              ? t("paidRolls", { count: extraRolls })
              : t("noRolls")}
        </p>
        {error && (
          <p role="alert" className="text-sm text-atzar-red">
            {t(`errors.${error}`)}
          </p>
        )}
      </div>

      {result && shownBadges > 0 && (
        <ul className="mb-8 grid gap-2 sm:grid-cols-2">
          {result.badges.slice(0, shownBadges).map((badge) => (
            <li
              key={badge.id}
              className={clsx(
                "atzar-badge flex items-start gap-3 border px-3 py-2",
                RARITY_STYLE[badge.rarity],
                !badge.counts && "opacity-50",
              )}
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {badge.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-sm uppercase tracking-wide">
                  {badge.name}
                </span>
                <span className="block text-xs text-party-cream/60">
                  {badge.description}
                </span>
                <span className="mt-1 block text-[10px] uppercase tracking-widest opacity-70">
                  {badge.counts ? t(`rarities.${badge.rarity}`) : t("outranked")}
                </span>
              </span>
              <span
                className={clsx(
                  "font-display whitespace-nowrap text-sm",
                  !badge.counts && "line-through",
                )}
              >
                +{badge.points.toLocaleString(locale)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {done && result && (
        <div className="atzar-badge border border-atzar-gold/40 bg-atzar-black px-4 py-6 text-center">
          <p className="mb-1 text-xs uppercase tracking-widest text-party-cream/50">
            {t("score")}
          </p>
          <p className="font-display text-5xl text-atzar-gold-bright">
            {result.score.toLocaleString(locale)}
          </p>
          <p className="font-display mt-3 text-sm uppercase tracking-[0.3em] text-atzar-gold">
            {t(`tiers.${result.tier}`)}
          </p>
          <p className="mt-1 text-xs text-party-cream/50">
            {result.badges.length === 0
              ? t("noBadges")
              : t("percentile", { percent: Math.floor(result.percentile) })}
          </p>
        </div>
      )}
    </div>
  );
}
