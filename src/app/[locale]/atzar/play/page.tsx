import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchPlayerStats } from "@/lib/atzar/stats";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";
import { LinkButton } from "@/components/ui/LinkButton";
import { BuyRollButton } from "@/components/atzar/BuyRollButton";
import { OnlineMachine } from "@/components/atzar/OnlineMachine";
import { StreakBadge } from "@/components/atzar/StreakBadge";

export default async function AtzarPlayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect({ href: "/atzar", locale });
  }
  const userId = auth.user!.id;
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: settings }, { data: profile }, { data: todayRoll }, stats] =
    await Promise.all([
      supabase.from("atzar_settings").select("online_enabled").maybeSingle(),
      supabase.from("profiles").select("coins").eq("id", userId).single(),
      supabase
        .from("daily_rolls")
        .select("free_roll_used, extra_rolls")
        .eq("user_id", userId)
        .eq("roll_date", today)
        .maybeSingle(),
      fetchPlayerStats(supabase, userId, today),
    ]);

  const t = await getTranslations("atzar.play");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        <StreakBadge streak={stats.streak} />
      </div>

      {settings?.online_enabled ? (
        <>
          <PosterCard className="mb-6 border-atzar-gold/25 bg-atzar-black/60">
            <OnlineMachine
              freeRollAvailable={!todayRoll?.free_roll_used}
              extraRolls={todayRoll?.extra_rolls ?? 0}
              personalBest={stats.personalBest}
            />
          </PosterCard>
          <PosterCard className="mb-6 flex flex-col gap-4 border-atzar-gold/25 bg-atzar-black/60 sm:flex-row sm:items-center sm:justify-between">
            <BuyRollButton coins={profile?.coins ?? 0} />
            <p className="font-display text-2xl text-atzar-gold">
              {profile?.coins ?? 0}¤
            </p>
          </PosterCard>
        </>
      ) : (
        <PosterCard className="mb-6 border-atzar-gold/25 bg-atzar-black/60 text-center">
          <p className="font-display mb-2 text-xl uppercase tracking-widest text-atzar-red">
            {t("offline.title")}
          </p>
          <p className="text-sm text-party-cream/60">{t("offline.body")}</p>
        </PosterCard>
      )}

      <LinkButton href="/atzar" variant="ghost" className="px-0">
        {t("back")}
      </LinkButton>
    </div>
  );
}
