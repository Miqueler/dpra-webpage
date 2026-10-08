import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPlayerStats } from "@/lib/atzar/stats";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";
import { LinkButton } from "@/components/ui/LinkButton";
import { AtzarMark } from "@/components/atzar/AtzarMark";
import { BuyRollButton } from "@/components/atzar/BuyRollButton";
import { LinkMachineForm } from "@/components/atzar/LinkMachineForm";
import { StreakBadge } from "@/components/atzar/StreakBadge";

export default async function AtzarDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const t = await getTranslations("atzar.dashboard");

  if (!auth.user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-8">
        <AtzarMark className="mx-auto mb-6 h-12 w-12 text-atzar-gold" />
        <p className="font-display mb-2 text-xs uppercase tracking-[0.3em] text-atzar-red">
          {t("loggedOut.eyebrow")}
        </p>
        <h2 className="font-display mb-6 text-3xl uppercase tracking-wide text-atzar-gold-bright sm:text-4xl">
          {t("loggedOut.title")}
        </h2>
        <p className="mb-4 text-sm text-party-cream/80">{t("loggedOut.body1")}</p>
        <p className="mb-8 text-sm text-party-cream/60">{t("loggedOut.body2")}</p>
        <LinkButton href="/login" variant="primary">
          {t("loggedOut.cta")}
        </LinkButton>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single();

  const today = new Date().toISOString().slice(0, 10);

  const { data: todayRoll } = await supabase
    .from("daily_rolls")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("roll_date", today)
    .maybeSingle();

  const { data: settings } = await supabase
    .from("atzar_settings")
    .select("online_enabled")
    .maybeSingle();

  const { data: sessions } = await supabase
    .from("rng_sessions")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("played_at", { ascending: false })
    .limit(10);

  const stats = await fetchPlayerStats(supabase, auth.user.id, today);

  if (!profile) {
    return null;
  }

  const freeRollUsed = todayRoll?.free_roll_used ?? false;
  const extraRolls = todayRoll?.extra_rolls ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeading eyebrow={profile.rank} title={profile.username} />
        <StreakBadge streak={stats.streak} />
      </div>

      <PosterCard className="mb-6 flex flex-col gap-4 border-atzar-gold/25 bg-atzar-black/60 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-widest text-party-cream/50">
            {t("link.title")}
          </p>
          <p className="mb-3 max-w-sm text-sm text-party-cream/60">
            {t("link.hint")}
          </p>
          <LinkMachineForm />
        </div>
        <div className="sm:text-right">
          <p className="font-display text-3xl text-atzar-gold">{profile.coins}¤</p>
          <p className="text-xs uppercase tracking-widest text-party-cream/50">
            {t("coins")}
          </p>
        </div>
      </PosterCard>

      {settings?.online_enabled && (
        <PosterCard className="mb-6 flex flex-col gap-4 border-atzar-gold bg-atzar-black/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display mb-1 text-sm uppercase tracking-widest text-atzar-gold-bright">
              {t("online.title")}
            </p>
            <p className="max-w-sm text-sm text-party-cream/60">
              {t("online.body")}
            </p>
          </div>
          <LinkButton
            href="/atzar/play"
            className="border-atzar-gold bg-atzar-gold text-atzar-black hover:bg-atzar-gold-bright"
          >
            {t("online.cta")}
          </LinkButton>
        </PosterCard>
      )}

      <PosterCard className="mb-6 border-atzar-gold/25 bg-atzar-black/60">
        <p className="mb-3 text-xs uppercase tracking-widest text-party-cream/50">
          {t("today.title")}
        </p>
        <p
          className={
            freeRollUsed
              ? "mb-1 text-sm text-party-cream/60"
              : "mb-1 text-sm text-atzar-gold-bright"
          }
        >
          {freeRollUsed ? t("today.freeUsed") : t("today.freeAvailable")}
        </p>
        <p className="mb-4 text-sm text-party-cream/60">
          {t("today.extraRolls", { count: extraRolls })}
        </p>
        <BuyRollButton coins={profile.coins} />
      </PosterCard>

      <PosterCard className="mb-6 border-atzar-gold/25 bg-atzar-black/60">
        <p className="font-display mb-1 text-sm uppercase tracking-widest text-atzar-gold">
          {t("lore.title")}
        </p>
        <p className="text-sm text-party-cream/60">{t("lore.body")}</p>
      </PosterCard>

      <PosterCard className="border-atzar-gold/25 bg-atzar-black/60">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-widest text-party-cream/50">
            {t("history.title")}
          </p>
          {stats.personalBest !== null && (
            <p className="font-display text-sm text-atzar-gold-bright">
              {t("history.personalBest", { score: stats.personalBest })}
            </p>
          )}
        </div>
        {!sessions || sessions.length === 0 ? (
          <p className="text-sm text-party-cream/50">{t("history.empty")}</p>
        ) : (
          <ul className="divide-y divide-atzar-gold/10">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span className="text-party-cream/60">
                  {new Date(session.played_at).toLocaleString(locale)}
                </span>
                {typeof session.payload?.number === "number" && (
                  <span className="font-display tracking-widest text-party-cream/80">
                    {session.payload.number}
                  </span>
                )}
                <span className="font-display text-lg text-atzar-gold-bright">
                  {session.score !== null ? session.score : t("history.pending")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PosterCard>
    </div>
  );
}
