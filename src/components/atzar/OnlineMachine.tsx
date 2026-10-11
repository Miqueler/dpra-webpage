"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { RollResult } from "@/lib/atzar/machine";
import { noStateRestore } from "@/components/ui/noStateRestore";

const CELEBRATORY_TIERS: RollResult["tier"][] = ["epic", "anomaly", "mythic"];

// The reveal runs on a single clock: the reels stop one by one from the most
// significant digit to the least, then the badges appear one by one.
const TICK_MS = 70;
const TICKS_PER_REEL = 7;
const TICKS_BEFORE_BADGES = 6;
const TICKS_PER_BADGE = 5;
const IDLE_REELS = 6;

type RollError = "unauthorized" | "disabled" | "no_rolls" | "failed";

const LIGHTS = 13;

/** Where a roll stands among all possible rolls: the top half or the bottom one. */
function standing(percentile: number, locale: string) {
  const top = percentile >= 50;
  const share = Math.max(0.1, top ? 100 - percentile : percentile);
  return {
    key: top ? "top" : "bottom",
    percent: share.toLocaleString(locale, { maximumFractionDigits: share < 10 ? 1 : 0 }),
  } as const;
}

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
  personalBest,
}: {
  freeRollAvailable: boolean;
  extraRolls: number;
  /** The citizen's best score before this page loaded, if they have played before. */
  personalBest: number | null;
}) {
  const t = useTranslations("atzar.play");
  const locale = useLocale();
  const router = useRouter();
  // `from` is the tick the reveal starts at: 0 for the full show.
  const [run, setRun] = useState<{ result: RollResult; from: number } | null>(null);
  const [frame, setFrame] = useState({ tick: 0, spin: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RollError | null>(null);
  const [best, setBest] = useState(personalBest);
  // Mirrors `best` without triggering the reveal effect below when it changes.
  const bestRef = useRef(personalBest);
  const [newRecord, setNewRecord] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");

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
        const priorBest = bestRef.current;
        if (priorBest === null || run.result.score > priorBest) {
          if (priorBest !== null) setNewRecord(true);
          bestRef.current = run.result.score;
          setBest(run.result.score);
        }
        // The roll counts and the play history are rendered on the server.
        router.refresh();
      }
    }, TICK_MS);
    return () => clearInterval(clock);
  }, [run, router]);

  async function roll() {
    setBusy(true);
    setError(null);
    setNewRecord(false);
    setShareState("idle");
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

  async function share() {
    if (!result) return;
    const emojiLine = result.badges
      .filter((badge) => badge.counts)
      .map((badge) => badge.emoji)
      .join("");
    const lines = [
      t("share.line1", { number: result.number }),
      t("share.line2", {
        score: result.score.toLocaleString(locale),
        tier: t(`tiers.${result.tier}`),
      }),
      emojiLine,
      `${window.location.origin}/${locale}/atzar`,
    ].filter((line) => line.length > 0);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setShareState("copied");
    } catch {
      setShareState("error");
    }
  }

  const canRoll = freeRollAvailable || extraRolls > 0;
  const celebratory = done && result !== null && CELEBRATORY_TIERS.includes(result.tier);
  const reelsStopped = result !== null && lockedReels === digits.length;
  // Revealed cheapest first, listed best first: each new badge pushes the rest down.
  const revealed = result ? result.badges.slice(0, shownBadges).reverse() : [];
  const runningScore = revealed.reduce(
    (sum, badge) => sum + (badge.counts ? badge.points : 0),
    0,
  );
  const shownScore = result ? (done ? result.score : runningScore) : 0;
  const rank = result ? standing(result.percentile, locale) : null;
  const reels = result
    ? [...digits].map((digit, i) => (i < lockedReels ? digit : frame.spin[i] ?? "0"))
    : Array.from({ length: IDLE_REELS }, () => "–");

  return (
    <div>
      <div className="atzar-cabinet mx-auto mb-6 max-w-xl p-3 sm:p-5">
        <div aria-hidden="true" className="mb-3 flex items-center justify-between px-1">
          {Array.from({ length: LIGHTS }, (_, i) => (
            <span
              key={i}
              className={clsx(
                "atzar-light",
                (busy || revealing) && "atzar-light-chase",
                celebratory && "atzar-light-party",
              )}
              style={{ animationDelay: `${(i % 4) * 110}ms` }}
            />
          ))}
        </div>

        <div
          aria-hidden="true"
          className="atzar-window flex justify-center gap-1.5 px-2 py-4 sm:gap-2 sm:px-4 sm:py-6"
        >
          {reels.map((digit, i) => {
            const locked = result !== null && i < lockedReels;
            const spinning = result !== null && !locked;
            return (
              <span
                key={i}
                className={clsx(
                  "atzar-reel font-display flex h-20 w-12 items-center justify-center text-5xl tabular-nums sm:h-28 sm:w-[4.5rem] sm:text-7xl",
                  locked && "atzar-reel-locked",
                  spinning && "overflow-hidden",
                  busy && "animate-pulse",
                )}
              >
                <span
                  key={locked ? "locked" : frame.tick}
                  className={clsx(
                    "block",
                    locked && "atzar-digit-lock",
                    spinning && "atzar-digit-spin",
                  )}
                >
                  {digit}
                </span>
              </span>
            );
          })}
        </div>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            {...noStateRestore}
            onClick={roll}
            disabled={busy || revealing || !canRoll}
            className="atzar-roll-button font-display w-full px-10 py-4 text-base uppercase tracking-[0.35em] sm:w-auto sm:min-w-64"
          >
            {busy || revealing ? t("rolling") : result ? t("rollAgain") : t("roll")}
          </button>
        </div>
      </div>

      <p className="sr-only" role="status">
        {done && result
          ? t("announce", { number: result.number, score: result.score })
          : ""}
      </p>

      <div className="mb-8 flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-widest text-party-cream/50">
          {freeRollAvailable
            ? t("freeRoll")
            : extraRolls > 0
              ? t("paidRolls", { count: extraRolls })
              : t("noRolls")}
        </p>
        {best !== null && (
          <p className="text-xs text-party-cream/40">
            {t("personalBest", { score: best.toLocaleString(locale) })}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-atzar-red">
            {t(`errors.${error}`)}
          </p>
        )}
      </div>

      {result && reelsStopped && (
        <div
          key={`${result.number}-${done}`}
          className={clsx(
            "atzar-result relative mb-6 overflow-hidden border-2 px-4 py-6 text-center",
            done ? `atzar-tier-${result.tier} atzar-result-in` : "atzar-tier-pending",
            celebratory && "atzar-burst",
          )}
        >
          {done && newRecord && (
            <p className="atzar-badge mb-2 text-xs uppercase tracking-[0.3em] text-atzar-gold-bright">
              {t("newRecord")}
            </p>
          )}
          <p className="mb-1 text-xs uppercase tracking-widest text-party-cream/50">
            {t("score")}
          </p>
          <p
            key={shownScore}
            className="atzar-score font-display text-6xl tabular-nums sm:text-7xl"
          >
            {shownScore.toLocaleString(locale)}
          </p>
          {done && rank && (
            <>
              <p className="atzar-tier-name font-display mt-3 text-sm uppercase tracking-[0.3em]">
                {t(`tiers.${result.tier}`)}
              </p>
              {result.badges.length === 0 ? (
                <p className="mt-2 text-xs text-party-cream/50">{t("noBadges")}</p>
              ) : (
                <>
                  <p className="atzar-tier-name font-display mt-2 text-3xl uppercase tracking-wide">
                    {t(rank.key, { percent: rank.percent })}
                  </p>
                  <p className="text-xs text-party-cream/50">{t("ofAllRolls")}</p>
                </>
              )}
              <button
                type="button"
                onClick={share}
                className="atzar-share font-display mt-4 border px-5 py-2 text-xs uppercase tracking-widest"
              >
                {shareState === "copied" ? t("share.copied") : t("share.button")}
              </button>
              {shareState === "error" && (
                <p className="mt-2 text-xs text-atzar-red">{t("share.error")}</p>
              )}
            </>
          )}
        </div>
      )}

      {revealed.length > 0 && (
        <ul className="flex flex-col gap-2">
          {revealed.map((badge) => (
            <li
              key={badge.id}
              className={clsx(
                "atzar-badge atzar-badge-card flex items-start gap-3 border px-3 py-2",
                `atzar-tier-${badge.rarity}`,
                !badge.counts && "opacity-50",
              )}
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {badge.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="atzar-tier-name font-display block text-sm uppercase tracking-wide">
                  {badge.name}
                </span>
                <span className="block text-xs text-party-cream/60">
                  {badge.description}
                </span>
                <span className="atzar-tier-name mt-1 block text-[10px] uppercase tracking-widest opacity-70">
                  {badge.counts ? t(`rarities.${badge.rarity}`) : t("outranked")}
                </span>
              </span>
              <span
                className={clsx(
                  "atzar-tier-name font-display whitespace-nowrap text-sm",
                  !badge.counts && "line-through",
                )}
              >
                +{badge.points.toLocaleString(locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
