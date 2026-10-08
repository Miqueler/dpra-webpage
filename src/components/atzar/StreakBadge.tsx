import { getTranslations } from "next-intl/server";

export async function StreakBadge({ streak }: { streak: number }) {
  if (streak < 2) return null;

  const t = await getTranslations("atzar.play");

  return (
    <p className="font-display whitespace-nowrap border border-atzar-gold/40 bg-atzar-black/60 px-3 py-2 text-xs uppercase tracking-widest text-atzar-gold-bright">
      🔥 {t("streak", { count: streak })}
    </p>
  );
}
